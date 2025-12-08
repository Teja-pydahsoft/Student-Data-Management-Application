/**
 * Frontend RBAC Constants
 * Maps backend module keys to frontend navigation items
 * Supports granular permissions per module
 */

// Backend module keys (from backend/constants/rbac.js)
export const BACKEND_MODULES = {
  DASHBOARD: 'dashboard',
  PRE_REGISTRATION: 'pre_registration',
  STUDENT_MANAGEMENT: 'student_management',
  PROMOTIONS: 'promotions',
  ATTENDANCE: 'attendance',
  FEE_MANAGEMENT: 'fee_management',
  SETTINGS: 'settings',
  USER_MANAGEMENT: 'user_management',
  REPORTS: 'reports'
};

// Granular Permissions for each module
export const MODULE_PERMISSIONS = {
  [BACKEND_MODULES.DASHBOARD]: {
    permissions: ['view'],
    labels: {
      view: 'View Dashboard'
    }
  },
  [BACKEND_MODULES.PRE_REGISTRATION]: {
    permissions: ['add_student', 'bulk_upload', 'approve', 'reject'],
    labels: {
      add_student: 'Add Student',
      bulk_upload: 'Bulk Upload',
      approve: 'Approve Submissions',
      reject: 'Reject Submissions'
    }
  },
  [BACKEND_MODULES.STUDENT_MANAGEMENT]: {
    permissions: ['view', 'add_student', 'bulk_upload', 'edit_student', 'delete_student', 'update_pin', 'export'],
    labels: {
      view: 'View Students',
      add_student: 'Add Student',
      bulk_upload: 'Bulk Upload',
      edit_student: 'Edit Students',
      delete_student: 'Delete Students',
      update_pin: 'Update PIN Number',
      export: 'Export Students'
    }
  },
  [BACKEND_MODULES.PROMOTIONS]: {
    permissions: ['view', 'manage'],
    labels: {
      view: 'View Promotions',
      manage: 'Manage Promotions'
    }
  },
  [BACKEND_MODULES.ATTENDANCE]: {
    permissions: ['view', 'mark', 'download'],
    labels: {
      view: 'View Attendance',
      mark: 'Mark Attendance',
      download: 'Download Reports'
    }
  },
  [BACKEND_MODULES.FEE_MANAGEMENT]: {
    permissions: ['view', 'write'],
    labels: {
      view: 'View Fees',
      write: 'Manage Fees'
    }
  },
  [BACKEND_MODULES.SETTINGS]: {
    permissions: ['view', 'edit'],
    labels: {
      view: 'View Settings',
      edit: 'Edit Settings'
    }
  },
  [BACKEND_MODULES.USER_MANAGEMENT]: {
    permissions: ['view', 'control'],
    labels: {
      view: 'View Users',
      control: 'Manage Users'
    }
  },
  [BACKEND_MODULES.REPORTS]: {
    permissions: ['view', 'download'],
    labels: {
      view: 'View Reports',
      download: 'Download Reports'
    }
  }
};

// Module Labels for UI
export const MODULE_LABELS = {
  [BACKEND_MODULES.DASHBOARD]: 'Dashboard',
  [BACKEND_MODULES.PRE_REGISTRATION]: 'Self Registration',
  [BACKEND_MODULES.STUDENT_MANAGEMENT]: 'Student Management',
  [BACKEND_MODULES.PROMOTIONS]: 'Promotions',
  [BACKEND_MODULES.ATTENDANCE]: 'Attendance',
  [BACKEND_MODULES.SETTINGS]: 'Settings',
  [BACKEND_MODULES.USER_MANAGEMENT]: 'User Management',
  [BACKEND_MODULES.REPORTS]: 'Reports'
};

// Frontend navigation keys
export const FRONTEND_MODULES = {
  DASHBOARD: 'dashboard',
  FORMS: 'forms',
  SUBMISSIONS: 'submissions',
  STUDENTS: 'students',
  PROMOTIONS: 'promotions',
  ATTENDANCE: 'attendance',
  FEES: 'fees',
  COURSES: 'courses',
  USERS: 'users',
  REPORTS: 'reports'
};

