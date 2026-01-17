const { masterPool } = require('../config/database');
const bcrypt = require('bcryptjs');

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
                COALESCE(te.name, ru.name) as name,
                COALESCE(te.email, ru.email) as email,
                COALESCE(te.phone, ru.phone) as phone,
                COALESCE(te.username, ru.username) as username,
                (
                    SELECT COUNT(DISTINCT ta.ticket_id)
                    FROM ticket_assignments ta
                    JOIN tickets t ON ta.ticket_id = t.id
                    WHERE (ta.assigned_to = ru.id OR ta.assigned_to = te.id) 
                    AND ta.is_active = TRUE
                    AND t.status NOT IN ('closed', 'completed')
                ) as active_tickets_count
            FROM ticket_employees te
            LEFT JOIN rbac_users ru ON te.rbac_user_id = ru.id
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
                // Ensure we return consistent ID for assignment logic
                // If rbac_user_id is missing (worker), we might need to rely on te.id or handle it in frontend
                // For now, let's keep the structure but note that rbac_user_id might be null
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
        const { rbac_user_id, role, assigned_categories, assigned_subcategories, name, email, username, password, phone } = req.body;

        if (!role || !['staff', 'worker'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be staff or worker'
            });
        }

        // Logic split based on role
        if (role === 'staff') {
            // STAFF (Manager): Must select existing RBAC user
            if (!rbac_user_id) {
                return res.status(400).json({ success: false, message: 'rbac_user_id is required for Managers' });
            }

            // Check if user exists in rbac_users
            const [userCheck] = await masterPool.query('SELECT id, name FROM rbac_users WHERE id = ?', [rbac_user_id]);
            if (userCheck.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found in RBAC users' });
            }

            // Check if already assigned
            const [existing] = await masterPool.query('SELECT id FROM ticket_employees WHERE rbac_user_id = ? AND is_active = 1', [rbac_user_id]);
            if (existing.length > 0) {
                return res.status(409).json({ success: false, message: 'User is already assigned as an employee' });
            }

            const categoriesJson = assigned_categories ? JSON.stringify(assigned_categories) : null;
            const subcategoriesJson = assigned_subcategories ? JSON.stringify(assigned_subcategories) : null;

            await masterPool.query(
                `INSERT INTO ticket_employees (rbac_user_id, role, assigned_categories, assigned_subcategories) VALUES (?, ?, ?, ?)`,
                [rbac_user_id, role, categoriesJson, subcategoriesJson]
            );

            // Sync role
            await masterPool.query('UPDATE rbac_users SET role = ? WHERE id = ?', [role, rbac_user_id]);

        } else if (role === 'worker') {
            // WORKER: Create standalone Identity in ticket_employees
            // validate phone is present
            if (!name || !username || !password || !phone) {
                return res.status(400).json({ success: false, message: 'Name, username, password, and mobile number are required for Workers' });
            }

            // Check if username exists in ticket_employees OR rbac_users to avoid confusion
            const [existingUser] = await masterPool.query(
                'SELECT id FROM ticket_employees WHERE username = ? UNION SELECT id FROM rbac_users WHERE username = ?',
                [username, username]
            );
            if (existingUser.length > 0) {
                return res.status(409).json({ success: false, message: 'Username already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert standalone worker
            await masterPool.query(
                `INSERT INTO ticket_employees (role, name, email, username, password_hash, phone) VALUES (?, ?, ?, ?, ?, ?)`,
                [role, name, email || null, username, hashedPassword, phone]
            );
        }

        // Fetch the created/assigned employee
        // We need a way to get the ID we just inserted or the rbac_user_id one.
        // Simplest is to just return success and let UI refresh, or do a quick lookup.
        // For current flow simplicity:

        res.status(201).json({
            success: true,
            message: role === 'worker' ? 'Worker created successfully' : 'Manager assigned successfully'
        });

    } catch (error) {
        console.error('Create Employee Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating employee'
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
