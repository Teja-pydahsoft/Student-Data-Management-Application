const { USER_ROLES, canCreateRole, hasPermission, validateRoleRequirements } = require('../constants/rbac');
const { masterPool } = require('../config/database');

/**
 * Check if user is a super admin (including legacy 'admin' role)
 */
const isSuperAdmin = (user) => {
  return user && (user.role === USER_ROLES.SUPER_ADMIN || user.role === 'admin');
};

/**
 * Parse JSON array data from database
 */
const parseArrayData = (data) => {
  if (!data) return [];
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return data ? [data] : [];
  }
};

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

    // Super admin (including legacy 'admin') bypasses all role checks
    if (isSuperAdmin(user)) {
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

    // Super admin (including legacy 'admin') has all permissions
    if (isSuperAdmin(user)) {
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
 * Attach user scope to request
 * This fetches the user's assigned colleges, courses, branches and attaches them
 * for use in filtering queries
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

    // Super admin (including legacy 'admin') has no scope restrictions
    if (isSuperAdmin(user)) {
      req.userScope = {
        collegeIds: [],
        courseIds: [],
        branchIds: [],
        allCourses: true,
        allBranches: true,
        unrestricted: true
      };
      return next();
    }

    // Fetch full user data from database to get scope
    const [rows] = await masterPool.query(
      `SELECT 
        college_id, course_id, branch_id,
        college_ids, course_ids, branch_ids,
        all_courses, all_branches
      FROM rbac_users WHERE id = ?`,
      [user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = rows[0];
    
    // Parse array data from JSON columns
    const collegeIds = parseArrayData(userData.college_ids);
    const courseIds = parseArrayData(userData.course_ids);
    const branchIds = parseArrayData(userData.branch_ids);
    
    // Fall back to single IDs if arrays are empty
    if (collegeIds.length === 0 && userData.college_id) {
      collegeIds.push(userData.college_id);
    }
    if (courseIds.length === 0 && userData.course_id) {
      courseIds.push(userData.course_id);
    }
    if (branchIds.length === 0 && userData.branch_id) {
      branchIds.push(userData.branch_id);
    }

    // Fetch college names for filtering
    let collegeNames = [];
    if (collegeIds.length > 0) {
      const [colleges] = await masterPool.query(
        `SELECT name FROM colleges WHERE id IN (${collegeIds.map(() => '?').join(',')})`,
        collegeIds
      );
      collegeNames = colleges.map(c => c.name);
    }

    // Fetch course names for filtering
    let courseNames = [];
    if (!userData.all_courses && courseIds.length > 0) {
      const [courses] = await masterPool.query(
        `SELECT name FROM courses WHERE id IN (${courseIds.map(() => '?').join(',')})`,
        courseIds
      );
      courseNames = courses.map(c => c.name);
    }

    // Fetch branch names for filtering
    let branchNames = [];
    if (!userData.all_branches && branchIds.length > 0) {
      const [branches] = await masterPool.query(
        `SELECT name FROM course_branches WHERE id IN (${branchIds.map(() => '?').join(',')})`,
        branchIds
      );
      branchNames = branches.map(b => b.name);
    }

    req.userScope = {
      collegeIds,
      courseIds,
      branchIds,
      collegeNames,
      courseNames,
      branchNames,
      allCourses: !!userData.all_courses,
      allBranches: !!userData.all_branches,
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

  // Convert legacy 'admin' role to 'super_admin' for permission check
  const effectiveRole = user.role === 'admin' ? USER_ROLES.SUPER_ADMIN : user.role;

  if (!canCreateRole(effectiveRole, targetRole)) {
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

    // Super admin (including legacy 'admin') can manage anyone
    if (isSuperAdmin(user)) {
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
      'SELECT id, role, college_id, course_id, branch_id, college_ids FROM rbac_users WHERE id = ?',
      [targetUserId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUser = rows[0];
    const targetCollegeIds = parseArrayData(targetUser.college_ids);
    if (targetCollegeIds.length === 0 && targetUser.college_id) {
      targetCollegeIds.push(targetUser.college_id);
    }

    // Fetch current user's scope
    const [userRows] = await masterPool.query(
      'SELECT college_id, course_id, branch_id, college_ids, course_ids, branch_ids FROM rbac_users WHERE id = ?',
      [user.id]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Your user account not found'
      });
    }

    const currentUser = userRows[0];
    const currentCollegeIds = parseArrayData(currentUser.college_ids);
    if (currentCollegeIds.length === 0 && currentUser.college_id) {
      currentCollegeIds.push(currentUser.college_id);
    }

    // College Principal or College AO can manage users in their college
    if (user.role === USER_ROLES.COLLEGE_PRINCIPAL || user.role === USER_ROLES.COLLEGE_AO) {
      const hasOverlap = targetCollegeIds.some(id => currentCollegeIds.includes(id));
      if (!hasOverlap) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage users in your college'
        });
      }
      return next();
    }

    // Branch HOD can manage users in their branch
    if (user.role === USER_ROLES.BRANCH_HOD) {
      const currentBranchIds = parseArrayData(currentUser.branch_ids);
      if (currentBranchIds.length === 0 && currentUser.branch_id) {
        currentBranchIds.push(currentUser.branch_id);
      }
      const targetBranchIds = parseArrayData(targetUser.branch_ids);
      if (targetBranchIds.length === 0 && targetUser.branch_id) {
        targetBranchIds.push(targetUser.branch_id);
      }
      
      const hasOverlap = targetBranchIds.some(id => currentBranchIds.includes(id));
      if (!hasOverlap) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage users in your branch'
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
  isSuperAdmin,
  verifyRole,
  verifyPermission,
  attachUserScope,
  verifyCanCreateRole,
  verifyCanManageUser,
  parseArrayData
};
