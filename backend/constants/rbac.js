/**
 * RBAC Constants
 * Defines user roles, permissions, and hierarchy
 */

// User Roles Hierarchy
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  CAMPUS_PRINCIPAL: 'campus_principal',
  COLLEGE_AO: 'college_ao',
  COURSE_PRINCIPAL: 'course_principal',
  COURSE_AO: 'course_ao',
  HOD: 'hod'
};

// Role Hierarchy (who can create whom)
const ROLE_HIERARCHY = {
  [USER_ROLES.SUPER_ADMIN]: [
    USER_ROLES.CAMPUS_PRINCIPAL,
    USER_ROLES.COLLEGE_AO
  ],
  [USER_ROLES.CAMPUS_PRINCIPAL]: [
    USER_ROLES.COLLEGE_AO,
    USER_ROLES.COURSE_PRINCIPAL
  ],
  [USER_ROLES.COURSE_PRINCIPAL]: [
    USER_ROLES.COURSE_AO,
    USER_ROLES.HOD
  ],
  [USER_ROLES.COLLEGE_AO]: [],
  [USER_ROLES.COURSE_AO]: [],
  [USER_ROLES.HOD]: []
};

// Available Modules
const MODULES = {
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
const ROLE_REQUIREMENTS = {
  [USER_ROLES.SUPER_ADMIN]: {
    requiresCollege: false,
    requiresCourse: false,
    requiresBranch: false
  },
  [USER_ROLES.CAMPUS_PRINCIPAL]: {
    requiresCollege: true,
    requiresCourse: false,
    requiresBranch: false
  },
  [USER_ROLES.COLLEGE_AO]: {
    requiresCollege: true,
    requiresCourse: false,
    requiresBranch: false
  },
  [USER_ROLES.COURSE_PRINCIPAL]: {
    requiresCollege: true,
    requiresCourse: true,
    requiresBranch: false
  },
  [USER_ROLES.COURSE_AO]: {
    requiresCollege: true,
    requiresCourse: true,
    requiresBranch: false
  },
  [USER_ROLES.HOD]: {
    requiresCollege: true,
    requiresCourse: true,
    requiresBranch: true
  }
};

// Validate role requirements
const validateRoleRequirements = (role, collegeId, courseId, branchId) => {
  const requirements = ROLE_REQUIREMENTS[role];
  if (!requirements) {
    return { valid: false, message: 'Invalid role' };
  }

  if (requirements.requiresCollege && !collegeId) {
    return { valid: false, message: `${role} requires a college assignment` };
  }

  if (requirements.requiresCourse && !courseId) {
    return { valid: false, message: `${role} requires a course assignment` };
  }

  if (requirements.requiresBranch && !branchId) {
    return { valid: false, message: `${role} requires a branch assignment` };
  }

  // Ensure NULL values for fields that shouldn't be set
  if (role === USER_ROLES.SUPER_ADMIN && (collegeId || courseId || branchId)) {
    return { valid: false, message: 'Super Admin cannot be assigned to college/course/branch' };
  }

  if ((role === USER_ROLES.CAMPUS_PRINCIPAL || role === USER_ROLES.COLLEGE_AO) && (courseId || branchId)) {
    return { valid: false, message: `${role} cannot be assigned to course or branch` };
  }

  if ((role === USER_ROLES.COURSE_PRINCIPAL || role === USER_ROLES.COURSE_AO) && branchId) {
    return { valid: false, message: `${role} cannot be assigned to branch` };
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

module.exports = {
  USER_ROLES,
  ROLE_HIERARCHY,
  MODULES,
  MODULE_LABELS,
  ALL_MODULES,
  ROLE_REQUIREMENTS,
  createDefaultPermissions,
  createSuperAdminPermissions,
  validateRoleRequirements,
  canCreateRole,
  parsePermissions,
  hasPermission
};

