const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { masterPool } = require('../config/database');
const {
  USER_ROLES,
  ROLE_HIERARCHY,
  ROLE_LABELS,
  ROLE_REQUIREMENTS,
  validateRoleRequirements,
  canCreateRole,
  parsePermissions,
  createDefaultPermissions,
  createSuperAdminPermissions,
  MODULES,
  ALL_MODULES
} = require('../constants/rbac');
const { sendCredentialsEmail, sendPasswordResetEmail } = require('../utils/emailService');

/**
 * Check if user is a super admin (including legacy 'admin' role)
 */
const isSuperAdmin = (user) => {
  return user && (user.role === USER_ROLES.SUPER_ADMIN || user.role === 'admin');
};

/**
 * Parse scope data (JSON or single value)
 */
const parseScopeData = (data) => {
  if (!data) return [];
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [data];
  }
};

/**
 * GET /api/rbac/users
 * Get all users (filtered by scope)
 */
exports.getUsers = async (req, res) => {
  try {
    const user = req.user || req.admin;
    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.username,
        u.role,
        u.college_ids,
        u.course_ids,
        u.branch_ids,
        u.all_courses,
        u.all_branches,
        u.permissions,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.college_id,
        u.course_id,
        u.branch_id,
        c.name as college_name,
        co.name as course_name,
        cb.name as branch_name
      FROM rbac_users u
      LEFT JOIN colleges c ON u.college_id = c.id
      LEFT JOIN courses co ON u.course_id = co.id
      LEFT JOIN course_branches cb ON u.branch_id = cb.id
    `;
    const params = [];
    const conditions = [];

    // Super admin (including legacy 'admin') sees all users
    if (!isSuperAdmin(user)) {
      // College Principal / College AO sees users in their college
      if (user.role === USER_ROLES.COLLEGE_PRINCIPAL || user.role === USER_ROLES.COLLEGE_AO) {
        const [userRows] = await masterPool.query(
          'SELECT college_id, college_ids FROM rbac_users WHERE id = ?',
          [user.id]
        );
        if (userRows && userRows.length > 0) {
          const collegeIds = parseScopeData(userRows[0].college_ids);
          if (collegeIds.length > 0) {
            conditions.push(`(u.college_id IN (${collegeIds.map(() => '?').join(',')}) OR JSON_OVERLAPS(u.college_ids, ?))`);
            params.push(...collegeIds, JSON.stringify(collegeIds));
          } else if (userRows[0].college_id) {
            conditions.push('u.college_id = ?');
            params.push(userRows[0].college_id);
          }
        }
      }
      // Branch HOD sees only users in their branch
      else if (user.role === USER_ROLES.BRANCH_HOD) {
        const [userRows] = await masterPool.query(
          'SELECT branch_id, branch_ids FROM rbac_users WHERE id = ?',
          [user.id]
        );
        if (userRows && userRows.length > 0) {
          const branchIds = parseScopeData(userRows[0].branch_ids);
          if (branchIds.length > 0) {
            conditions.push(`(u.branch_id IN (${branchIds.map(() => '?').join(',')}) OR JSON_OVERLAPS(u.branch_ids, ?))`);
            params.push(...branchIds, JSON.stringify(branchIds));
          } else if (userRows[0].branch_id) {
            conditions.push('u.branch_id = ?');
            params.push(userRows[0].branch_id);
          }
        }
      }
      // College Attender sees users in their college
      else if (user.role === USER_ROLES.COLLEGE_ATTENDER) {
        const [userRows] = await masterPool.query(
          'SELECT college_id, college_ids FROM rbac_users WHERE id = ?',
          [user.id]
        );
        if (userRows && userRows.length > 0) {
          const collegeIds = parseScopeData(userRows[0].college_ids);
          if (collegeIds.length > 0) {
            conditions.push(`(u.college_id IN (${collegeIds.map(() => '?').join(',')}) OR JSON_OVERLAPS(u.college_ids, ?))`);
            params.push(...collegeIds, JSON.stringify(collegeIds));
          } else if (userRows[0].college_id) {
            conditions.push('u.college_id = ?');
            params.push(userRows[0].college_id);
          }
        }
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY u.created_at DESC';

    const [rows] = await masterPool.query(query, params);

    // Fetch college, course, branch names for multi-select
    const users = await Promise.all(rows.map(async (row) => {
      const collegeIds = parseScopeData(row.college_ids);
      const courseIds = parseScopeData(row.course_ids);
      const branchIds = parseScopeData(row.branch_ids);
      
      let collegeNames = [];
      let courseNames = [];
      let branchNames = [];

      if (collegeIds.length > 0) {
        const [colleges] = await masterPool.query(
          `SELECT id, name FROM colleges WHERE id IN (${collegeIds.map(() => '?').join(',')})`,
          collegeIds
        );
        collegeNames = colleges.map(c => ({ id: c.id, name: c.name }));
      }

      if (courseIds.length > 0) {
        const [courses] = await masterPool.query(
          `SELECT id, name FROM courses WHERE id IN (${courseIds.map(() => '?').join(',')})`,
          courseIds
        );
        courseNames = courses.map(c => ({ id: c.id, name: c.name }));
      }

      if (branchIds.length > 0) {
        const [branches] = await masterPool.query(
          `SELECT id, name FROM course_branches WHERE id IN (${branchIds.map(() => '?').join(',')})`,
          branchIds
        );
        branchNames = branches.map(b => ({ id: b.id, name: b.name }));
      }

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        username: row.username,
        role: row.role,
        roleLabel: ROLE_LABELS[row.role] || row.role,
        collegeId: row.college_id,
        courseId: row.course_id,
        branchId: row.branch_id,
        collegeIds: collegeIds,
        courseIds: courseIds,
        branchIds: branchIds,
        allCourses: !!row.all_courses,
        allBranches: !!row.all_branches,
        collegeName: row.college_name,
        courseName: row.course_name,
        branchName: row.branch_name,
        collegeNames,
        courseNames,
        branchNames,
        permissions: parsePermissions(row.permissions),
        isActive: !!row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }));

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
};

/**
 * GET /api/rbac/users/:id
 * Get single user by ID
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user || req.admin;

    const [rows] = await masterPool.query(
      `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.username,
          u.role,
          u.college_id,
          u.course_id,
          u.branch_id,
          u.college_ids,
          u.course_ids,
          u.branch_ids,
          u.all_courses,
          u.all_branches,
          u.permissions,
          u.is_active,
          u.created_at,
          u.updated_at,
          c.name as college_name,
          co.name as course_name,
          cb.name as branch_name
        FROM rbac_users u
        LEFT JOIN colleges c ON u.college_id = c.id
        LEFT JOIN courses co ON u.course_id = co.id
        LEFT JOIN course_branches cb ON u.branch_id = cb.id
        WHERE u.id = ?
      `,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = rows[0];

    // Check if current user can view this user (scope check)
    if (!isSuperAdmin(user)) {
      if ((user.role === USER_ROLES.COLLEGE_PRINCIPAL || user.role === USER_ROLES.COLLEGE_AO) && userData.college_id !== user.collegeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      if (user.role === USER_ROLES.BRANCH_HOD && userData.branch_id !== user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const collegeIds = parseScopeData(userData.college_ids);
    const courseIds = parseScopeData(userData.course_ids);
    const branchIds = parseScopeData(userData.branch_ids);

    res.json({
      success: true,
      data: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        username: userData.username,
        role: userData.role,
        roleLabel: ROLE_LABELS[userData.role] || userData.role,
        collegeId: userData.college_id,
        courseId: userData.course_id,
        branchId: userData.branch_id,
        collegeIds,
        courseIds,
        branchIds,
        allCourses: !!userData.all_courses,
        allBranches: !!userData.all_branches,
        collegeName: userData.college_name,
        courseName: userData.course_name,
        branchName: userData.branch_name,
        permissions: parsePermissions(userData.permissions),
        isActive: !!userData.is_active,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      }
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
};

/**
 * POST /api/rbac/users
 * Create new user
 */
exports.createUser = async (req, res) => {
  try {
    const creator = req.user || req.admin;
    const {
      name,
      email,
      phone,
      username,
      password,
      role,
      collegeId,
      courseId,
      branchId,
      collegeIds,
      courseIds,
      branchIds,
      allCourses,
      allBranches,
      permissions,
      sendCredentials
    } = req.body;

    // Validate required fields
    if (!name || !email || !username || !role || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, username, password, and role are required'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Normalize IDs to arrays
    const normalizedCollegeIds = collegeIds && collegeIds.length > 0 
      ? collegeIds 
      : (collegeId ? [collegeId] : []);
    const normalizedCourseIds = courseIds && courseIds.length > 0 
      ? courseIds 
      : (courseId ? [courseId] : []);
    const normalizedBranchIds = branchIds && branchIds.length > 0 
      ? branchIds 
      : (branchId ? [branchId] : []);

    // Validate role requirements
    const roleValidation = validateRoleRequirements(
      role, 
      normalizedCollegeIds, 
      normalizedCourseIds, 
      normalizedBranchIds,
      allCourses,
      allBranches
    );
    if (!roleValidation.valid) {
      return res.status(400).json({
        success: false,
        message: roleValidation.message
      });
    }

    // Check if creator can create this role (convert legacy 'admin' to 'super_admin')
    const effectiveCreatorRole = creator.role === 'admin' ? USER_ROLES.SUPER_ADMIN : creator.role;
    if (!canCreateRole(effectiveCreatorRole, role)) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to create users with role: ${role}`
      });
    }

    // Validate scope restrictions
    if (!isSuperAdmin(creator)) {
      // College Principal / College AO can only create users in their college
      if (creator.role === USER_ROLES.COLLEGE_PRINCIPAL || creator.role === USER_ROLES.COLLEGE_AO) {
        const [userRows] = await masterPool.query(
          'SELECT college_id, college_ids FROM rbac_users WHERE id = ?',
          [creator.id]
        );
        if (userRows && userRows.length > 0) {
          const creatorCollegeIds = parseScopeData(userRows[0].college_ids);
          const creatorCollegeId = userRows[0].college_id;
          const allowedColleges = creatorCollegeIds.length > 0 ? creatorCollegeIds : (creatorCollegeId ? [creatorCollegeId] : []);
          
          const isValidScope = normalizedCollegeIds.every(id => allowedColleges.includes(id));
          if (!isValidScope) {
            return res.status(403).json({
              success: false,
              message: 'You can only create users in your assigned colleges'
            });
          }
        }
      }
      // Branch HOD can only create users in their branch
      else if (creator.role === USER_ROLES.BRANCH_HOD) {
        const [userRows] = await masterPool.query(
          'SELECT branch_id, branch_ids FROM rbac_users WHERE id = ?',
          [creator.id]
        );
        if (userRows && userRows.length > 0) {
          const creatorBranchIds = parseScopeData(userRows[0].branch_ids);
          const creatorBranchId = userRows[0].branch_id;
          const allowedBranches = creatorBranchIds.length > 0 ? creatorBranchIds : (creatorBranchId ? [creatorBranchId] : []);
          
          const isValidScope = normalizedBranchIds.every(id => allowedBranches.includes(id));
          if (!isValidScope) {
            return res.status(403).json({
              success: false,
              message: 'You can only create users in your assigned branches'
            });
          }
        }
      }
    }

    // Check if email or username already exists
    const [existing] = await masterPool.query(
      'SELECT id FROM rbac_users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email or username already exists'
      });
    }

    // Hash the provided password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Parse and validate permissions
    let userPermissions = permissions || createDefaultPermissions();
    
    // Super admin gets all permissions
    if (role === USER_ROLES.SUPER_ADMIN) {
      userPermissions = createSuperAdminPermissions();
    } else {
      // Ensure permissions structure is valid
      const parsed = parsePermissions(userPermissions);
      userPermissions = parsed;
    }

    // Insert user with multi-select support
    const [result] = await masterPool.query(
      `
        INSERT INTO rbac_users 
          (name, email, phone, username, password, role, college_id, course_id, branch_id, 
           college_ids, course_ids, branch_ids, all_courses, all_branches, permissions, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, CAST(? AS JSON), ?)
      `,
      [
        name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        username.trim(),
        hashedPassword,
        role,
        normalizedCollegeIds[0] || null,
        normalizedCourseIds[0] || null,
        normalizedBranchIds[0] || null,
        JSON.stringify(normalizedCollegeIds),
        JSON.stringify(normalizedCourseIds),
        JSON.stringify(normalizedBranchIds),
        allCourses ? 1 : 0,
        allBranches ? 1 : 0,
        JSON.stringify(userPermissions),
        creator.id
      ]
    );

    // Fetch created user
    const [rows] = await masterPool.query(
      `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.username,
          u.role,
          u.college_id,
          u.course_id,
          u.branch_id,
          u.college_ids,
          u.course_ids,
          u.branch_ids,
          u.all_courses,
          u.all_branches,
          u.permissions,
          u.is_active,
          u.created_at,
          u.updated_at,
          c.name as college_name,
          co.name as course_name,
          cb.name as branch_name
        FROM rbac_users u
        LEFT JOIN colleges c ON u.college_id = c.id
        LEFT JOIN courses co ON u.course_id = co.id
        LEFT JOIN course_branches cb ON u.branch_id = cb.id
        WHERE u.id = ?
      `,
      [result.insertId]
    );

    const newUser = rows[0];

    // Send credentials email if requested
    let emailSent = false;
    let emailError = null;
    if (sendCredentials) {
      try {
        const emailResult = await sendCredentialsEmail({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          username: username.trim(),
          password: password,
          role: ROLE_LABELS[role] || role
        });
        emailSent = emailResult.success;
        if (!emailResult.success) {
          emailError = emailResult.message || 'Failed to send email';
          console.error('❌ Email notification failed for user creation:', {
            userId: newUser.id,
            email: email.trim().toLowerCase(),
            error: emailError
          });
        }
      } catch (emailErr) {
        emailError = emailErr.message || 'Unexpected error while sending email';
        console.error('❌ Exception while sending email notification:', {
          userId: newUser.id,
          email: email.trim().toLowerCase(),
          error: emailError,
          stack: emailErr.stack
        });
      }
    }

    res.status(201).json({
      success: true,
      message: sendCredentials && emailSent 
        ? 'User created and credentials sent to email!' 
        : sendCredentials && !emailSent
        ? `User created successfully, but email notification failed: ${emailError || 'Unknown error'}`
        : 'User created successfully',
      emailSent,
      emailError: emailError || undefined,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        username: newUser.username,
        role: newUser.role,
        roleLabel: ROLE_LABELS[newUser.role] || newUser.role,
        collegeId: newUser.college_id,
        courseId: newUser.course_id,
        branchId: newUser.branch_id,
        collegeIds: parseScopeData(newUser.college_ids),
        courseIds: parseScopeData(newUser.course_ids),
        branchIds: parseScopeData(newUser.branch_ids),
        allCourses: !!newUser.all_courses,
        allBranches: !!newUser.all_branches,
        collegeName: newUser.college_name,
        courseName: newUser.course_name,
        branchName: newUser.branch_name,
        permissions: parsePermissions(newUser.permissions),
        isActive: !!newUser.is_active,
        createdAt: newUser.created_at,
        updatedAt: newUser.updated_at
      }
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Email or username already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while creating user'
    });
  }
};

