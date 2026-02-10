/**
 * Timetable Controller (Pydah v2.0)
 * CRUD for timetable entries.
 */

const { masterPool } = require('../config/database');

exports.list = async (req, res) => {
    try {
        const { branch_id, year, semester, faculty_id } = req.query;

        let query = `SELECT te.*, s.name as subject_name, s.code as subject_code, b.name as branch_name
                     FROM timetable_entries te
                     LEFT JOIN subjects s ON s.id = te.subject_id
                     LEFT JOIN course_branches b ON b.id = te.branch_id`;
        let params = [];
        let conditions = [];

        if (branch_id && year && semester) {
            conditions.push(`te.branch_id = ? AND te.year_of_study = ? AND te.semester_number = ?`);
            params.push(branch_id, year, semester);
        } else if (faculty_id) {
            conditions.push(`te.subject_id IN (SELECT subject_id FROM faculty_subjects WHERE rbac_user_id = ?)`);
            params.push(faculty_id);
        } else {
            return res.status(400).json({ success: false, message: 'branch context or faculty_id is required' });
        }

        query += ` WHERE ` + conditions.join(' AND ') + ` ORDER BY te.day_of_week, te.period_slot_id`;
        const [rows] = await masterPool.query(query, params);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('timetable list error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch timetable' });
    }
};

exports.updateBulk = async (req, res) => {
    try {
        const { branch_id, year, semester, entries } = req.body;
        if (!branch_id || !year || !semester || !Array.isArray(entries)) {
            return res.status(400).json({ success: false, message: 'branch_id, year, semester, and entries array are required' });
        }

        // Use a transaction for bulk update
        const connection = await masterPool.getConnection();
        await connection.beginTransaction();

        try {
            // Option 1: Delete existing for this context and re-insert
            await connection.query(
                'DELETE FROM timetable_entries WHERE branch_id = ? AND year_of_study = ? AND semester_number = ?',
                [branch_id, year, semester]
            );

            if (entries.length > 0) {
                const values = entries.map(e => [
                    branch_id,
                    year,
                    semester,
                    e.day_of_week,
                    e.period_slot_id,
                    e.subject_id || null,
                    e.type || 'subject',
                    e.custom_label || null,
                    e.span || 1
                ]);

                await connection.query(
                    `INSERT INTO timetable_entries (branch_id, year_of_study, semester_number, day_of_week, period_slot_id, subject_id, type, custom_label, span)
           VALUES ?`,
                    [values]
                );
            }

            await connection.commit();
            res.json({ success: true, message: 'Timetable updated successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('timetable bulk update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update timetable' });
    }
};

exports.saveEntry = async (req, res) => {
    try {
        const { branch_id, year, semester, day_of_week, period_slot_id, subject_id, type, custom_label, span } = req.body;

        await masterPool.query(
            `INSERT INTO timetable_entries (branch_id, year_of_study, semester_number, day_of_week, period_slot_id, subject_id, type, custom_label, span)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                subject_id = VALUES(subject_id),
                type = VALUES(type),
                custom_label = VALUES(custom_label),
                span = VALUES(span)`,
            [branch_id, year, semester, day_of_week, period_slot_id, subject_id || null, type || 'subject', custom_label || null, span || 1]
        );

        res.json({ success: true, message: 'Entry saved' });
    } catch (error) {
        console.error('timetable save entry error:', error);
        res.status(500).json({ success: false, message: 'Failed to save entry' });
    }
};

exports.removeEntry = async (req, res) => {
    try {
        const { id } = req.params;
        await masterPool.query('DELETE FROM timetable_entries WHERE id = ?', [id]);
        res.json({ success: true, message: 'Entry removed' });
    } catch (error) {
        console.error('timetable remove entry error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove entry' });
    }
};