// Map frontend navigation keys to backend permission keys
export const FRONTEND_TO_BACKEND_MAP = {
  [FRONTEND_MODULES.DASHBOARD]: [BACKEND_MODULES.DASHBOARD],
  [FRONTEND_MODULES.FORMS]: [BACKEND_MODULES.PRE_REGISTRATION],
  [FRONTEND_MODULES.SUBMISSIONS]: [BACKEND_MODULES.PRE_REGISTRATION],
  [FRONTEND_MODULES.STUDENTS]: [BACKEND_MODULES.STUDENT_MANAGEMENT],
  [FRONTEND_MODULES.PROMOTIONS]: [BACKEND_MODULES.PROMOTIONS],
  [FRONTEND_MODULES.ATTENDANCE]: [BACKEND_MODULES.ATTENDANCE],
  [FRONTEND_MODULES.FEES]: [BACKEND_MODULES.FEE_MANAGEMENT],
  [FRONTEND_MODULES.COURSES]: [BACKEND_MODULES.SETTINGS],
  [FRONTEND_MODULES.USERS]: [BACKEND_MODULES.USER_MANAGEMENT],
  [FRONTEND_MODULES.REPORTS]: [BACKEND_MODULES.REPORTS]
};

// Map backend module keys to frontend navigation keys (reverse mapping)
export const BACKEND_TO_FRONTEND_MAP = {
  [BACKEND_MODULES.DASHBOARD]: FRONTEND_MODULES.DASHBOARD,
  [BACKEND_MODULES.PRE_REGISTRATION]: [FRONTEND_MODULES.FORMS, FRONTEND_MODULES.SUBMISSIONS],
  [BACKEND_MODULES.STUDENT_MANAGEMENT]: FRONTEND_MODULES.STUDENTS,
  [BACKEND_MODULES.PROMOTIONS]: FRONTEND_MODULES.PROMOTIONS,
  [BACKEND_MODULES.ATTENDANCE]: FRONTEND_MODULES.ATTENDANCE,
  [BACKEND_MODULES.FEE_MANAGEMENT]: FRONTEND_MODULES.FEES,
  [BACKEND_MODULES.SETTINGS]: FRONTEND_MODULES.COURSES,
  [BACKEND_MODULES.USER_MANAGEMENT]: FRONTEND_MODULES.USERS,
  [BACKEND_MODULES.REPORTS]: FRONTEND_MODULES.REPORTS
};

// Route map for navigation
export const MODULE_ROUTE_MAP = {
  [FRONTEND_MODULES.DASHBOARD]: '/',
  [FRONTEND_MODULES.FORMS]: '/forms',
  [FRONTEND_MODULES.SUBMISSIONS]: '/students/self-registration',
  [FRONTEND_MODULES.STUDENTS]: '/students',
  [FRONTEND_MODULES.PROMOTIONS]: '/promotions',
  [FRONTEND_MODULES.ATTENDANCE]: '/attendance',
  [FRONTEND_MODULES.FEES]: '/fees',
  [FRONTEND_MODULES.COURSES]: '/courses',
  [FRONTEND_MODULES.USERS]: '/users',
  [FRONTEND_MODULES.REPORTS]: '/reports'
};

// Get module key from path
export const getModuleKeyForPath = (path = '/') => {
  if (path === '/' || path.startsWith('/dashboard')) return FRONTEND_MODULES.DASHBOARD;
  if (path.startsWith('/forms')) return FRONTEND_MODULES.FORMS;
  if (path.startsWith('/students/self-registration')) return FRONTEND_MODULES.SUBMISSIONS;
  if (path.startsWith('/students')) return FRONTEND_MODULES.STUDENTS;
  if (path.startsWith('/promotions')) return FRONTEND_MODULES.PROMOTIONS;
  if (path.startsWith('/attendance')) return FRONTEND_MODULES.ATTENDANCE;
  if (path.startsWith('/courses')) return FRONTEND_MODULES.COURSES;
  if (path.startsWith('/users')) return FRONTEND_MODULES.USERS;
  if (path.startsWith('/reports')) return FRONTEND_MODULES.REPORTS;
  return null;
};

/**
 * Check if user has access to a frontend module based on backend permissions
 * @param {Object} permissions - User's permissions object from backend
 * @param {string} frontendModule - Frontend module key to check
 * @returns {boolean} - Whether user has any access
 */
export const hasModuleAccess = (permissions, frontendModule) => {
  if (!permissions || !frontendModule) return false;
  
  const backendModules = FRONTEND_TO_BACKEND_MAP[frontendModule];
  if (!backendModules || backendModules.length === 0) return false;
  
  // User has access if ANY of the required backend permissions have any true permission
  return backendModules.some(backendModule => {
    const perm = permissions[backendModule];
    if (!perm) return false;
    return Object.values(perm).some(val => val === true);
  });
};