/**
 * PUT /api/rbac/users/:id
 * Update user
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updater = req.user || req.admin;
    const {
      name,
      email,
      phone,
      role,
      collegeId,
      courseId,
      branchId,
      collegeIds,
      courseIds,
      branchIds,
      allCourses,
      allBranches,
      permissions,
      isActive
    } = req.body;

    // Fetch existing user
    const [existingRows] = await masterPool.query(
      'SELECT * FROM rbac_users WHERE id = ?',
      [id]
    );

    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const existingUser = existingRows[0];

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email.trim().toLowerCase());
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone ? phone.trim() : null);
    }

    if (role !== undefined) {
      // Validate role requirements
      const normalizedCollegeIds = collegeIds !== undefined ? collegeIds : parseScopeData(existingUser.college_ids);
      const normalizedCourseIds = courseIds !== undefined ? courseIds : parseScopeData(existingUser.course_ids);
      const normalizedBranchIds = branchIds !== undefined ? branchIds : parseScopeData(existingUser.branch_ids);
      const useAllCourses = allCourses !== undefined ? allCourses : !!existingUser.all_courses;
      const useAllBranches = allBranches !== undefined ? allBranches : !!existingUser.all_branches;

      const roleValidation = validateRoleRequirements(
        role,
        normalizedCollegeIds,
        normalizedCourseIds,
        normalizedBranchIds,
        useAllCourses,
        useAllBranches
      );
      if (!roleValidation.valid) {
        return res.status(400).json({
          success: false,
          message: roleValidation.message
        });
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (collegeId !== undefined) {
      updates.push('college_id = ?');
      params.push(collegeId || null);
    }

    if (courseId !== undefined) {
      updates.push('course_id = ?');
      params.push(courseId || null);
    }

    if (branchId !== undefined) {
      updates.push('branch_id = ?');
      params.push(branchId || null);
    }

    if (collegeIds !== undefined) {
      updates.push('college_ids = CAST(? AS JSON)');
      params.push(JSON.stringify(collegeIds || []));
      // Also update the single college_id for backward compatibility
      if (collegeIds && collegeIds.length > 0) {
        updates.push('college_id = ?');
        params.push(collegeIds[0]);
      }
    }

    if (courseIds !== undefined) {
      updates.push('course_ids = CAST(? AS JSON)');
      params.push(JSON.stringify(courseIds || []));
      // Also update the single course_id for backward compatibility
      if (courseIds && courseIds.length > 0) {
        updates.push('course_id = ?');
        params.push(courseIds[0]);
      }
    }

    if (branchIds !== undefined) {
      updates.push('branch_ids = CAST(? AS JSON)');
      params.push(JSON.stringify(branchIds || []));
      // Also update the single branch_id for backward compatibility
      if (branchIds && branchIds.length > 0) {
        updates.push('branch_id = ?');
        params.push(branchIds[0]);
      }
    }

    if (allCourses !== undefined) {
      updates.push('all_courses = ?');
      params.push(allCourses ? 1 : 0);
    }

    if (allBranches !== undefined) {
      updates.push('all_branches = ?');
      params.push(allBranches ? 1 : 0);
    }

    if (permissions !== undefined) {
      const parsed = parsePermissions(permissions);
      updates.push('permissions = CAST(? AS JSON)');
      params.push(JSON.stringify(parsed));
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await masterPool.query(
      `UPDATE rbac_users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated user
    const [rows] = await masterPool.query(
      `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.username,
          u.role,
          u.college_id,
          u.course_id,
          u.branch_id,
          u.college_ids,
          u.course_ids,
          u.branch_ids,
          u.all_courses,
          u.all_branches,
          u.permissions,
          u.is_active,
          u.created_at,
          u.updated_at,
          c.name as college_name,
          co.name as course_name,
          cb.name as branch_name
        FROM rbac_users u
        LEFT JOIN colleges c ON u.college_id = c.id
        LEFT JOIN courses co ON u.course_id = co.id
        LEFT JOIN course_branches cb ON u.branch_id = cb.id
        WHERE u.id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email,
        phone: rows[0].phone,
        username: rows[0].username,
        role: rows[0].role,
        roleLabel: ROLE_LABELS[rows[0].role] || rows[0].role,
        collegeId: rows[0].college_id,
        courseId: rows[0].course_id,
        branchId: rows[0].branch_id,
        collegeIds: parseScopeData(rows[0].college_ids),
        courseIds: parseScopeData(rows[0].course_ids),
        branchIds: parseScopeData(rows[0].branch_ids),
        allCourses: !!rows[0].all_courses,
        allBranches: !!rows[0].all_branches,
        collegeName: rows[0].college_name,
        courseName: rows[0].course_name,
        branchName: rows[0].branch_name,
        permissions: parsePermissions(rows[0].permissions),
        isActive: !!rows[0].is_active,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at
      }
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
};

/**
 * DELETE /api/rbac/users/:id
 * Delete user (soft delete by setting is_active = false)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await masterPool.query(
      'UPDATE rbac_users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
};

/**
 * DELETE /api/rbac/users/:id/permanent
 * Permanently delete user from database
 */
