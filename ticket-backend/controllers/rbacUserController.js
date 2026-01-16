const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');

// Roles supported by Ticket App
const ROLES = {
    STAFF: 'staff',   // Ticket Manager
    WORKER: 'worker', // Ticket Worker
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    SUB_ADMIN: 'sub_admin'
};

// Helper: Determine which roles a user can manage
const getAllowedRoles = (currentUserRole) => {
    // Super Admins and Admins can create Staff (Managers) and Workers
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SUB_ADMIN].includes(currentUserRole)) {
        return [ROLES.STAFF, ROLES.WORKER];
    }
    // Staff (Managers) can only create Workers
    if (currentUserRole === ROLES.STAFF) {
        return [ROLES.WORKER];
    }
    return [];
};

/**
 * Get users (Staff and Workers)
 */
exports.getUsers = async (req, res) => {
    try {
        // Basic query to fetch users relevant to Ticket Management
        // We include all staff and workers. 
        // Admin/Super Admin might want to see everyone, but for this specific app context,
        // we might prioritize these. However, EmployeeManagement filters client-side, 
        // so sending more is fine, but let's stick to the table structure.

        // Note: The main backend returns a lot of fields (college_id etc).
        // We will return standard fields.

        const [rows] = await masterPool.query(`
            SELECT 
                id, name, email, phone, username, role, 
                is_active, created_at, updated_at,
                college_id, course_id, branch_id
            FROM rbac_users 
            WHERE is_active = 1 
            ORDER BY created_at DESC
        `);

        // If we strictly want to filter by "Ticket App Users", we could add WHERE role IN (...)
        // But the EmployeeManagement page processes the list.

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get Users Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching users' });
    }
};

/**
 * Create new user
 */
exports.createUser = async (req, res) => {
    try {
        const { name, email, phone, username, password, role } = req.body;
        const currentUser = req.user;

        if (!currentUser) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // 1. Validate Input
        if (!name || !email || !username || !password || !role) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // 2. Validate Permission
        const allowedRoles = getAllowedRoles(currentUser.role);

        // If user is super_admin, they can technically create anything, but for this app context:
        // We check if the requested role is in our explicit allowed list OR if user is super_admin.
        const isSuper = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUser.role);

        if (!isSuper && !allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: `You are not authorized to create users with role: ${role}`
            });
        }

        // 3. Check Duplicates
        const [existing] = await masterPool.query(
            'SELECT id FROM rbac_users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'username or email already exists' });
        }

        // 4. Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 5. Insert
        // JSON fields (college_ids etc) are set to null/empty as these are global roles usually
        const [result] = await masterPool.query(
            `INSERT INTO rbac_users 
            (name, email, phone, username, password, role, is_active, created_by, created_at, updated_at, 
            permissions, college_ids, course_ids, branch_ids)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW(), ?, ?, ?, ?)`,
            [
                name,
                email,
                phone,
                username,
                hashedPassword,
                role,
                currentUser.id,
                JSON.stringify({}), // Empty permissions
                JSON.stringify([]), // Empty college_ids
                JSON.stringify([]), // Empty course_ids
                JSON.stringify([])  // Empty branch_ids
            ]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { id: result.insertId, role, username, email }
        });

    } catch (error) {
        console.error('Create User Error:', error);
        // Handle specific SQL errors if needed
        res.status(500).json({ success: false, message: error.message || 'Server error creating user' });
    }
};

/**
 * Update User
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, username, password, role } = req.body;

        // If password is provided, hash it
        let passwordClause = '';
        const params = [name, email, phone, username, role];

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            passwordClause = ', password = ?';
            params.push(hashedPassword);
        }

        params.push(id);

        const [result] = await masterPool.query(
            `UPDATE rbac_users 
             SET name=?, email=?, phone=?, username=?, role=?, updated_at=NOW() ${passwordClause}
             WHERE id=?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ success: false, message: 'Server error updating user' });
    }
};

/**
 * Delete User (Soft Delete)
 */
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Soft delete by setting is_active = 0
        const [result] = await masterPool.query(
            'UPDATE rbac_users SET is_active = 0, updated_at = NOW() WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting user' });
    }
};
