const { masterPool } = require('../config/database');

/**
 * Get all roles (system and custom)
 */
exports.getRoles = async (req, res) => {
    try {
        const { include_inactive } = req.query;

        let query = `
            SELECT 
                r.id,
                r.role_name,
                r.display_name,
                r.description,
                r.permissions,
                r.is_system_role,
                r.is_active,
                r.created_at,
                r.updated_at,
                creator.name as created_by_name,
                (
                    SELECT COUNT(*) 
                    FROM ticket_employees 
                    WHERE custom_role_id = r.id AND is_active = 1
                ) as employee_count
            FROM ticket_roles r
            LEFT JOIN rbac_users creator ON r.created_by = creator.id
        `;

        if (!include_inactive || include_inactive === 'false') {
            query += ' WHERE r.is_active = 1';
        }

        query += ' ORDER BY r.is_system_role DESC, r.created_at DESC';

        const [roles] = await masterPool.query(query);

        // Parse JSON permissions
        const rolesWithParsedPermissions = roles.map(role => ({
            ...role,
            permissions: typeof role.permissions === 'string'
                ? JSON.parse(role.permissions)
                : role.permissions
        }));

        res.json({
            success: true,
            data: rolesWithParsedPermissions
        });
    } catch (error) {
        console.error('Get Roles Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching roles'
        });
    }
};

/**
 * Get single role by ID
 */
exports.getRole = async (req, res) => {
    try {
        const { id } = req.params;

        const [roles] = await masterPool.query(
            `SELECT 
                r.*,
                creator.name as created_by_name
             FROM ticket_roles r
             LEFT JOIN rbac_users creator ON r.created_by = creator.id
             WHERE r.id = ?`,
            [id]
        );

        if (roles.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        const role = {
            ...roles[0],
            permissions: typeof roles[0].permissions === 'string'
                ? JSON.parse(roles[0].permissions)
                : roles[0].permissions
        };

        res.json({
            success: true,
            data: role
        });
    } catch (error) {
        console.error('Get Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching role'
        });
    }
};

/**
 * Create new custom role
 */
exports.createRole = async (req, res) => {
    try {
        const { role_name, display_name, description, permissions } = req.body;
        const currentUser = req.user;

        // Validation
        if (!role_name || !display_name || !permissions) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: role_name, display_name, permissions'
            });
        }

        // Validate role_name format (lowercase, underscores only)
        if (!/^[a-z_]+$/.test(role_name)) {
            return res.status(400).json({
                success: false,
                message: 'Role name must be lowercase with underscores only (e.g., principal, ticket_manager)'
            });
        }

        // Check for duplicate role_name
        const [existing] = await masterPool.query(
            'SELECT id FROM ticket_roles WHERE role_name = ?',
            [role_name]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Role name already exists'
            });
        }

        // Validate permissions structure
        const validModules = [
            'ticket_dashboard',
            'ticket_management',
            'employee_management',
            'category_management',
            'ticket_reports',
            'ticket_settings'
        ];

        const validActions = ['read', 'write', 'update', 'delete'];

        // Ensure permissions object has correct structure
        for (const module of validModules) {
            if (!permissions[module]) {
                permissions[module] = { read: false, write: false, update: false, delete: false };
            } else {
                for (const action of validActions) {
                    if (permissions[module][action] === undefined) {
                        permissions[module][action] = false;
                    }
                }
            }
        }

        // Insert role
        const [result] = await masterPool.query(
            `INSERT INTO ticket_roles 
            (role_name, display_name, description, permissions, is_system_role, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, FALSE, ?, NOW(), NOW())`,
            [
                role_name,
                display_name,
                description || null,
                JSON.stringify(permissions),
                currentUser.id
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: {
                id: result.insertId,
                role_name,
                display_name,
                permissions
            }
        });
    } catch (error) {
        console.error('Create Role Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error creating role'
        });
    }
};

/**
 * Update existing role
 */
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, display_name, description, permissions, is_active } = req.body;

        // Check if role exists
        const [existing] = await masterPool.query(
            'SELECT is_system_role FROM ticket_roles WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Allow editing all roles (including system roles)
        // Build update query dynamically
        const updates = [];
        const values = [];

        if (role_name !== undefined) {
            // Validate role_name format
            if (!/^[a-z_]+$/.test(role_name)) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name must be lowercase with underscores only'
                });
            }

            // Check for duplicate role_name (excluding current role)
            const [duplicate] = await masterPool.query(
                'SELECT id FROM ticket_roles WHERE role_name = ? AND id != ?',
                [role_name, id]
            );

            if (duplicate.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Role name already exists'
                });
            }

            updates.push('role_name = ?');
            values.push(role_name);
        }

        if (display_name !== undefined) {
            updates.push('display_name = ?');
            values.push(display_name);
        }

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }

        if (permissions !== undefined) {
            updates.push('permissions = ?');
            values.push(JSON.stringify(permissions));
        }

        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        await masterPool.query(
            `UPDATE ticket_roles SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Role updated successfully'
        });
    } catch (error) {
        console.error('Update Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating role'
        });
    }
};

/**
 * Delete role (soft delete for custom roles, prevent deletion of system roles)
 */
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if role exists and is system role
        const [existing] = await masterPool.query(
            'SELECT is_system_role, role_name FROM ticket_roles WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Allow deleting all roles (including system roles)
        // Check if role is assigned to any active employees
        const [employees] = await masterPool.query(
            'SELECT COUNT(*) as count FROM ticket_employees WHERE custom_role_id = ? AND is_active = 1',
            [id]
        );

        if (employees[0].count > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete role. ${employees[0].count} employee(s) are currently assigned to this role.`
            });
        }

        // Soft delete
        await masterPool.query(
            'UPDATE ticket_roles SET is_active = 0, updated_at = NOW() WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Role deleted successfully'
        });
    } catch (error) {
        console.error('Delete Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting role'
        });
    }
};

/**
 * Get available modules and their permissions structure
 * (Helper endpoint for frontend to build permission UI)
 */
exports.getModulesStructure = async (req, res) => {
    try {
        const modules = {
            ticket_dashboard: {
                label: 'Dashboard',
                permissions: {
                    read: 'View Dashboard'
                }
            },
            ticket_management: {
                label: 'Ticket Management',
                permissions: {
                    read: 'View Tickets',
                    write: 'Create Tickets',
                    update: 'Update Tickets (Status, Assignments)',
                    delete: 'Delete Tickets'
                }
            },
            employee_management: {
                label: 'Employee Management',
                permissions: {
                    read: 'View Employees',
                    write: 'Create Employees',
                    update: 'Update Employee Details',
                    delete: 'Remove Employees'
                }
            },
            category_management: {
                label: 'Category Management',
                permissions: {
                    read: 'View Categories',
                    write: 'Create Categories',
                    update: 'Update Categories',
                    delete: 'Delete Categories'
                }
            },
            ticket_reports: {
                label: 'Reports & Analytics',
                permissions: {
                    read: 'View Reports',
                    write: 'Generate Reports',
                    update: 'Customize Reports',
                    delete: 'Delete Reports'
                }
            },
            ticket_settings: {
                label: 'System Settings',
                permissions: {
                    read: 'View Settings',
                    write: 'Create Settings',
                    update: 'Update Settings',
                    delete: 'Delete Settings'
                }
            }
        };

        res.json({
            success: true,
            data: modules
        });
    } catch (error) {
        console.error('Get Modules Structure Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
