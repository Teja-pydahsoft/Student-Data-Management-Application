const { masterPool } = require('../config/database');

// Helper to determine category from role
const getCategoryFromRole = (role) => {
    switch (role) {
        case 'college_principal': return 'Principal';
        case 'college_ao': return 'AO';
        case 'branch_hod': return 'HOD';
        case 'cashier': return 'Accountant';
        default: return 'Other';
    }
};

// Get Filtered Regular Students
exports.getStudentsForHistory = async (req, res) => {
    try {
        const { college, course, branch, batch, year, semester } = req.query;

        let query = `
            SELECT id, admission_number, student_name, student_photo, 
                   college, course, branch, batch, current_year, current_semester 
            FROM students 
            WHERE student_status = 'Regular'
        `;
        const params = [];

        if (college) { query += ' AND college = ?'; params.push(college); }
        if (course) { query += ' AND course = ?'; params.push(course); }
        if (branch) { query += ' AND branch = ?'; params.push(branch); }
        if (batch) { query += ' AND batch = ?'; params.push(batch); }
        if (year) { query += ' AND current_year = ?'; params.push(year); }
        if (semester) { query += ' AND current_semester = ?'; params.push(semester); }

        query += ' ORDER BY student_name ASC LIMIT 500'; // Limit to prevent overload

        const [rows] = await masterPool.query(query, params);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('Get students history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch students' });
    }
};

// Add a new remark to a student's history
exports.addRemark = async (req, res) => {
    try {
        // Role check
        const allowedRoles = ['super_admin', 'admin', 'college_principal', 'college_ao', 'branch_hod', 'cashier', 'office_assistant'];
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access denied: Insufficient privileges' });
        }

        const { admission_number, remark } = req.body;

        if (!admission_number || !remark) {
            return res.status(400).json({
                success: false,
                message: 'Admission number and remark content are required'
            });
        }

        // Get user info from request (populated by auth middleware)
        const createdBy = req.user.id;
        const createdByName = req.user.username;
        const remarkCategory = getCategoryFromRole(req.user.role);

        const [result] = await masterPool.query(
            `INSERT INTO student_remarks (admission_number, remark, remark_category, created_by, created_by_name) 
             VALUES (?, ?, ?, ?, ?)`,
            [admission_number, remark, remarkCategory, createdBy, createdByName]
        );

        res.status(201).json({
            success: true,
            message: 'Remark added successfully',
            data: {
                id: result.insertId,
                admission_number,
                remark,
                remark_category: remarkCategory,
                created_by_name: createdByName,
                created_at: new Date()
            }
        });

    } catch (error) {
        console.error('Add remark error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add remark'
        });
    }
};

// Get all remarks for a specific student
exports.getRemarks = async (req, res) => {
    try {
        const { admission_number } = req.params;

        if (!admission_number) {
            return res.status(400).json({
                success: false,
                message: 'Admission number is required'
            });
        }

        const [rows] = await masterPool.query(
            `SELECT * FROM student_remarks 
             WHERE admission_number = ? 
             ORDER BY created_at DESC`,
            [admission_number]
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('Get remarks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch remarks'
        });
    }
};
