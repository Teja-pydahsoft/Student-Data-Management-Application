/**
 * RBAC Constants
 * Defines user roles, permissions, and hierarchy
 */

// User Roles Hierarchy
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  COLLEGE_PRINCIPAL: 'college_principal',
  COLLEGE_AO: 'college_ao',
  COLLEGE_ATTENDER: 'college_attender',
  BRANCH_HOD: 'branch_hod'
};

// Role Hierarchy (who can create whom)
const ROLE_HIERARCHY = {
  [USER_ROLES.SUPER_ADMIN]: [
    USER_ROLES.COLLEGE_PRINCIPAL,
    USER_ROLES.COLLEGE_AO,
    USER_ROLES.COLLEGE_ATTENDER,
    USER_ROLES.BRANCH_HOD
  ],
  [USER_ROLES.COLLEGE_PRINCIPAL]: [
    USER_ROLES.COLLEGE_AO,
    USER_ROLES.COLLEGE_ATTENDER,
    USER_ROLES.BRANCH_HOD
  ],
  [USER_ROLES.COLLEGE_AO]: [
    USER_ROLES.COLLEGE_ATTENDER,
    USER_ROLES.BRANCH_HOD
  ],
  [USER_ROLES.BRANCH_HOD]: [
    USER_ROLES.COLLEGE_ATTENDER
  ],
  [USER_ROLES.COLLEGE_ATTENDER]: []
};

// Available Modules
const MODULES = {
  DASHBOARD: 'dashboard',
  PRE_REGISTRATION: 'pre_registration',
  STUDENT_MANAGEMENT: 'student_management',
  EXPORT_STUDENTS: 'export_students',
  UPLOAD_STUDENTS: 'upload_students',
  EDIT_STUDENT: 'edit_student',
  DELETE_STUDENT: 'delete_student',
  PROMOTIONS: 'promotions',
  ATTENDANCE: 'attendance',
  SETTINGS: 'settings',
  CAMPUS_CRUD: 'campus_crud',
  USER_MANAGEMENT: 'user_management',
  REPORTS: 'reports'
};

// Module Labels for UI
const MODULE_LABELS = {
  [MODULES.DASHBOARD]: 'Dashboard',
  [MODULES.PRE_REGISTRATION]: 'Pre-Registration',
  [MODULES.STUDENT_MANAGEMENT]: 'Student Management',
  [MODULES.EXPORT_STUDENTS]: 'Export Students',
  [MODULES.UPLOAD_STUDENTS]: 'Upload Students',
  [MODULES.EDIT_STUDENT]: 'Edit Student',
  [MODULES.DELETE_STUDENT]: 'Delete Student',
  [MODULES.PROMOTIONS]: 'Promotions',
  [MODULES.ATTENDANCE]: 'Attendance',
  [MODULES.SETTINGS]: 'Settings',
  [MODULES.CAMPUS_CRUD]: 'Campus, Courses, Branches CRUD',
  [MODULES.USER_MANAGEMENT]: 'User Management',
  [MODULES.REPORTS]: 'Reports'
};

// All modules as array
const ALL_MODULES = Object.values(MODULES);

// Default permissions structure
const createDefaultPermissions = () => {
  const permissions = {};
  ALL_MODULES.forEach(module => {
    permissions[module] = { read: false, write: false };
  });
  return permissions;
};

// Super Admin gets all permissions
const createSuperAdminPermissions = () => {
  const permissions = {};
  ALL_MODULES.forEach(module => {
    permissions[module] = { read: true, write: true };
  });
  return permissions;
};

