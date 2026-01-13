// Copied from Backend/constants/rbac.js to ensure compatibility with shared rbac.js middleware

// User Roles
const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin', // Legacy support
    // College Level
    COLLEGE_PRINCIPAL: 'college_principal',
    COLLEGE_AO: 'college_ao', // Administrative Officer
    // Course Level
    COURSE_PRINCIPAL: 'course_principal',
    COURSE_HOD: 'course_hod',
    // Branch Level
    BRANCH_HOD: 'branch_hod',
    BRANCH_CLERK: 'branch_clerk',
    branch_counselor: 'branch_counselor',
    branch_faculty: 'branch_faculty',
    // End User
    STUDENT: 'student',

    // Ticket Specific - Can be added here
    SUPPORT_STAFF: 'support_staff'
};

// Module mappings
const MODULES = {
    DASHBOARD: 'dashboard',
    ANNOUNCEMENTS: 'announcements',
    STUDENTS: 'student_management',
    SUBMISSIONS: 'submissions', // Self-registration/edits
    PROMOTIONS: 'promotions',
    ATTENDANCE: 'attendance',
    COURSES: 'course_management',
    USERS: 'user_management',
    REPORTS: 'reports',
    TICKETS: 'ticket_management',
    SERVICES: 'student_services',
    TASK_MANAGEMENT: 'task_management'
};

// Map backend modules to frontend routes
const MODULE_ROUTE_MAP = {
    [MODULES.DASHBOARD]: '/',
    [MODULES.ANNOUNCEMENTS]: '/announcements',
    [MODULES.STUDENTS]: '/students',
    [MODULES.SUBMISSIONS]: '/students/self-registration',
    [MODULES.PROMOTIONS]: '/promotions',
    [MODULES.ATTENDANCE]: '/attendance',
    [MODULES.COURSES]: '/courses',
    [MODULES.USERS]: '/users',
    [MODULES.REPORTS]: '/reports',
    [MODULES.TICKETS]: '/tickets',
    [MODULES.SERVICES]: '/services',
    [MODULES.TASK_MANAGEMENT]: '/task-management'
};

// Permission Levels
const PERMISSIONS = {
    READ: 'read',     // View only
    WRITE: 'write',   // Create/Edit
    DELETE: 'delete', // Delete
    APPROVE: 'approve', // Approve/Reject requests
    EXPORT: 'export'  // Download reports
};

// Helper: Check if a user has permission for a specific module and operation
const hasPermission = (userPermissions, module, operation = 'read') => {
    if (!userPermissions) return false;

    // Check if module exists in permissions
    const modulePerms = userPermissions[module];
    if (!modulePerms) return false;

    // If verifying read access, any permission usually implies read access, 
    // but let's be strict or allow 'read' or 'write' (which implies read usually)
    // For this simple implementation, we check explicit inclusion
    return modulePerms.includes(operation);
};

// Legacy support functions
const canCreateRole = (creatorRole, targetRole) => {
    if (creatorRole === USER_ROLES.SUPER_ADMIN || creatorRole === 'admin') return true;
    return false;
};

const validateRoleRequirements = (role, data) => {
    return true;
};

module.exports = {
    USER_ROLES,
    MODULES,
    PERMISSIONS,
    MODULE_ROUTE_MAP,
    hasPermission,
    canCreateRole,
    validateRoleRequirements
};
