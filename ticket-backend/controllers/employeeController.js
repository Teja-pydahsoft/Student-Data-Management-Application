const { masterPool } = require('../config/database');

/**
 * Get all ticket employees with their RBAC user details
 */
exports.getEmployees = async (req, res) => {
    try {
        const [rows] = await masterPool.query(`
            SELECT 
                te.id,
                te.rbac_user_id,
                te.role,
                te.is_active,
                te.assigned_date,
                te.assigned_categories,
                te.assigned_subcategories,
                te.created_at,
                te.updated_at,
                ru.name,
                ru.email,
                ru.phone,
                ru.username
            FROM ticket_employees te
            INNER JOIN rbac_users ru ON te.rbac_user_id = ru.id
            WHERE te.is_active = 1
            ORDER BY te.created_at DESC
        `);

        // Parse JSON fields safely
        const parsedRows = rows.map(row => {
            let categories = [];
            let subcategories = [];

            try {
                if (row.assigned_categories) {
                    categories = typeof row.assigned_categories === 'string'
                        ? JSON.parse(row.assigned_categories)
                        : row.assigned_categories;
                }
                if (row.assigned_subcategories) {
                    subcategories = typeof row.assigned_subcategories === 'string'
                        ? JSON.parse(row.assigned_subcategories)
                        : row.assigned_subcategories;
                }
            } catch (e) {
                console.error('Error parsing categories:', e);
            }

            return {
                ...row,
                assigned_categories: Array.isArray(categories) ? categories : [],
                assigned_subcategories: Array.isArray(subcategories) ? subcategories : []
            };
        });

        res.json({
            success: true,
            data: parsedRows
        });
    } catch (error) {
        console.error('Get Employees Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching employees'
        });
    }
};

/**
 * Create new employee assignment
 */
exports.createEmployee = async (req, res) => {
    try {
        const { rbac_user_id, role, assigned_categories, assigned_subcategories } = req.body;

        if (!rbac_user_id || !role) {
            return res.status(400).json({
                success: false,
                message: 'rbac_user_id and role are required'
            });
        }

        if (!['staff', 'worker'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be staff or worker'
            });
        }

        // Check if user exists in rbac_users
        const [userCheck] = await masterPool.query(
            'SELECT id, name FROM rbac_users WHERE id = ?',
            [rbac_user_id]
        );

        if (userCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found in RBAC users'
            });
        }

        // Check if already assigned
        const [existingEmployee] = await masterPool.query(
            'SELECT id FROM ticket_employees WHERE rbac_user_id = ? AND is_active = 1',
            [rbac_user_id]
        );

        if (existingEmployee.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'User is already assigned as an employee'
            });
        }

        // Prepare category data (only for staff/managers)
        const categoriesJson = role === 'staff' && assigned_categories ? JSON.stringify(assigned_categories) : null;
        const subcategoriesJson = role === 'staff' && assigned_subcategories ? JSON.stringify(assigned_subcategories) : null;

        // Create employee assignment
        const [result] = await masterPool.query(
            `INSERT INTO ticket_employees (rbac_user_id, role, assigned_categories, assigned_subcategories) 
             VALUES (?, ?, ?, ?)`,
            [rbac_user_id, role, categoriesJson, subcategoriesJson]
        );

        // Sync role to rbac_users
        await masterPool.query(
            'UPDATE rbac_users SET role = ? WHERE id = ?',
            [role, rbac_user_id]
        );

        // Fetch the created employee with user details
        const [newEmployee] = await masterPool.query(`
            SELECT 
                te.id,
                te.rbac_user_id,
                te.role,
                te.is_active,
                te.assigned_date,
                te.assigned_categories,
                te.assigned_subcategories,
                ru.name,
                ru.email,
                ru.phone,
                ru.username
            FROM ticket_employees te
            INNER JOIN rbac_users ru ON te.rbac_user_id = ru.id
            WHERE te.id = ?
        `, [result.insertId]);

        // Safe parse for response
        let categories = [];
        let subcategories = [];
        try {
            if (newEmployee[0].assigned_categories) {
                categories = typeof newEmployee[0].assigned_categories === 'string'
                    ? JSON.parse(newEmployee[0].assigned_categories)
                    : newEmployee[0].assigned_categories;
            }
            if (newEmployee[0].assigned_subcategories) {
                subcategories = typeof newEmployee[0].assigned_subcategories === 'string'
                    ? JSON.parse(newEmployee[0].assigned_subcategories)
                    : newEmployee[0].assigned_subcategories;
            }
        } catch (e) {
            console.error('Error parsing categories in creation:', e);
        }

        const employee = {
            ...newEmployee[0],
            assigned_categories: Array.isArray(categories) ? categories : [],
            assigned_subcategories: Array.isArray(subcategories) ? subcategories : []
        };

        res.status(201).json({
            success: true,
            message: 'Employee assigned successfully',
            data: employee
        });

    } catch (error) {
        console.error('Create Employee Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error creating employee'
        });
    }
};

/**
 * Update employee role
 */
exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, assigned_categories, assigned_subcategories } = req.body;

        if (!role || !['staff', 'worker'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be staff or worker'
            });
        }

        // Prepare category data (only for staff/managers)
        const categoriesJson = role === 'staff' && assigned_categories ? JSON.stringify(assigned_categories) : null;
        const subcategoriesJson = role === 'staff' && assigned_subcategories ? JSON.stringify(assigned_subcategories) : null;

        const [result] = await masterPool.query(
            `UPDATE ticket_employees 
             SET role = ?, assigned_categories = ?, assigned_subcategories = ?, updated_at = NOW() 
             WHERE id = ?`,
            [role, categoriesJson, subcategoriesJson, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Sync role back to rbac_users
        // First get the rbac_user_id for this assignment
        const [assignment] = await masterPool.query(
            'SELECT rbac_user_id FROM ticket_employees WHERE id = ?',
            [id]
        );

        if (assignment.length > 0) {
            await masterPool.query(
                'UPDATE rbac_users SET role = ? WHERE id = ?',
                [role, assignment[0].rbac_user_id]
            );
        }

        res.json({
            success: true,
            message: 'Employee updated successfully'
        });

    } catch (error) {
        console.error('Update Employee Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating employee'
        });
    }
};

/**
 * Delete employee (soft delete)
 */
exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await masterPool.query(
            'UPDATE ticket_employees SET is_active = 0, updated_at = NOW() WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        res.json({
            success: true,
            message: 'Employee removed successfully'
        });
    } catch (error) {
        console.error('Delete Employee Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting employee'
        });
    }
};

/**
 * Get available RBAC users (not yet assigned as employees)
 */
exports.getAvailableUsers = async (req, res) => {
    try {
        const [rows] = await masterPool.query(`
            SELECT 
                ru.id,
                ru.name,
                ru.email,
                ru.phone,
                ru.username,
                ru.role as rbac_role
            FROM rbac_users ru
            LEFT JOIN ticket_employees te ON ru.id = te.rbac_user_id AND te.is_active = 1
            WHERE te.id IS NULL 
            AND ru.is_active = 1
            AND ru.role NOT IN ('super_admin', 'student')
            ORDER BY ru.name ASC
        `);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get Available Users Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching available users'
        });
    }
};
