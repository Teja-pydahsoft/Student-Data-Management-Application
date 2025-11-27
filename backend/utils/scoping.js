const { USER_ROLES } = require('../constants/rbac');

/**
 * Build SQL conditions for user scope filtering
 * This ensures users only see data within their assigned scope
 * 
 * @param {Object} userScope - User scope from attachUserScope middleware
 * @param {string} tableAlias - Table alias for the query (default: 's' for students)
 * @returns {Object} - { conditions: array, params: array }
 */
function buildScopeConditions(userScope, tableAlias = 's') {
  // Super admin has no restrictions
  if (userScope.unrestricted) {
    return {
      conditions: [],
      params: []
    };
  }

  const conditions = [];
  const params = [];

  // Apply college filter using names (since students table stores college name)
  if (userScope.collegeNames && userScope.collegeNames.length > 0) {
    const placeholders = userScope.collegeNames.map(() => '?').join(',');
    conditions.push(`${tableAlias}.college IN (${placeholders})`);
    params.push(...userScope.collegeNames);
  } else if (userScope.collegeIds && userScope.collegeIds.length > 0) {
    // Fallback: get college names from IDs via subquery
    const placeholders = userScope.collegeIds.map(() => '?').join(',');
    conditions.push(`${tableAlias}.college IN (SELECT name FROM colleges WHERE id IN (${placeholders}))`);
    params.push(...userScope.collegeIds);
  }

  // Apply course filter (only if not "all courses")
  if (!userScope.allCourses) {
    if (userScope.courseNames && userScope.courseNames.length > 0) {
      const placeholders = userScope.courseNames.map(() => '?').join(',');
      conditions.push(`${tableAlias}.course IN (${placeholders})`);
      params.push(...userScope.courseNames);
    } else if (userScope.courseIds && userScope.courseIds.length > 0) {
      const placeholders = userScope.courseIds.map(() => '?').join(',');
      conditions.push(`${tableAlias}.course IN (SELECT name FROM courses WHERE id IN (${placeholders}))`);
      params.push(...userScope.courseIds);
    }
  }

  // Apply branch filter (only if not "all branches")
  if (!userScope.allBranches) {
    if (userScope.branchNames && userScope.branchNames.length > 0) {
      const placeholders = userScope.branchNames.map(() => '?').join(',');
      conditions.push(`${tableAlias}.branch IN (${placeholders})`);
      params.push(...userScope.branchNames);
    } else if (userScope.branchIds && userScope.branchIds.length > 0) {
      const placeholders = userScope.branchIds.map(() => '?').join(',');
      conditions.push(`${tableAlias}.branch IN (SELECT name FROM course_branches WHERE id IN (${placeholders}))`);
      params.push(...userScope.branchIds);
    }
  }

  return { conditions, params };
}

/**
 * Apply user scope filters to a query (legacy function for backward compatibility)
 * @param {Object} userScope - User scope from attachUserScope middleware
 * @param {string} tableAlias - Table alias for the query (default: 's' for students)
 * @returns {Object} - { whereClause: string, params: array }
 */
function applyUserScope(userScope, tableAlias = 's') {
  const { conditions, params } = buildScopeConditions(userScope, tableAlias);
  
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return { whereClause, params };
}

/**
 * Get scope conditions as AND-joined string for appending to existing WHERE clause
 * @param {Object} userScope - User scope from attachUserScope middleware
 * @param {string} tableAlias - Table alias for the query (default: 's' for students)
 * @returns {Object} - { scopeCondition: string, params: array }
 */
function getScopeConditionString(userScope, tableAlias = 's') {
  const { conditions, params } = buildScopeConditions(userScope, tableAlias);
  
  const scopeCondition = conditions.length > 0 
    ? conditions.join(' AND ')
    : '';

  return { scopeCondition, params };
}

/**
 * Get scope description for display/logging
 */
function getScopeDescription(userScope) {
  if (userScope.unrestricted) {
    return 'All data (Super Admin)';
  }

  const parts = [];
  if (userScope.collegeNames && userScope.collegeNames.length > 0) {
    parts.push(`Colleges: ${userScope.collegeNames.join(', ')}`);
  }
  if (!userScope.allCourses && userScope.courseNames && userScope.courseNames.length > 0) {
    parts.push(`Courses: ${userScope.courseNames.join(', ')}`);
  } else if (userScope.allCourses) {
    parts.push('All Courses');
  }
  if (!userScope.allBranches && userScope.branchNames && userScope.branchNames.length > 0) {
    parts.push(`Branches: ${userScope.branchNames.join(', ')}`);
  } else if (userScope.allBranches) {
    parts.push('All Branches');
  }

  return parts.length > 0 ? parts.join(', ') : 'No scope restrictions';
}

/**
 * Check if user can access a specific college
 */
function canAccessCollege(userScope, collegeName) {
  if (userScope.unrestricted) return true;
  if (!userScope.collegeNames || userScope.collegeNames.length === 0) return false;
  return userScope.collegeNames.includes(collegeName);
}

/**
 * Check if user can access a specific course
 */
function canAccessCourse(userScope, courseName) {
  if (userScope.unrestricted) return true;
  if (userScope.allCourses) return true;
  if (!userScope.courseNames || userScope.courseNames.length === 0) return false;
  return userScope.courseNames.includes(courseName);
}

/**
 * Check if user can access a specific branch
 */
function canAccessBranch(userScope, branchName) {
  if (userScope.unrestricted) return true;
  if (userScope.allBranches) return true;
  if (!userScope.branchNames || userScope.branchNames.length === 0) return false;
  return userScope.branchNames.includes(branchName);
}

/**
 * Filter colleges list based on user scope
 */
function filterCollegesByScope(colleges, userScope) {
  if (userScope.unrestricted) return colleges;
  if (!userScope.collegeIds || userScope.collegeIds.length === 0) return [];
  return colleges.filter(c => userScope.collegeIds.includes(c.id));
}

/**
 * Filter courses list based on user scope
 */
function filterCoursesByScope(courses, userScope) {
  if (userScope.unrestricted) return courses;
  if (userScope.allCourses) return courses;
  if (!userScope.courseIds || userScope.courseIds.length === 0) return [];
  return courses.filter(c => userScope.courseIds.includes(c.id));
}

/**
 * Filter branches list based on user scope
 */
function filterBranchesByScope(branches, userScope) {
  if (userScope.unrestricted) return branches;
  if (userScope.allBranches) return branches;
  if (!userScope.branchIds || userScope.branchIds.length === 0) return [];
  return branches.filter(b => userScope.branchIds.includes(b.id));
}

module.exports = {
  applyUserScope,
  buildScopeConditions,
  getScopeConditionString,
  getScopeDescription,
  canAccessCollege,
  canAccessCourse,
  canAccessBranch,
  filterCollegesByScope,
  filterCoursesByScope,
  filterBranchesByScope
};
