/**
 * Ticket App RBAC Constants
 * Defines modules and permissions specific to the Ticket Management System
 * This is separate from the Student Database RBAC system
 */

// Ticket App Specific Modules
export const TICKET_MODULES = {
    DASHBOARD: 'ticket_dashboard',
    TICKET_MANAGEMENT: 'ticket_management',
    EMPLOYEE_MANAGEMENT: 'employee_management',
    CATEGORY_MANAGEMENT: 'category_management',
    REPORTS: 'ticket_reports',
    SETTINGS: 'ticket_settings'
};

// Granular Permissions for each ticket module
export const TICKET_MODULE_PERMISSIONS = {
    [TICKET_MODULES.DASHBOARD]: {
        permissions: ['view'],
        labels: {
            view: 'View Dashboard'
        }
    },
    [TICKET_MODULES.TICKET_MANAGEMENT]: {
        permissions: ['read', 'write', 'update', 'delete'],
        labels: {
            read: 'View Tickets',
            write: 'Create Tickets',
            update: 'Update Tickets (Status, Assignments)',
            delete: 'Delete Tickets'
        }
    },
    [TICKET_MODULES.EMPLOYEE_MANAGEMENT]: {
        permissions: ['read', 'write', 'update', 'delete'],
        labels: {
            read: 'View Employees',
            write: 'Create Employees (Managers/Workers)',
            update: 'Update Employee Details',
            delete: 'Remove Employees'
        }
    },
    [TICKET_MODULES.CATEGORY_MANAGEMENT]: {
        permissions: ['read', 'write', 'update', 'delete'],
        labels: {
            read: 'View Categories',
            write: 'Create Categories',
            update: 'Update Categories',
            delete: 'Delete Categories'
        }
    },
    [TICKET_MODULES.REPORTS]: {
        permissions: ['read', 'write', 'update', 'delete'],
        labels: {
            read: 'View Reports',
            write: 'Generate Reports',
            update: 'Customize Reports',
            delete: 'Delete Reports'
        }
    },
    [TICKET_MODULES.SETTINGS]: {
        permissions: ['read', 'write', 'update', 'delete'],
        labels: {
            read: 'View Settings',
            write: 'Create Settings',
            update: 'Update Settings',
            delete: 'Delete Settings'
        }
    }
};

// Module Labels for UI
export const TICKET_MODULE_LABELS = {
    [TICKET_MODULES.DASHBOARD]: 'Dashboard',
    [TICKET_MODULES.TICKET_MANAGEMENT]: 'Ticket Management',
    [TICKET_MODULES.EMPLOYEE_MANAGEMENT]: 'Employee Management',
    [TICKET_MODULES.CATEGORY_MANAGEMENT]: 'Category Management',
    [TICKET_MODULES.REPORTS]: 'Reports & Analytics',
    [TICKET_MODULES.SETTINGS]: 'System Settings'
};

// User Roles specific to Ticket App
export const TICKET_USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    SUB_ADMIN: 'sub_admin',
    STAFF: 'staff',      // Ticket Manager
    WORKER: 'worker'     // Ticket Worker
};

// Role Labels for UI display
export const TICKET_ROLE_LABELS = {
    [TICKET_USER_ROLES.SUPER_ADMIN]: 'Super Admin',
    [TICKET_USER_ROLES.ADMIN]: 'Admin',
    [TICKET_USER_ROLES.SUB_ADMIN]: 'Sub Admin',
    [TICKET_USER_ROLES.STAFF]: 'Manager',
    [TICKET_USER_ROLES.WORKER]: 'Worker'
};

// Create default permissions (all false) for ticket modules
export const createDefaultTicketPermissions = (role = 'sub_admin') => {
    const permissions = {};
    Object.keys(TICKET_MODULES).forEach(key => {
        const module = TICKET_MODULES[key];
        const modulePerms = TICKET_MODULE_PERMISSIONS[module];
        if (modulePerms) {
            permissions[module] = {};
            modulePerms.permissions.forEach(perm => {
                permissions[module][perm] = false;
            });
        }
    });
    return permissions;
};

// Create super admin permissions (all true) for ticket modules
export const createTicketSuperAdminPermissions = () => {
    const permissions = {};
    Object.keys(TICKET_MODULES).forEach(key => {
        const module = TICKET_MODULES[key];
        const modulePerms = TICKET_MODULE_PERMISSIONS[module];
        if (modulePerms) {
            permissions[module] = {};
            modulePerms.permissions.forEach(perm => {
                permissions[module][perm] = true;
            });
        }
    });
    return permissions;
};

/**
 * Check if user has access to a ticket module
 * @param {Object} permissions - User's permissions object
 * @param {string} module - Module key to check
 * @returns {boolean} - Whether user has any access
 */
export const hasTicketModuleAccess = (permissions, module) => {
    if (!permissions || !module) return false;

    const perm = permissions[module];
    if (!perm) return false;

    return Object.values(perm).some(val => val === true);
};

/**
 * Check if user has a specific permission for a ticket module
 * @param {Object} permissions - User's permissions object
 * @param {string} module - Module key
 * @param {string} action - Specific action to check (e.g., 'read', 'write')
 * @returns {boolean} - Whether user has that specific permission
 */
export const hasTicketPermission = (permissions, module, action) => {
    if (!permissions || !module || !action) return false;

    const modulePerm = permissions[module];
    if (!modulePerm) return false;

    return modulePerm[action] === true;
};

// Check if role has full access (super admin or admin)
export const isTicketFullAccessRole = (role) => {
    return role === TICKET_USER_ROLES.SUPER_ADMIN || role === TICKET_USER_ROLES.ADMIN;
};
