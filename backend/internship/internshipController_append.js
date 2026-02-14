
exports.getMyAssignment = async (req, res) => {
    try {
        const studentId = req.user.id;
        const [assignments] = await masterPool.query(`
            SELECT ia.*, il.company_name, il.address, il.latitude, il.longitude, il.radius_meters 
            FROM internship_assignments ia
            JOIN internship_locations il ON ia.internship_id = il.id
            WHERE ia.student_id = ?
            AND ia.end_date >= CURDATE()
            ORDER BY ia.start_date DESC
            LIMIT 1
        `, [studentId]);

        if (assignments.length === 0) {
            return res.json({ success: true, assignment: null });
        }

        res.json({ success: true, assignment: assignments[0] });
    } catch (error) {
        console.error('Error fetching my assignment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