exports.permanentDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user || req.admin;

    // Only super admin can permanently delete users
    if (!isSuperAdmin(user)) {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can permanently delete users'
      });
    }

    // Check if user exists
    const [userRows] = await masterPool.query(
      'SELECT id, username, role FROM rbac_users WHERE id = ?',
      [id]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUser = userRows[0];

    // Prevent deleting super admin users
    if (targetUser.role === USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete Super Admin users'
      });
    }

    // Permanently delete the user
    const [result] = await masterPool.query(
      'DELETE FROM rbac_users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User permanently deleted'
    });
  } catch (error) {
    console.error('Failed to permanently delete user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
};

/**
 * POST /api/rbac/users/:id/reset-password
 * Reset user password and send email
 */
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Get user details
    const [users] = await masterPool.query(
      'SELECT id, name, email, username, role FROM rbac_users WHERE id = ?',
      [id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await masterPool.query(
      'UPDATE rbac_users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id]
    );

    // Send email with new password
    let emailSent = false;
    let emailError = null;
    try {
      const emailResult = await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        username: user.username,
        newPassword: newPassword,
        role: ROLE_LABELS[user.role] || user.role
      });
      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.message || 'Failed to send email';
        console.error('❌ Email notification failed for password reset:', {
          userId: id,
          email: user.email,
          error: emailError
        });
      }
    } catch (emailErr) {
      emailError = emailErr.message || 'Unexpected error while sending email';
      console.error('❌ Exception while sending password reset email:', {
        userId: id,
        email: user.email,
        error: emailError,
        stack: emailErr.stack
      });
    }

    res.json({
      success: true,
      message: emailSent 
        ? 'Password reset successfully and email sent!' 
        : `Password reset successfully but email could not be sent: ${emailError || 'Unknown error'}`,
      emailSent,
      emailError: emailError || undefined
    });
  } catch (error) {
    console.error('Failed to reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password'
    });
  }
};

