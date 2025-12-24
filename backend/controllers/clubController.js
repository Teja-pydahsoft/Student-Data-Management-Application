const { masterPool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { sendNotificationToUser } = require('./pushController');

const getClubs = async (req, res) => {
    try {
        const { role, id } = req.user;

        // Optimize: Fetch IDs sorted first to avoid "Out of sort memory" with large JSON columns
        const [clubIds] = await masterPool.query('SELECT id FROM clubs WHERE is_active = TRUE ORDER BY created_at DESC');

        let clubs = [];
        if (clubIds.length > 0) {
            const ids = clubIds.map(c => c.id);
            // Use parameter expansion for IN clause
            const placeholders = ids.map(() => '?').join(',');
            const [rows] = await masterPool.query(
                `SELECT * FROM clubs WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
                ids
            );
            clubs = rows;
        }

        // Helper to safe parse
        const safeParse = (val) => {
            if (!val) return [];
            try {
                return typeof val === 'string' ? JSON.parse(val) : val;
            } catch (e) {
                return [];
            }
        };

        const parsedClubs = clubs.map(club => ({
            ...club,
            form_fields: safeParse(club.form_fields),
            members: safeParse(club.members),
            activities: safeParse(club.activities)
        }));

        // If student, check membership status for each club
        if (role === 'student') {
            const clubsWithStatus = parsedClubs.map(club => {
                const members = club.members || [];
                const membership = members.find(m => m.student_id === id);

                let userStatus = null;
                if (membership) {
                    userStatus = membership.status;
                }

                // Hide members and activities if not approved
                const { members: _, activities, ...clubData } = club;
                return {
                    ...clubData,
                    userStatus,
                    // Only show activities if approved
                    activities: userStatus === 'approved' ? (club.activities || []) : []
                };
            });
            return res.json({ success: true, data: clubsWithStatus });
        }

        // Admin sees everything
        res.json({ success: true, data: parsedClubs });
    } catch (error) {
        console.error('Error fetching clubs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clubs' });
    }
};

const createClub = async (req, res) => {
    try {
        const { name, description } = req.body;
        let image_url = '';

        if (req.file) {
            image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        } else if (req.body.image_url) {
            image_url = req.body.image_url;
        }

        // Default empty arrays for members and activities
        const members = JSON.stringify([]);
        const activities = JSON.stringify([]);
        const form_fields = JSON.stringify([]);

        await masterPool.query(
            'INSERT INTO clubs (name, description, image_url, form_fields, members, activities, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, description, image_url, form_fields, members, activities, req.user.id]
        );

        res.json({ success: true, message: 'Club created successfully', data: { image_url } });
    } catch (error) {
        console.error('Error creating club:', error);
        res.status(500).json({ success: false, message: 'Failed to create club' });
    }
};

const joinClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const studentId = req.user.id;

        // Get student details for denormalization
        const [students] = await masterPool.query(
            'SELECT student_name, admission_number, batch, course, branch, current_year, current_semester, student_mobile, student_photo FROM students WHERE id = ?',
            [studentId]
        );

        if (students.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

        const student = students[0];

        // Check if already a member
        const [clubs] = await masterPool.query('SELECT members FROM clubs WHERE id = ?', [clubId]);
        if (clubs.length === 0) return res.status(404).json({ success: false, message: 'Club not found' });

        let membersData = clubs[0].members;
        let currentMembers = [];
        try {
            currentMembers = typeof membersData === 'string' ? JSON.parse(membersData) : (membersData || []);
        } catch (e) {
            currentMembers = [];
        }

        if (currentMembers.find(m => m.student_id === studentId)) {
            return res.status(400).json({ success: false, message: 'Already requested or joined' });
        }

        const newMember = {
            student_id: studentId,
            student_name: student.student_name,
            admission_number: student.admission_number,
            batch: student.batch,
            course: student.course,
            branch: student.branch,
            year: student.current_year,
            semester: student.current_semester,
            photo: student.student_photo,
            status: 'pending',
            joined_at: new Date().toISOString()
        };

        // Atomic update using JSON_ARRAY_APPEND
        await masterPool.query(
            "UPDATE clubs SET members = JSON_ARRAY_APPEND(COALESCE(members, JSON_ARRAY()), '$', CAST(? AS JSON)) WHERE id = ?",
            [JSON.stringify(newMember), clubId]
        );

        res.json({ success: true, message: 'Join request sent successfully' });
    } catch (error) {
        console.error('Error joining club:', error);
        res.status(500).json({ success: false, message: 'Failed to join club' });
    }
};

const updateMembershipStatus = async (req, res) => {
    try {
        const { clubId } = req.params;
        const { studentId, status } = req.body; // status: 'approved' | 'rejected'

        // We need to find the index of the member to update. 
        // MySQL JSON modification is tricky for array elements by property value.
        // Read-modify-write is safest for this complexity without complex JSON_SEARCH + path logic.
        // But since "single table" was requested, let's try to be efficient.

        // Fetch current members
        const [rows] = await masterPool.query('SELECT members FROM clubs WHERE id = ?', [clubId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Club not found' });

        let membersData = rows[0].members;
        let members = [];
        try {
            members = typeof membersData === 'string' ? JSON.parse(membersData) : (membersData || []);
        } catch (e) {
            members = [];
        }
        const memberIndex = members.findIndex(m => m.student_id === parseInt(studentId));

        if (memberIndex === -1) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Update status
        members[memberIndex].status = status;
        members[memberIndex].updated_at = new Date().toISOString();

        // Write back
        await masterPool.query('UPDATE clubs SET members = ? WHERE id = ?', [JSON.stringify(members), clubId]);

        res.json({ success: true, message: `Member ${status}` });
    } catch (error) {
        console.error('Error updating membership:', error);
        res.status(500).json({ success: false, message: 'Failed to update membership' });
    }
};

const createActivity = async (req, res) => {
    try {
        const { clubId } = req.params;
        const { title, description } = req.body;
        let image_url = '';

        if (req.file) {
            image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        } else if (req.body.image_url) {
            image_url = req.body.image_url;
        }

        const newActivity = {
            id: uuidv4(),
            title,
            description,
            image_url,
            posted_by: req.user.id,
            posted_at: new Date().toISOString()
        };

        // Atomic append
        await masterPool.query(
            "UPDATE clubs SET activities = JSON_ARRAY_APPEND(COALESCE(activities, JSON_ARRAY()), '$', CAST(? AS JSON)) WHERE id = ?",
            [JSON.stringify(newActivity), clubId]
        );

        res.json({ success: true, message: 'Activity posted successfully' });

        // Notify Club Members
        notifyClubMembers(clubId, title, description).catch(err => console.error('Club notification error:', err));

    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ success: false, message: 'Failed to post activity' });
    }
};

const updateActivity = async (req, res) => {
    try {
        const { clubId, activityId } = req.params;
        const { title, description } = req.body;
        let image_url = null;

        if (req.file) {
            image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        } else if (req.body.image_url) {
            image_url = req.body.image_url;
        }

        // Fetch current activities
        const [rows] = await masterPool.query('SELECT activities FROM clubs WHERE id = ?', [clubId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Club not found' });

        let activities = [];
        try {
            activities = typeof rows[0].activities === 'string' ? JSON.parse(rows[0].activities) : (rows[0].activities || []);
        } catch (e) {
            activities = [];
        }

        const activityIndex = activities.findIndex(a => a.id === activityId);
        if (activityIndex === -1) {
            return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        // Update fields
        activities[activityIndex].title = title;
        activities[activityIndex].description = description;
        if (image_url) {
            activities[activityIndex].image_url = image_url;
        }
        activities[activityIndex].updated_at = new Date().toISOString();

        // Write back
        await masterPool.query('UPDATE clubs SET activities = ? WHERE id = ?', [JSON.stringify(activities), clubId]);

        res.json({ success: true, message: 'Activity updated successfully' });
    } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).json({ success: false, message: 'Failed to update activity' });
    }
};

const deleteActivity = async (req, res) => {
    try {
        const { clubId, activityId } = req.params;

        // Fetch current activities
        const [rows] = await masterPool.query('SELECT activities FROM clubs WHERE id = ?', [clubId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Club not found' });

        let activities = [];
        try {
            activities = typeof rows[0].activities === 'string' ? JSON.parse(rows[0].activities) : (rows[0].activities || []);
        } catch (e) {
            activities = [];
        }

        const newActivities = activities.filter(a => a.id !== activityId);

        if (activities.length === newActivities.length) {
            return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        // Write back
        await masterPool.query('UPDATE clubs SET activities = ? WHERE id = ?', [JSON.stringify(newActivities), clubId]);

        res.json({ success: true, message: 'Activity deleted successfully' });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ success: false, message: 'Failed to delete activity' });
    }
};

// Helper: Notify club members
const notifyClubMembers = async (clubId, title, description) => {
    try {
        const [rows] = await masterPool.query('SELECT members FROM clubs WHERE id = ?', [clubId]);
        if (rows.length === 0) return;

        let members = [];
        try {
            members = typeof rows[0].members === 'string' ? JSON.parse(rows[0].members) : (rows[0].members || []);
        } catch (e) {
            return;
        }

        // Filter approved members
        const approvedMembers = members.filter(m => m.status === 'approved');

        if (approvedMembers.length === 0) return;

        const payload = {
            title: `New Club Activity: ${title}`,
            body: `${description ? description.substring(0, 50) + '...' : 'Check club for details.'}`,
            icon: '/icon-192x192.png',
            data: {
                url: `https://pydahgroup.com/student/clubs/${clubId}`
            }
        };

        const promises = approvedMembers.map(m => sendNotificationToUser(m.student_id, payload));
        await Promise.allSettled(promises);
        console.log(`Club activity notifications sent to ${approvedMembers.length} members.`);

    } catch (error) {
        console.error('Failed to notify club members:', error);
    }
};

const getClubDetails = async (req, res) => {
    try {
        const { clubId } = req.params;
        const [clubs] = await masterPool.query('SELECT * FROM clubs WHERE id = ?', [clubId]);

        if (clubs.length === 0) {
            return res.status(404).json({ success: false, message: 'Club not found' });
        }

        const club = clubs[0];

        // Helper to safe parse
        const safeParse = (val) => {
            if (!val) return [];
            try {
                return typeof val === 'string' ? JSON.parse(val) : val;
            } catch (e) {
                return [];
            }
        };

        const parsedClub = {
            ...club,
            form_fields: safeParse(club.form_fields),
            members: safeParse(club.members),
            activities: safeParse(club.activities)
        };

        res.json({ success: true, data: parsedClub });

    } catch (error) {
        console.error('Error fetching club details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch club details' });
    }
}

const updateClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const { name, description } = req.body;

        // Build update query dynamically
        let query = 'UPDATE clubs SET name = ?, description = ?';
        let params = [name, description];

        if (req.file) {
            const image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            query += ', image_url = ?';
            params.push(image_url);
        }

        query += ' WHERE id = ?';
        params.push(clubId);

        await masterPool.query(query, params);

        res.json({ success: true, message: 'Club updated successfully' });
    } catch (error) {
        console.error('Error updating club:', error);
        res.status(500).json({ success: false, message: 'Failed to update club' });
    }
};

const deleteClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        // Hard delete as requested, or match the query filter
        await masterPool.query('DELETE FROM clubs WHERE id = ?', [clubId]);
        res.json({ success: true, message: 'Club deleted successfully' });
    } catch (error) {
        console.error('Error deleting club:', error);
        res.status(500).json({ success: false, message: 'Failed to delete club' });
    }
};

module.exports = {
    createClub,
    getClubs,
    joinClub,
    updateMembershipStatus,
    createActivity,
    joinClub,
    updateMembershipStatus,
    createActivity,
    getClubDetails,
    updateClub,
    deleteClub,
    updateActivity,
    deleteActivity
};
