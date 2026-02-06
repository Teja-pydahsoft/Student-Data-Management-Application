const { masterPool } = require('../config/database');
const { sendNotificationToUser } = require('../controllers/pushController');
const { sendBirthdaySms } = require('./smsService');

// Birthday message text (aligned with SMS template)
const BIRTHDAY_WISH = 'May this year bring success, happiness, and good health. Keep learning and growing. Best wishes from Pydah Group.';

const checkAndSendBirthdayNotifications = async () => {
    console.log('🎂 Checking for birthdays (12 AM IST)...');
    let conn = null;
    try {
        conn = await masterPool.getConnection();

        // Find students whose birthday is today (by date in server timezone; scheduler runs in Asia/Kolkata)
        // dob: YYYY-MM-DD; use MONTH() and DAY() for today's birthdays
        const [students] = await conn.query(`
            SELECT id, student_name, dob, student_data, admission_number,
                   student_mobile, parent_mobile1, parent_mobile2,
                   current_year, current_semester
            FROM students
            WHERE dob IS NOT NULL
              AND MONTH(dob) = MONTH(CURRENT_DATE())
              AND DAY(dob) = DAY(CURRENT_DATE())
        `);

        console.log(`🎉 Found ${students.length} students with birthdays today.`);

        const results = {
            push: { sent: 0, failed: 0, noSubscription: 0 },
            sms: { sent: 0, failed: 0, skipped: 0 }
        };

        for (const student of students) {
            const firstName = (student.student_name || '').split(' ')[0] || 'Student';

            // 1. Push notification
            const notificationPayload = {
                title: 'Happy Birthday! 🎂',
                body: `Dear ${firstName}, Happy Birthday! ${BIRTHDAY_WISH}`,
                icon: '/assets/icons/birthday-cake.png',
                data: { url: '/student/dashboard' }
            };

            try {
                const response = await sendNotificationToUser(student.id, notificationPayload);
                if (response.success) {
                    console.log(`✅ Push: ${student.student_name} (${student.admission_number})`);
                    results.push.sent++;
                } else {
                    if (response.message === 'No subscriptions found for user') {
                        results.push.noSubscription++;
                    } else {
                        console.error(`❌ Push failed for ${student.student_name}:`, response.error || response.message);
                        results.push.failed++;
                    }
                }
            } catch (err) {
                console.error(`❌ Push error for ${student.admission_number}:`, err);
                results.push.failed++;
            }

            // 2. Birthday SMS (template: Dear {#var#} Happy Birthday! ...)
            try {
                const smsResult = await sendBirthdaySms({ student });
                if (smsResult.success) {
                    results.sms.sent++;
                } else if (smsResult.skipped) {
                    results.sms.skipped++;
                } else {
                    results.sms.failed++;
                }
            } catch (err) {
                console.error(`❌ SMS error for ${student.admission_number}:`, err);
                results.sms.failed++;
            }
        }

        console.log('🎂 Birthday summary:', results);
        return results;

    } catch (error) {
        console.error('Error in birthday check:', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
};

module.exports = { checkAndSendBirthdayNotifications };