/**
 * GET /api/rbac/users/roles/available
 * Get available roles that current user can create
 */
exports.getAvailableRoles = async (req, res) => {
  try {
    const user = req.user || req.admin;
    
    // Convert legacy 'admin' role to 'super_admin' for hierarchy lookup
    const effectiveRole = user.role === 'admin' ? USER_ROLES.SUPER_ADMIN : user.role;
    const availableRoles = ROLE_HIERARCHY[effectiveRole] || [];

    res.json({
      success: true,
      data: availableRoles.map(role => ({
        value: role,
        label: ROLE_LABELS[role] || role,
        requirements: ROLE_REQUIREMENTS[role] || {}
      }))
    });
  } catch (error) {
    console.error('Failed to fetch available roles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available roles'
    });
  }
};

/**
 * GET /api/rbac/users/modules
 * Get all available modules for permissions with granular permission details
 */
exports.getModules = async (req, res) => {
  try {
    const { MODULE_LABELS, MODULE_PERMISSIONS } = require('../constants/rbac');
    
    const modules = ALL_MODULES.map(module => ({
      key: module,
      label: MODULE_LABELS[module] || module,
      permissions: MODULE_PERMISSIONS[module]?.permissions || [],
      permissionLabels: MODULE_PERMISSIONS[module]?.labels || {}
    }));

    res.json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('Failed to fetch modules:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching modules'
    });
  }
};
