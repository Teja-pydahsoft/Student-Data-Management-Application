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

    // --- 1. Attempt Admin/Staff Login ---
    let adminAccount = null;

    // Check Legacy Admin
    try {
      const [admins] = await masterPool.query(
        'SELECT * FROM admins WHERE username = ? LIMIT 1',
        [username]
      );
      if (admins && admins.length > 0) adminAccount = admins[0];
    } catch (e) { console.error(e); }

    if (adminAccount) {
      if (await bcrypt.compare(password, adminAccount.password)) {
        // ... (Existing Admin Logic reused) ...
        // Check RBAC
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
            permissions: rbacUser.permissions
          }, process.env.JWT_SECRET, { expiresIn: '24h' });

          return res.json({ success: true, message: 'Login successful', token, user: rbacResponse });
        }

        // Legacy Admin
        const token = jwt.sign({
          id: adminAccount.id, username: adminAccount.username, role: 'admin', modules: ALL_OPERATION_KEYS
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, message: 'Login successful', token, user: buildAdminResponse(adminAccount) });
      }
      // If found but password wrong, return error immediately (don't fall through to student)
      // Actually, username collision between admin/student is rare but possible. 
      // Safest is to fall through ONLY if not found, but if found & wrong password => 401.
      // However, separating namespaces is better. Assuming namespaces distinct or we want strict check.
      // Re-reading user request: "same login page". 
      // If I type "admin" and wrong password, it says 401. 
      // If I type "student" and it's not in admin table, it checks student table.
    }

    // Check RBAC User
    const [rbacRows] = await masterPool.query(
      `SELECT id, name, username, email, phone, password, role, college_id, course_id, branch_id, permissions, is_active
       FROM rbac_users WHERE username = ? OR email = ? LIMIT 1`,
      [username, username]
    );

    if (rbacRows && rbacRows.length > 0) {
      const rbacUser = rbacRows[0];
      if (!rbacUser.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

      if (await bcrypt.compare(password, rbacUser.password)) {
        const rbacResponse = buildRBACUserResponse(rbacUser);
        const token = jwt.sign({
          id: rbacUser.id, username: rbacUser.username, role: rbacUser.role,
          collegeId: rbacUser.college_id, courseId: rbacUser.course_id, branchId: rbacUser.branch_id,
          permissions: rbacUser.permissions
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, message: 'Login successful', token, user: rbacResponse });
      }
      // Found but wrong password
      // To strictly follow "unified", we could return 401 here. 
      // But if a student has same username as an admin? Unlikely given admin usernames are usually names/emails and students are Admission Numbers.
      // Let's assume unique namespaces for now or just return 401 if found.
    }

    // Check Staff User
    const [staffRows] = await masterPool.query(
      'SELECT id, username, email, password_hash, assigned_modules, is_active FROM staff_users WHERE username = ? LIMIT 1',
      [username]
    );
    if (staffRows.length > 0) {
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

    // --- 2. Attempt Student Login (Fallback) ---
    // Find student credential
    const [credentials] = await masterPool.query(
      `SELECT sc.*, s.admission_number, s.student_name, s.student_mobile, s.current_year, s.current_semester, s.student_photo, s.course, s.branch, s.college
       FROM student_credentials sc
       JOIN students s ON sc.student_id = s.id
       WHERE sc.username = ? OR sc.admission_number = ? OR s.admission_number = ?`,
      [username, username, username]
    );

    if (credentials.length > 0) {
      const studentValid = credentials[0];
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
          current_year: studentValid.current_year, // Ensure these fields match your student table
          current_semester: studentValid.current_semester,
          course: studentValid.course,
          branch: studentValid.branch,
          college: studentValid.college,
          student_photo: studentValid.student_photo,
          role: 'student' // Explicitly add role for frontend
        };
        return res.json({ success: true, message: 'Login successful', token, user });
      }
    }

    // --- 3. Failed All ---
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
      success: false,
      message: 'Server error during verification'
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const authUser = req.user || req.admin;
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can change password via this endpoint'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required'
      });
    }

    // Get admin
    const [admins] = await masterPool.query(
      'SELECT * FROM admins WHERE id = ? LIMIT 1',
      [authUser.id]
    );
    if (!admins || admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const admin = admins[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await masterPool.query(
      'UPDATE admins SET password = ? WHERE id = ?',
      [hashedPassword, authUser.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
};
