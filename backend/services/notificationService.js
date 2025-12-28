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
        await masterPool.query(
            `INSERT INTO sms_logs (student_id, title, message, category, type, status, message_id)
       VALUES (?, ?, ?, ?, ?, 'Sent', ?)`,
            [studentId, title, message, category, type, data ? JSON.stringify(data) : null]
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
