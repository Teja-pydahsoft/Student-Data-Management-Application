const { masterPool } = require('../config/database');

/**
 * Create a web notification
 * @param {Object} params
 * @param {number|string} params.studentId - Recipient Student ID
 * @param {string} params.title - Short title
 * @param {string} params.message - Content
 * @param {string} params.category - Category (e.g., Attendance, Event, Service)
 * @param {string} [params.type='WEB'] - Notification type
 */
exports.createNotification = async ({ studentId, title, message, category = 'General', type = 'WEB', data = null }) => {
    try {
        // Use existing sms_logs columns. Mapping:
        // mobile_number -> 'WEB' (to identify it)
        // message -> title + \n + message (since there's no title column)
        // status -> 'Sent' (Unread) / 'Read' (Read)
        // category -> category
        // message_id -> JSON string of data (if any)

        const fullMessage = title ? `**${title}**\n${message}` : message;

        await masterPool.query(
            `INSERT INTO sms_logs (student_id, mobile_number, message, category, status, message_id)
       VALUES (?, 'WEB', ?, ?, 'Sent', ?)`,
            [studentId, fullMessage, category, data ? JSON.stringify(data) : null]
        );
        console.log(`🔔 Notification created for Student ${studentId}: ${title}`);
        return true;
    } catch (error) {
        console.error('❌ Error creating notification:', error);
        return false;
    }
};

/**
 * Create broadcast notification for multiple students
 * @param {Array<number>} studentIds
 * @param {Object} params
 */
exports.createBroadcastNotification = async (studentIds, { title, message, category }) => {
    if (!studentIds || studentIds.length === 0) return;

    try {
        // Bulk insert could be better, but simple loop is safer for now
        for (const studentId of studentIds) {
            await exports.createNotification({ studentId, title, message, category });
        }
    } catch (error) {
        console.error('Error broadcasting notifications:', error);
    }
};
