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

// ... (Other functions like allowStudentOwnProfileOrPermission, attachUserScope, verifyCanManageUser could be added if needed)
// For Ticket App, we mainly need Role and Permission checks.

module.exports = {
    isSuperAdmin,
    verifyRole,
    verifyPermission,
    parseArrayData
};