/**
 * Check if user has a specific permission for a module
 * @param {Object} permissions - User's permissions object from backend
 * @param {string} module - Backend module key
 * @param {string} action - Specific action to check (e.g., 'approve', 'reject', 'edit')
 * @returns {boolean} - Whether user has that specific permission
 */
export const hasPermission = (permissions, module, action) => {
  if (!permissions || !module || !action) return false;
  
  const modulePerm = permissions[module];
  if (!modulePerm) return false;
  
  return modulePerm[action] === true;
};

/**
 * Get all frontend modules user has access to based on backend permissions
 * @param {Object} permissions - User's permissions object from backend
 * @returns {string[]} - Array of frontend module keys user can access
 */
export const getAllowedFrontendModules = (permissions) => {
  if (!permissions) return [];
  
  const allowedModules = [];
  
  Object.keys(FRONTEND_TO_BACKEND_MAP).forEach(frontendModule => {
    if (hasModuleAccess(permissions, frontendModule)) {
      allowedModules.push(frontendModule);
    }
  });
  
  return allowedModules;
};

/**
 * Check if user has write/manage permission for a frontend module
 * @param {Object} permissions - User's permissions object from backend
 * @param {string} frontendModule - Frontend module key to check
 * @returns {boolean} - Whether user has write/manage access
 */
export const hasWriteAccess = (permissions, frontendModule) => {
  if (!permissions || !frontendModule) return false;
  
  const backendModules = FRONTEND_TO_BACKEND_MAP[frontendModule];
  if (!backendModules || backendModules.length === 0) return false;
  
  // Check for write-type permissions (edit, control, manage, etc.)
  const writeActions = ['edit', 'control', 'manage', 'add_student', 'bulk_upload', 'delete_student', 'approve', 'reject', 'mark'];
  
  return backendModules.some(backendModule => {
    const perm = permissions[backendModule];
    if (!perm) return false;
    return writeActions.some(action => perm[action] === true);
  });
};

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin', // Legacy admin role
  COLLEGE_PRINCIPAL: 'college_principal',
  COLLEGE_AO: 'college_ao',
  COLLEGE_ATTENDER: 'college_attender',
  BRANCH_HOD: 'branch_hod',
  STAFF: 'staff' // Legacy staff role
};

// Role Labels for UI display
export const ROLE_LABELS = {
  [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.COLLEGE_PRINCIPAL]: 'College Principal',
  [USER_ROLES.COLLEGE_AO]: 'College AO',
  [USER_ROLES.COLLEGE_ATTENDER]: 'College Attender',
  [USER_ROLES.BRANCH_HOD]: 'Branch HOD',
  [USER_ROLES.STAFF]: 'Staff'
};

// Role Colors for UI
export const ROLE_COLORS = {
  [USER_ROLES.SUPER_ADMIN]: 'bg-rose-50 text-rose-700 border-rose-200',
  [USER_ROLES.ADMIN]: 'bg-rose-50 text-rose-700 border-rose-200',
  [USER_ROLES.COLLEGE_PRINCIPAL]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [USER_ROLES.COLLEGE_AO]: 'bg-sky-50 text-sky-700 border-sky-200',
  [USER_ROLES.COLLEGE_ATTENDER]: 'bg-slate-100 text-slate-700 border-slate-200',
  [USER_ROLES.BRANCH_HOD]: 'bg-amber-50 text-amber-700 border-amber-200',
  [USER_ROLES.STAFF]: 'bg-slate-100 text-slate-700 border-slate-200'
};

// Check if role has full access (super admin or legacy admin)
export const isFullAccessRole = (role) => {
  return role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN;
};

// Create default permissions (all false)
export const createDefaultPermissions = () => {
  const permissions = {};
  Object.keys(BACKEND_MODULES).forEach(key => {
    const module = BACKEND_MODULES[key];
    const modulePerms = MODULE_PERMISSIONS[module];
    if (modulePerms) {
      permissions[module] = {};
      modulePerms.permissions.forEach(perm => {
        permissions[module][perm] = false;
      });
    }
  });
  return permissions;
};

// Create super admin permissions (all true)
export const createSuperAdminPermissions = () => {
  const permissions = {};
  Object.keys(BACKEND_MODULES).forEach(key => {
    const module = BACKEND_MODULES[key];
    const modulePerms = MODULE_PERMISSIONS[module];
    if (modulePerms) {
      permissions[module] = {};
      modulePerms.permissions.forEach(perm => {
        permissions[module][perm] = true;
      });
    }
  });
  return permissions;
};
