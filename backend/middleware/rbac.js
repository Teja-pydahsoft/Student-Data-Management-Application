const { USER_ROLES, canCreateRole, hasPermission, validateRoleRequirements } = require('../constants/rbac');
const { masterPool } = require('../config/database');

/**
 * Verify user has required role
 * Usage: verifyRole('super_admin', 'campus_principal')
 */
const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user || req.admin;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin bypasses all role checks
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Verify user has permission for a module
 * Usage: verifyPermission('student_management', 'write')
 */
const verifyPermission = (module, operation = 'read') => {
  return async (req, res, next) => {
    const user = req.user || req.admin;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      return next();
    }

    // Check if user has the required permission
    if (!hasPermission(user.permissions, module, operation)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${module} (${operation})`
      });
    }

    next();
  };
};

/**
 * Attach user scope to request (college_id, course_id, branch_id)
 * This automatically filters data based on user's role and assignments
 */
const attachUserScope = async (req, res, next) => {
  try {
    const user = req.user || req.admin;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has no scope restrictions
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      req.userScope = {
        collegeId: null,
        courseId: null,
        branchId: null,
        unrestricted: true
      };
      return next();
    }

    // Fetch full user data from database to get scope
    const [rows] = await masterPool.query(
      'SELECT college_id, course_id, branch_id FROM rbac_users WHERE id = ?',
      [user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = rows[0];
    
    req.userScope = {
      collegeId: userData.college_id || null,
      courseId: userData.course_id || null,
      branchId: userData.branch_id || null,
      unrestricted: false
    };

    next();
  } catch (error) {
    console.error('Error attaching user scope:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing user scope'
    });
  }
};

/**
 * Verify user can create a specific role
 */
const verifyCanCreateRole = (req, res, next) => {
  const user = req.user || req.admin;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { role: targetRole } = req.body;

  if (!targetRole) {
    return res.status(400).json({
      success: false,
      message: 'Role is required'
    });
  }

  if (!canCreateRole(user.role, targetRole)) {
    return res.status(403).json({
      success: false,
      message: `You do not have permission to create users with role: ${targetRole}`
    });
  }

  next();
};

/**
 * Verify user can manage (edit/delete) another user
 * Rules:
 * - Super admin can manage anyone
 * - Campus Principal can manage users in their college
 * - Course Principal can manage users in their course
 * - Users cannot manage themselves
 */
const verifyCanManageUser = async (req, res, next) => {
  try {
    const user = req.user || req.admin;
    const targetUserId = req.params.id || req.body.id;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin can manage anyone
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Users cannot manage themselves
    if (user.id === parseInt(targetUserId)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot manage your own account'
      });
    }

    // Fetch target user
    const [rows] = await masterPool.query(
      'SELECT id, role, college_id, course_id, branch_id FROM rbac_users WHERE id = ?',
      [targetUserId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUser = rows[0];

    // Fetch current user's scope
    const [userRows] = await masterPool.query(
      'SELECT college_id, course_id, branch_id FROM rbac_users WHERE id = ?',
      [user.id]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Your user account not found'
      });
    }

    const currentUser = userRows[0];

    // Campus Principal can manage users in their college
    if (user.role === USER_ROLES.CAMPUS_PRINCIPAL) {
      if (targetUser.college_id !== currentUser.college_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage users in your college'
        });
      }
      return next();
    }

    // Course Principal can manage users in their course
    if (user.role === USER_ROLES.COURSE_PRINCIPAL) {
      if (targetUser.course_id !== currentUser.course_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage users in your course'
        });
      }
      return next();
    }

    // Default: no permission
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to manage this user'
    });
  } catch (error) {
    console.error('Error verifying user management permission:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying permissions'
    });
  }
};

module.exports = {
  verifyRole,
  verifyPermission,
  attachUserScope,
  verifyCanCreateRole,
  verifyCanManageUser
};

