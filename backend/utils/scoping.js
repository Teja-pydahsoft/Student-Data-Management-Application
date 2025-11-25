const { USER_ROLES } = require('../constants/rbac');

/**
 * Apply user scope filters to a query
 * This ensures users only see data within their assigned scope
 * 
 * @param {Object} userScope - User scope from attachUserScope middleware
 * @param {string} tableAlias - Table alias for the query (default: 's' for students)
 * @returns {Object} - { whereClause: string, params: array }
 */
function applyUserScope(userScope, tableAlias = 's') {
  // Super admin has no restrictions
  if (userScope.unrestricted) {
    return {
      whereClause: '',
      params: []
    };
  }

  const conditions = [];
  const params = [];

  // Apply college filter
  if (userScope.collegeId) {
    conditions.push(`${tableAlias}.college = (SELECT name FROM colleges WHERE id = ?)`);
    params.push(userScope.collegeId);
  }

  // Apply course filter
  if (userScope.courseId) {
    conditions.push(`${tableAlias}.course = (SELECT name FROM courses WHERE id = ?)`);
    params.push(userScope.courseId);
  }

  // Apply branch filter
  if (userScope.branchId) {
    conditions.push(`${tableAlias}.branch = (SELECT name FROM course_branches WHERE id = ?)`);
    params.push(userScope.branchId);
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return { whereClause, params };
}

/**
 * Get scope description for display/logging
 */
function getScopeDescription(userScope) {
  if (userScope.unrestricted) {
    return 'All data (Super Admin)';
  }

  const parts = [];
  if (userScope.collegeId) parts.push(`College: ${userScope.collegeId}`);
  if (userScope.courseId) parts.push(`Course: ${userScope.courseId}`);
  if (userScope.branchId) parts.push(`Branch: ${userScope.branchId}`);

  return parts.length > 0 ? parts.join(', ') : 'No scope restrictions';
}

/**
 * Check if user can access a specific college
 */
function canAccessCollege(userScope, collegeId) {
  if (userScope.unrestricted) return true;
  return userScope.collegeId === collegeId;
}

/**
 * Check if user can access a specific course
 */
function canAccessCourse(userScope, courseId) {
  if (userScope.unrestricted) return true;
  if (!userScope.collegeId) return false;
  return userScope.courseId === courseId;
}

/**
 * Check if user can access a specific branch
 */
function canAccessBranch(userScope, branchId) {
  if (userScope.unrestricted) return true;
  if (!userScope.collegeId || !userScope.courseId) return false;
  return userScope.branchId === branchId;
}

module.exports = {
  applyUserScope,
  getScopeDescription,
  canAccessCollege,
  canAccessCourse,
  canAccessBranch
};

