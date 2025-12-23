const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { masterPool } = require('../config/database');
const {
  ALL_OPERATION_KEYS,
  normalizeModules,
  parseModules
} = require('../constants/operations');
const { parsePermissions, USER_ROLES } = require('../constants/rbac');

const buildAdminResponse = (admin) => ({
  id: admin.id,
  username: admin.username,
  email: admin.email,
  role: 'admin',
  modules: ALL_OPERATION_KEYS
});

const buildStaffResponse = (staffRow) => {
  const modules = normalizeModules(staffRow.assigned_modules);
  const resolvedModules = modules.length > 0 ? modules : ['dashboard'];
  return {
    id: staffRow.id,
    username: staffRow.username,
    email: staffRow.email,
    role: 'staff',
    modules: resolvedModules
  };
};

const buildRBACUserResponse = (rbacUser) => {
  const permissions = parsePermissions(rbacUser.permissions);
  return {
    id: rbacUser.id,
    name: rbacUser.name,
    username: rbacUser.username,
    email: rbacUser.email,
    phone: rbacUser.phone,
    role: rbacUser.role,
    collegeId: rbacUser.college_id,
    courseId: rbacUser.course_id,
    branchId: rbacUser.branch_id,
    permissions: permissions,
    isActive: rbacUser.is_active
  };
};

