const { masterPool } = require('../config/database');

/**
 * Get notifications for a student
 * Fetches "WEB" type messages from sms_logs
 */
exports.getNotifications = async (req, res) => {
    try {
        // Determine student ID from auth user
        // The auth middleware puts user details in req.user
        // For students, req.user will contain the student data including 'id' (from previous middleware analysis)
        // Wait, let's double check auth middleware details in step 28.
        // In auth middleware (step 28), it decodes token.
        // In authController (step 33), unifiedLogin signs: { id: studentValid.student_id, role: 'student' ... }
        // So req.user.id is the student_id.

        const studentId = req.user.id;
        const { role } = req.user;

        if (role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can access notifications' });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [notifications] = await masterPool.query(
            `SELECT id, title, message, is_read, sent_at as created_at, category, message_id as data 
       FROM sms_logs 
       WHERE student_id = ? AND type = 'WEB'
       ORDER BY sent_at DESC
       LIMIT ? OFFSET ?`,
            [studentId, limit, offset]
        );

        const [countResult] = await masterPool.query(
            `SELECT COUNT(*) as total, 
       SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count
       FROM sms_logs 
       WHERE student_id = ? AND type = 'WEB'`,
            [studentId]
        );

        const total = countResult[0].total;
        const unreadCount = countResult[0].unread_count || 0;

        res.json({
            success: true,
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            unreadCount
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
    try {
        const studentId = req.user.id;
        const notificationId = req.params.id;

        await masterPool.query(
            `UPDATE sms_logs 
       SET is_read = 1 
       WHERE id = ? AND student_id = ? AND type = 'WEB'`,
            [notificationId, studentId]
        );

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const studentId = req.user.id;

        await masterPool.query(
            `UPDATE sms_logs 
       SET is_read = 1 
       WHERE student_id = ? AND type = 'WEB' AND is_read = 0`,
            [studentId]
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
    try {
        const studentId = req.user.id;
        const notificationId = req.params.id;

        // Hard delete or Soft delete? Using Hard delete for now as per "remove" requirement.
        await masterPool.query(
            `DELETE FROM sms_logs 
       WHERE id = ? AND student_id = ? AND type = 'WEB'`,
            [notificationId, studentId]
        );

        res.json({ success: true, message: 'Notification removed' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Delete all notifications
 */
exports.clearAllNotifications = async (req, res) => {
    try {
        const studentId = req.user.id;

        await masterPool.query(
            `DELETE FROM sms_logs 
       WHERE student_id = ? AND type = 'WEB'`,
            [studentId]
        );

        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
