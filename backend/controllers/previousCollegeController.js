const { pool } = require('../config/database');

// Get all previous colleges
// Get all previous colleges
exports.getAllPreviousColleges = async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM previous_colleges';
        const params = [];

        if (category) {
            query += ' WHERE category = ?';
            params.push(category);
        }

        query += ' ORDER BY name ASC';

        const [rows] = await pool.query(query, params);
        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching previous colleges:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch previous colleges',
            error: error.message
        });
    }
};

// Add a new previous college
exports.addPreviousCollege = async (req, res) => {
    try {
        const { name, category } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'College name is required'
            });
        }

        const trimmedName = name.trim();
        const collegeCategory = category || 'Other';

        // Check if exists
        const [existing] = await pool.query('SELECT id, category FROM previous_colleges WHERE name = ?', [trimmedName]);
        if (existing.length > 0) {
            // Update category if it was Other and new category is specific
            if (collegeCategory !== 'Other' && existing[0].category === 'Other') {
                await pool.query('UPDATE previous_colleges SET category = ? WHERE id = ?', [collegeCategory, existing[0].id]);
            }
            return res.status(200).json({
                success: true,
                message: 'College already exists',
                data: existing[0]
            });
        }

        const [result] = await pool.query(
            'INSERT INTO previous_colleges (name, category) VALUES (?, ?)',
            [trimmedName, collegeCategory]
        );

        res.status(201).json({
            success: true,
            message: 'Previous college added successfully',
            data: {
                id: result.insertId,
                name: trimmedName,
                category: collegeCategory
            }
        });
    } catch (error) {
        console.error('Error adding previous college:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add previous college',
            error: error.message
        });
    }
};

// Bulk add previous colleges (Excel or List)
exports.bulkAddPreviousColleges = async (req, res) => {
    try {
        let colleges = [];
        const category = req.body.category || 'Other';

        // Handle File Upload (Excel/CSV)
        if (req.file) {
            const xlsx = require('xlsx');
            const fs = require('fs');

            try {
                const workbook = xlsx.readFile(req.file.path);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

                // Assume column 0 contains names if no header 'name' found
                // Or try to find header 'College Name' or 'Name'

                // Simple strategy: Flatten all cells, trim strings, filter out empty
                const flatData = rawData.flat();
                colleges = flatData
                    .filter(cell => typeof cell === 'string' && cell.trim().length > 0)
                    .map(cell => cell.trim());

                // Cleanup uploaded file
                fs.unlinkSync(req.file.path);
            } catch (fileError) {
                console.error('Error processing excel file:', fileError);
                return res.status(400).json({
                    success: false,
                    message: 'Failed to process bulk upload file'
                });
            }
        } else if (req.body.colleges && Array.isArray(req.body.colleges)) {
            // Handle JSON Array
            colleges = req.body.colleges;
        } else if (typeof req.body.colleges === 'string') {
            // Handle stringified JSON (FormData weirdness)
            try {
                colleges = JSON.parse(req.body.colleges);
            } catch (e) {
                colleges = [req.body.colleges];
            }
        }

        if (!colleges || colleges.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid college names provided'
            });
        }

        const uniqueNames = [...new Set(colleges.map(c => String(c).trim()).filter(c => c.length > 0))];

        if (uniqueNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid college names found to import'
            });
        }

        // Use INSERT ON DUPLICATE KEY UPDATE to update category for existing entries
        const sql = 'INSERT INTO previous_colleges (name, category) VALUES ? ON DUPLICATE KEY UPDATE category = VALUES(category)';
        const bulkValues = uniqueNames.map(name => [name, category]);

        const [result] = await pool.query(sql, [bulkValues]);

        res.status(201).json({
            success: true,
            message: 'Bulk import processed successfully',
            added: result.affectedRows, // Note: with ON DUPLICATE KEY UPDATE, affectedRows might be 2 per update
            count: uniqueNames.length
        });
    } catch (error) {
        console.error('Error bulk adding previous colleges:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk add previous colleges',
            error: error.message
        });
    }
};

// Update previous college
exports.updatePreviousCollege = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'College name is required'
            });
        }

        const [result] = await pool.query(
            'UPDATE previous_colleges SET name = ?, category = ? WHERE id = ?',
            [name.trim(), category || 'Other', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'College not found'
            });
        }

        res.json({
            success: true,
            message: 'College updated successfully'
        });
    } catch (error) {
        console.error('Error updating previous college:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update college',
            error: error.message
        });
    }
};

// Delete previous college
exports.deletePreviousCollege = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query('DELETE FROM previous_colleges WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'College not found'
            });
        }

        res.json({
            success: true,
            message: 'College deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting previous college:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete college',
            error: error.message
        });
    }
};

// Bulk Delete Previous Colleges
exports.bulkDeletePreviousColleges = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No college IDs provided for deletion'
            });
        }

        const [result] = await pool.query('DELETE FROM previous_colleges WHERE id IN (?)', [ids]);

        res.json({
            success: true,
            message: `Successfully deleted ${result.affectedRows} colleges`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Error bulk deleting colleges:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete colleges',
            error: error.message
        });
    }
};