// Unified Login (Admin/Staff/Student)
exports.unifiedLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Run all lookups in parallel for maximum speed
    const adminPromise = masterPool.query('SELECT * FROM admins WHERE username = ? LIMIT 1', [username]);

    const rbacPromise = masterPool.query(
      `SELECT id, name, username, email, phone, password, role, college_id, course_id, branch_id, college_ids, course_ids, branch_ids, permissions, is_active
       FROM rbac_users WHERE username = ? OR email = ? LIMIT 1`,
      [username, username]
    );

    const staffPromise = masterPool.query(
      'SELECT id, username, email, password_hash, assigned_modules, is_active FROM staff_users WHERE username = ? LIMIT 1',
      [username]
    );

    const studentPromise = masterPool.query(
      `SELECT sc.*, s.admission_number, s.student_name, s.student_mobile, s.current_year, s.current_semester, s.student_photo, s.course, s.branch, s.college
       FROM student_credentials sc
       JOIN students s ON sc.student_id = s.id
       WHERE sc.username = ? OR sc.admission_number = ? OR s.admission_number = ?`,
      [username, username, username]
    );

    const [
      [admins],
      [rbacRows],
      [staffRows],
      [credentials]
    ] = await Promise.all([adminPromise, rbacPromise, staffPromise, studentPromise]);

    // --- 1. Check Admin ---
    if (admins && admins.length > 0) {
      const adminAccount = admins[0];
      if (await bcrypt.compare(password, adminAccount.password)) {
        // Check if upgraded to RBAC
        const [rbacAdmin] = await masterPool.query(
          'SELECT * FROM rbac_users WHERE username = ? AND role = ? LIMIT 1',
          [adminAccount.username, 'super_admin']
        );

        if (rbacAdmin && rbacAdmin.length > 0) {
          const rbacUser = rbacAdmin[0];
          if (!rbacUser.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });
          const rbacResponse = buildRBACUserResponse(rbacUser);
          const token = jwt.sign({
            id: rbacUser.id, username: rbacUser.username, role: rbacUser.role,
            collegeId: rbacUser.college_id, courseId: rbacUser.course_id, branchId: rbacUser.branch_id,
            collegeIds: rbacUser.college_ids, courseIds: rbacUser.course_ids, branchIds: rbacUser.branch_ids,
            permissions: rbacUser.permissions
          }, process.env.JWT_SECRET, { expiresIn: '24h' });
          return res.json({ success: true, message: 'Login successful', token, user: rbacResponse });
        }

        const token = jwt.sign({
          id: adminAccount.id, username: adminAccount.username, role: 'admin', modules: ALL_OPERATION_KEYS
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, message: 'Login successful', token, user: buildAdminResponse(adminAccount) });
      }
    }

    // --- 2. Check RBAC User ---
    if (rbacRows && rbacRows.length > 0) {
      const rbacUser = rbacRows[0];
      if (!rbacUser.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

      if (await bcrypt.compare(password, rbacUser.password)) {
        const rbacResponse = buildRBACUserResponse(rbacUser);
        const token = jwt.sign({
          id: rbacUser.id, username: rbacUser.username, role: rbacUser.role,
          collegeId: rbacUser.college_id, courseId: rbacUser.course_id, branchId: rbacUser.branch_id,
          collegeIds: rbacUser.college_ids, courseIds: rbacUser.course_ids, branchIds: rbacUser.branch_ids,
          permissions: rbacUser.permissions
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, message: 'Login successful', token, user: rbacResponse });
      }
    }

    // --- 3. Check Staff User ---
    if (staffRows && staffRows.length > 0) {
      const staffUser = staffRows[0];
      if (!staffUser.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

      if (await bcrypt.compare(password, staffUser.password_hash)) {
        const staffResponse = buildStaffResponse(staffUser);
        const token = jwt.sign({
          id: staffUser.id, username: staffUser.username, role: 'staff', modules: staffResponse.modules
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, message: 'Login successful', token, user: staffResponse });
      }
    }

    // --- 4. Check Student User ---
    if (credentials && credentials.length > 0) {
      const studentValid = credentials[0];
      // Note: Student creation script might set password_hash.
      if (!studentValid.password_hash) {
        return res.status(401).json({ success: false, message: 'Account not initialized.' });
      }

      if (await bcrypt.compare(password, studentValid.password_hash)) {
        const token = jwt.sign({
          id: studentValid.student_id, admissionNumber: studentValid.admission_number, role: 'student'
        }, process.env.JWT_SECRET, { expiresIn: '24h' });

        const user = {
          admission_number: studentValid.admission_number,
          username: studentValid.username,
          name: studentValid.student_name,
          current_year: studentValid.current_year,
          current_semester: studentValid.current_semester,
          course: studentValid.course,
          branch: studentValid.branch,
          college: studentValid.college,
          student_photo: studentValid.student_photo,
          role: 'student'
        };
        return res.json({ success: true, message: 'Login successful', token, user });
      }
    }

    // --- 5. Failed All ---
    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  } catch (error) {
    console.error('Unified login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// Legacy Login (Admin Only - kept for backward compatibility if needed, else replace)
exports.login = exports.unifiedLogin;

// Verify token
exports.verifyToken = async (req, res) => {
  try {
    const authUser = req.user || req.admin;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    // Check if RBAC user
    if (Object.values(USER_ROLES).includes(authUser.role)) {
      const [rows] = await masterPool.query(
        `
          SELECT id, name, username, email, phone, role, college_id, course_id, branch_id, permissions, is_active
          FROM rbac_users
          WHERE id = ?
          LIMIT 1
        `,
        [authUser.id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const rbacRecord = rows[0];
      if (!rbacRecord.is_active) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      return res.json({
        success: true,
        user: buildRBACUserResponse(rbacRecord)
      });
    }

    if (authUser.role === 'staff') {
      const [rows] = await masterPool.query(
        `
          SELECT id, username, email, assigned_modules, is_active
          FROM staff_users
          WHERE id = ?
          LIMIT 1
        `,
        [authUser.id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const staffRecord = rows[0];
      if (!staffRecord.is_active) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      return res.json({
        success: true,
        user: buildStaffResponse(staffRecord)
      });
    }

    if (authUser.role === 'student') {
      const [students] = await masterPool.query(
        `SELECT sc.username, s.admission_number, s.student_name, s.student_mobile, s.current_year, s.current_semester, s.student_photo, s.course, s.branch, s.college
         FROM students s
         LEFT JOIN student_credentials sc ON sc.student_id = s.id
         WHERE s.id = ?`,
        [authUser.id]
      );

      if (!students || students.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      const studentValid = students[0];
      const user = {
        admission_number: studentValid.admission_number,
        username: studentValid.username,
        name: studentValid.student_name,
        current_year: studentValid.current_year,
        current_semester: studentValid.current_semester,
        course: studentValid.course,
        branch: studentValid.branch,
        college: studentValid.college,
        student_photo: studentValid.student_photo,
        role: 'student'
      };

      return res.json({
        success: true,
        user
      });
    }

    const [admins] = await masterPool.query(
      'SELECT id, username, email FROM admins WHERE id = ? LIMIT 1',
      [authUser.id]
    );
    if (!admins || admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      user: buildAdminResponse(admins[0])
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      message: 'Server error during verification'
    });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const authUser = req.user;
    if (!authUser || !Object.values(USER_ROLES).includes(authUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { name, email, phone, username } = req.body;

    // Validate existence of required fields
    if (!name || !email || !phone || !username) {
      return res.status(400).json({
        success: false,
        message: 'Name, Email, Phone and Username are required'
      });
    }

    // Check for unique username/email/phone exclusions
    // Check if any OTHER user has these details
    const [existing] = await masterPool.query(
      `SELECT id FROM rbac_users 
       WHERE (username = ? OR email = ? OR phone = ?) 
       AND id != ?`,
      [username, email, phone, authUser.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username, Email or Phone already in use by another user'
      });
    }

    // Update user
    await masterPool.query(
      `UPDATE rbac_users 
       SET name = ?, email = ?, phone = ?, username = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name, email, phone, username, authUser.id]
    );

    // Fetch updated user to return (excluding password)
    const [updatedUsers] = await masterPool.query(
      `SELECT 
        u.id, u.name, u.username, u.email, u.phone, u.role, u.password,
        c.name as collegeName,
        co.name as courseName,
        b.name as branchName,
        u.permissions
       FROM rbac_users u
       LEFT JOIN colleges c ON u.college_id = c.id
       LEFT JOIN courses co ON u.course_id = co.id
       LEFT JOIN course_branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [authUser.id]
    );

    const updatedUser = updatedUsers[0];
    if (updatedUser) {
      delete updatedUser.password;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update profile error details:', {
      message: error.message,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Server error updating profile: ' + error.message
    });
  }
};

// Change password
// Change password
exports.changePassword = async (req, res) => {
  try {
    const authUser = req.user || req.admin;

    // Allow Admin, Staff, and RBAC users to change password
    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required'
      });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // 1. Check if Admin (Legacy)
    if (authUser.role === 'admin') {
      const [admins] = await masterPool.query(
        'SELECT * FROM admins WHERE id = ? LIMIT 1',
        [authUser.id]
      );
      if (!admins || admins.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

      const admin = admins[0];
      const isValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await masterPool.query('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, authUser.id]);

      return res.json({ success: true, message: 'Password changed successfully' });
    }

    // 2. Check if RBAC User
    if (Object.values(USER_ROLES).includes(authUser.role)) {
      const [users] = await masterPool.query(
        'SELECT * FROM rbac_users WHERE id = ? LIMIT 1',
        [authUser.id]
      );
      if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

      const user = users[0];
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await masterPool.query('UPDATE rbac_users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, authUser.id]);

      return res.json({ success: true, message: 'Password changed successfully' });
    }

    // 3. Check if Staff (Legacy)
    if (authUser.role === 'staff') {
      const [staff] = await masterPool.query(
        'SELECT * FROM staff_users WHERE id = ? LIMIT 1',
        [authUser.id]
      );
      if (!staff || staff.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

      const user = staff[0];
      const isValid = await bcrypt.compare(currentPassword, user.password_hash); // Note: staff uses password_hash column
      if (!isValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await masterPool.query('UPDATE staff_users SET password_hash = ? WHERE id = ?', [hashedPassword, authUser.id]);

      return res.json({ success: true, message: 'Password changed successfully' });
    }

    return res.status(403).json({
      success: false,
      message: 'Password change not supported for this user type via this endpoint'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
};

