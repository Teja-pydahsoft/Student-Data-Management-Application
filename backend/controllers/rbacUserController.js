const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { masterPool } = require('../config/database');
const {
  USER_ROLES,
  validateRoleRequirements,
  canCreateRole,
  parsePermissions,
  createDefaultPermissions,
  createSuperAdminPermissions,
  MODULES,
  ALL_MODULES
} = require('../constants/rbac');

/**
 * Generate a random password
 */
const generatePassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
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
        u.college_id,
        u.course_id,
        u.branch_id,
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
    `;
    const params = [];
    const conditions = [];

    // Super admin sees all users
    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      // Campus Principal sees users in their college
      if (user.role === USER_ROLES.CAMPUS_PRINCIPAL) {
        const [userRows] = await masterPool.query(
          'SELECT college_id FROM rbac_users WHERE id = ?',
          [user.id]
        );
        if (userRows && userRows.length > 0 && userRows[0].college_id) {
          conditions.push('u.college_id = ?');
          params.push(userRows[0].college_id);
        }
      }
      // Course Principal sees users in their course
      else if (user.role === USER_ROLES.COURSE_PRINCIPAL) {
        const [userRows] = await masterPool.query(
          'SELECT course_id FROM rbac_users WHERE id = ?',
          [user.id]
        );
        if (userRows && userRows.length > 0 && userRows[0].course_id) {
          conditions.push('u.course_id = ?');
          params.push(userRows[0].course_id);
        }
      }
      // HOD sees only users in their branch
      else if (user.role === USER_ROLES.HOD) {
        const [userRows] = await masterPool.query(
          'SELECT branch_id FROM rbac_users WHERE id = ?',
          [user.id]
        );
        if (userRows && userRows.length > 0 && userRows[0].branch_id) {
          conditions.push('u.branch_id = ?');
          params.push(userRows[0].branch_id);
        }
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY u.created_at DESC';

    const [rows] = await masterPool.query(query, params);

    const users = rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      username: row.username,
      role: row.role,
      collegeId: row.college_id,
      courseId: row.course_id,
      branchId: row.branch_id,
      collegeName: row.college_name,
      courseName: row.course_name,
      branchName: row.branch_name,
      permissions: parsePermissions(row.permissions),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
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
    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      if (user.role === USER_ROLES.CAMPUS_PRINCIPAL && userData.college_id !== user.collegeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      if (user.role === USER_ROLES.COURSE_PRINCIPAL && userData.course_id !== user.courseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      if (user.role === USER_ROLES.HOD && userData.branch_id !== user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        username: userData.username,
        role: userData.role,
        collegeId: userData.college_id,
        courseId: userData.course_id,
        branchId: userData.branch_id,
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
      role,
      collegeId,
      courseId,
      branchId,
      permissions
    } = req.body;

    // Validate required fields
    if (!name || !email || !username || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, username, and role are required'
      });
    }

    // Validate role requirements
    const roleValidation = validateRoleRequirements(role, collegeId, courseId, branchId);
    if (!roleValidation.valid) {
      return res.status(400).json({
        success: false,
        message: roleValidation.message
      });
    }

    // Check if creator can create this role
    if (!canCreateRole(creator.role, role)) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to create users with role: ${role}`
      });
    }

    // Validate scope restrictions
    if (creator.role !== USER_ROLES.SUPER_ADMIN) {
      // Campus Principal can only create users in their college
      if (creator.role === USER_ROLES.CAMPUS_PRINCIPAL) {
        const [userRows] = await masterPool.query(
          'SELECT college_id FROM rbac_users WHERE id = ?',
          [creator.id]
        );
        if (userRows && userRows.length > 0 && userRows[0].college_id !== collegeId) {
          return res.status(403).json({
            success: false,
            message: 'You can only create users in your college'
          });
        }
      }
      // Course Principal can only create users in their course
      else if (creator.role === USER_ROLES.COURSE_PRINCIPAL) {
        const [userRows] = await masterPool.query(
          'SELECT course_id FROM rbac_users WHERE id = ?',
          [creator.id]
        );
        if (userRows && userRows.length > 0 && userRows[0].course_id !== courseId) {
          return res.status(403).json({
            success: false,
            message: 'You can only create users in your course'
          });
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

    // Generate password
    const generatedPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

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

    // Insert user
    const [result] = await masterPool.query(
      `
        INSERT INTO rbac_users 
          (name, email, phone, username, password, role, college_id, course_id, branch_id, permissions, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)
      `,
      [
        name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        username.trim(),
        hashedPassword,
        role,
        collegeId || null,
        courseId || null,
        branchId || null,
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

    // TODO: Send email notification with password
    // For now, return password in response (remove in production)
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        username: newUser.username,
        role: newUser.role,
        collegeId: newUser.college_id,
        courseId: newUser.course_id,
        branchId: newUser.branch_id,
        collegeName: newUser.college_name,
        courseName: newUser.course_name,
        branchName: newUser.branch_name,
        permissions: parsePermissions(newUser.permissions),
        isActive: !!newUser.is_active,
        createdAt: newUser.created_at,
        updatedAt: newUser.updated_at
      },
      // TODO: Remove this in production - send via email instead
      password: generatedPassword
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
      const roleValidation = validateRoleRequirements(
        role,
        collegeId !== undefined ? collegeId : existingUser.college_id,
        courseId !== undefined ? courseId : existingUser.course_id,
        branchId !== undefined ? branchId : existingUser.branch_id
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
        collegeId: rows[0].college_id,
        courseId: rows[0].course_id,
        branchId: rows[0].branch_id,
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
 * GET /api/rbac/users/roles/available
 * Get available roles that current user can create
 */
exports.getAvailableRoles = async (req, res) => {
  try {
    const user = req.user || req.admin;
    const { ROLE_HIERARCHY, USER_ROLES } = require('../constants/rbac');
    
    const availableRoles = ROLE_HIERARCHY[user.role] || [];
    
    const roleLabels = {
      [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
      [USER_ROLES.CAMPUS_PRINCIPAL]: 'Campus Principal',
      [USER_ROLES.COLLEGE_AO]: 'College AO',
      [USER_ROLES.COURSE_PRINCIPAL]: 'Course Principal',
      [USER_ROLES.COURSE_AO]: 'Course AO',
      [USER_ROLES.HOD]: 'HOD'
    };

    res.json({
      success: true,
      data: availableRoles.map(role => ({
        value: role,
        label: roleLabels[role] || role
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
 * Get all available modules for permissions
 */
exports.getModules = async (req, res) => {
  try {
    const { MODULES, MODULE_LABELS } = require('../constants/rbac');
    
    const modules = ALL_MODULES.map(module => ({
      key: module,
      label: MODULE_LABELS[module] || module
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

