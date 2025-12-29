const { masterPool } = require('../config/database');

/**
 * Get notifications for a student
 * Fetches "WEB" type messages from sms_logs
 */
exports.getNotifications = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { role } = req.user;

        if (role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can access notifications' });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Fetch notifications where mobile_number = 'WEB'
        // Map status 'Sent' -> Unread, 'Read' -> Read
        const [rows] = await masterPool.query(
            `SELECT id, message, status, sent_at as created_at, category, message_id as data
       FROM sms_logs 
       WHERE student_id = ? AND mobile_number = 'WEB'
       ORDER BY sent_at DESC
       LIMIT ? OFFSET ?`,
            [studentId, limit, offset]
        );

        const notifications = rows.map(row => {
            // Extract title from message (format: **Title**\nMessage)
            let title = 'Notification';
            let message = row.message;

            const titleMatch = row.message.match(/^\*\*(.*?)\*\*\n/);
            if (titleMatch) {
                title = titleMatch[1];
                message = row.message.substring(titleMatch[0].length);
            }

            return {
                id: row.id,
                title,
                message,
                is_read: row.status === 'Read' ? 1 : 0,
                created_at: row.created_at,
                category: row.category,
                data: row.data
            };
        });

        const [countResult] = await masterPool.query(
            `SELECT COUNT(*) as total, 
       SUM(CASE WHEN status != 'Read' THEN 1 ELSE 0 END) as unread_count
       FROM sms_logs 
       WHERE student_id = ? AND mobile_number = 'WEB'`,
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
       SET status = 'Read' 
       WHERE id = ? AND student_id = ? AND mobile_number = 'WEB'`,
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
       SET status = 'Read' 
       WHERE student_id = ? AND mobile_number = 'WEB' AND status != 'Read'`,
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

        await masterPool.query(
            `DELETE FROM sms_logs 
       WHERE id = ? AND student_id = ? AND mobile_number = 'WEB'`,
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
       WHERE student_id = ? AND mobile_number = 'WEB'`,
            [studentId]
        );

        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