// Role requirements for college/course/branch
// Now supports multi-select with arrays
const ROLE_REQUIREMENTS = {
  [USER_ROLES.SUPER_ADMIN]: {
    requiresCollege: false,
    requiresCourse: false,
    requiresBranch: false,
    supportsMultiCollege: false,
    supportsMultiCourse: false,
    supportsMultiBranch: false,
    supportsAllCourses: false,
    supportsAllBranches: false
  },
  [USER_ROLES.COLLEGE_PRINCIPAL]: {
    requiresCollege: true,
    requiresCourse: false,
    requiresBranch: false,
    supportsMultiCollege: true,
    supportsMultiCourse: true,
    supportsMultiBranch: true,
    supportsAllCourses: true,
    supportsAllBranches: true
  },
  [USER_ROLES.COLLEGE_AO]: {
    requiresCollege: true,
    requiresCourse: false,
    requiresBranch: false,
    supportsMultiCollege: true,
    supportsMultiCourse: true,
    supportsMultiBranch: true,
    supportsAllCourses: true,
    supportsAllBranches: true
  },
  [USER_ROLES.COLLEGE_ATTENDER]: {
    requiresCollege: true,
    requiresCourse: false,
    requiresBranch: false,
    supportsMultiCollege: true,
    supportsMultiCourse: true,
    supportsMultiBranch: true,
    supportsAllCourses: true,
    supportsAllBranches: true
  },
  [USER_ROLES.BRANCH_HOD]: {
    requiresCollege: true,
    requiresCourse: true,
    requiresBranch: true,
    supportsMultiCollege: true,
    supportsMultiCourse: true,
    supportsMultiBranch: true,
    supportsAllCourses: false,
    supportsAllBranches: false
  }
};

// Validate role requirements (updated for multi-select)
const validateRoleRequirements = (role, collegeIds, courseIds, branchIds, allCourses = false, allBranches = false) => {
  const requirements = ROLE_REQUIREMENTS[role];
  if (!requirements) {
    return { valid: false, message: 'Invalid role' };
  }

  // Normalize to arrays
  const colleges = Array.isArray(collegeIds) ? collegeIds : (collegeIds ? [collegeIds] : []);
  const courses = Array.isArray(courseIds) ? courseIds : (courseIds ? [courseIds] : []);
  const branches = Array.isArray(branchIds) ? branchIds : (branchIds ? [branchIds] : []);

  if (requirements.requiresCollege && colleges.length === 0) {
    return { valid: false, message: `${role} requires at least one college assignment` };
  }

  if (requirements.requiresCourse && !allCourses && courses.length === 0) {
    return { valid: false, message: `${role} requires at least one course assignment or "All Courses"` };
  }

  if (requirements.requiresBranch && !allBranches && branches.length === 0) {
    return { valid: false, message: `${role} requires at least one branch assignment or "All Branches"` };
  }

  // Ensure NULL values for fields that shouldn't be set
  if (role === USER_ROLES.SUPER_ADMIN && (colleges.length > 0 || courses.length > 0 || branches.length > 0)) {
    return { valid: false, message: 'Super Admin cannot be assigned to college/course/branch' };
  }

  return { valid: true };
};

// Check if a role can create another role
const canCreateRole = (creatorRole, targetRole) => {
  const allowedRoles = ROLE_HIERARCHY[creatorRole] || [];
  return allowedRoles.includes(targetRole);
};

// Parse permissions from JSON
const parsePermissions = (permissionsJson) => {
  if (!permissionsJson) return createDefaultPermissions();
  
  try {
    const parsed = typeof permissionsJson === 'string' 
      ? JSON.parse(permissionsJson) 
      : permissionsJson;
    
    // Ensure all modules exist
    const permissions = createDefaultPermissions();
    Object.keys(parsed).forEach(module => {
      if (ALL_MODULES.includes(module)) {
        permissions[module] = {
          read: !!parsed[module]?.read,
          write: !!parsed[module]?.write
        };
      }
    });
    
    return permissions;
  } catch (error) {
    console.error('Error parsing permissions:', error);
    return createDefaultPermissions();
  }
};

// Check if user has permission for a module
const hasPermission = (userPermissions, module, operation = 'read') => {
  const permissions = parsePermissions(userPermissions);
  const modulePerms = permissions[module];
  if (!modulePerms) return false;
  
  if (operation === 'write') {
    return modulePerms.write === true;
  }
  return modulePerms.read === true || modulePerms.write === true;
};

// Role Labels for UI display
const ROLE_LABELS = {
  [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
  [USER_ROLES.COLLEGE_PRINCIPAL]: 'College Principal',
  [USER_ROLES.COLLEGE_AO]: 'College AO',
  [USER_ROLES.COLLEGE_ATTENDER]: 'College Attender',
  [USER_ROLES.BRANCH_HOD]: 'Branch HOD'
};

module.exports = {
  USER_ROLES,
  ROLE_HIERARCHY,
  MODULES,
  MODULE_LABELS,
  ALL_MODULES,
  ROLE_REQUIREMENTS,
  ROLE_LABELS,
  createDefaultPermissions,
  createSuperAdminPermissions,
  validateRoleRequirements,
  canCreateRole,
  parsePermissions,
  hasPermission
};
