const { masterPool } = require('../config/database');
const { buildScopeConditions } = require('../utils/scoping');

// --- Services Configuration (Admin) ---

// Get all services (Admin sees all, Students see active only)
exports.getServices = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.isAdmin);
        let query = 'SELECT * FROM services';
        const params = [];

        if (!isAdmin) {
            query += ' WHERE is_active = TRUE';
        }

        query += ' ORDER BY name ASC';

        const [rows] = await masterPool.execute(query, params);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createService = async (req, res) => {
    try {
        const { name, description, price, is_active } = req.body;

        // Basic validation
        if (!name || price === undefined) {
            return res.status(400).json({ success: false, message: 'Name and Price are required' });
        }

        const [result] = await masterPool.execute(
            'INSERT INTO services (name, description, price, is_active) VALUES (?, ?, ?, ?)',
            [name, description, price, is_active !== undefined ? is_active : true]
        );

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            serviceId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Service name already exists' });
        }
        console.error('Error creating service:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, is_active } = req.body;

        const [result] = await masterPool.execute(
            'UPDATE services SET name = ?, description = ?, price = ?, is_active = ? WHERE id = ?',
            [name, description, price, is_active, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        res.json({ success: true, message: 'Service updated successfully' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if used in requests
        const [requests] = await masterPool.execute('SELECT 1 FROM service_requests WHERE service_id = ? LIMIT 1', [id]);
        if (requests.length > 0) {
            // Soft delete or prevent? Let's just deactivate if used
            await masterPool.execute('UPDATE services SET is_active = FALSE WHERE id = ?', [id]);
            return res.json({ success: true, message: 'Service deactivated (cannot delete as it has requests)' });
        }

        const [result] = await masterPool.execute('DELETE FROM services WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


// --- Service Requests (Student & Admin) ---

// Create Request (Student)
exports.requestService = async (req, res) => {
    try {
        const { service_id } = req.body;
        const student_id = req.user.id; // User must be a student

        // Verify service exists and is active
        const [service] = await masterPool.execute('SELECT * FROM services WHERE id = ? AND is_active = TRUE', [service_id]);
        if (service.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or inactive service' });
        }

        // Check for duplicate pending requests for same service? Maybe optional.
        // Let's allow multiple for now unless user restricts.

        const [result] = await masterPool.execute(
            'INSERT INTO service_requests (student_id, service_id, status) VALUES (?, ?, ?)',
            [student_id, service_id, 'pending']
        );

        res.status(201).json({
            success: true,
            message: 'Service requested successfully',
            requestId: result.insertId
        });
    } catch (error) {
        console.error('Error requesting service:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get Requests
exports.getServiceRequests = async (req, res) => {
    try {
        const { status, student_id } = req.query;
        const isStudent = req.user.role === 'student' || (!req.user.isAdmin && !req.user.role); // Assuming simplified role check

        // Build query
        let query = `
      SELECT sr.*, s.name as service_name, s.price as service_price, 
             st.student_name, st.admission_number, st.course, st.branch
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN students st ON sr.student_id = st.id
    `;

        const params = [];
        const conditions = [];

        // If student, only show their requests
        if (isStudent || student_id) { // Allow admin to filter by student_id
            // If isStudent is true, force student_id to be logged in user
            const targetId = isStudent ? req.user.id : student_id;
            conditions.push('sr.student_id = ?');
            params.push(targetId);
        }

        if (status) {
            conditions.push('sr.status = ?');
            params.push(status);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Apply Scope Filtering (for admins)
        if (!isStudent && req.userScope) {
            const { conditions: scopeConditions, params: scopeParams } = buildScopeConditions(req.userScope, 'st');
            if (scopeConditions.length > 0) {
                // If WHERE clause exists, append with AND, else start with WHERE
                query += (query.includes('WHERE') ? ' AND ' : ' WHERE ') + scopeConditions.join(' AND ');
                params.push(...scopeParams);
            }
        }

        query += ' ORDER BY sr.request_date DESC';

        const [rows] = await masterPool.execute(query, params);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching service requests:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update Request Status (Admin)
exports.updateRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, collect_date, admin_note } = req.body;

        // Validate inputs based on status
        // If status is 'ready_to_collect', collect_date and notification (admin_note) are expected

        let query = 'UPDATE service_requests SET status = ?';
        const params = [status];

        if (collect_date) {
            query += ', collect_date = ?';
            params.push(collect_date);
        }

        if (admin_note) {
            query += ', admin_note = ?';
            params.push(admin_note);
        }

        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await masterPool.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.json({ success: true, message: 'Request updated successfully' });
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
