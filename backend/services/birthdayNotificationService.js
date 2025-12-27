const { masterPool } = require('../config/database');
const { sendNotificationToUser } = require('../controllers/pushController');

const checkAndSendBirthdayNotifications = async () => {
    console.log('🎂 Checking for birthdays...');
    let conn = null;
    try {
        conn = await masterPool.getConnection();

        // Find students whose birthday is today
        // Note: dob is stored as YYYY-MM-DD string or Date object
        // We use MySQL functions MONTH() and DAY()

        const [students] = await conn.query(`
            SELECT id, student_name, dob, student_data, admission_number 
            FROM students 
            WHERE 
                (dob IS NOT NULL AND MONTH(dob) = MONTH(CURRENT_DATE()) AND DAY(dob) = DAY(CURRENT_DATE()))
        `);

        console.log(`🎉 Found ${students.length} students with birthdays today.`);

        const results = {
            sent: 0,
            failed: 0,
            noSubscription: 0
        };

        for (const student of students) {
            const firstName = student.student_name.split(' ')[0];
            const notificationPayload = {
                title: 'Happy Birthday! 🎂',
                body: `Dear ${firstName}, wishing you a fantastic birthday filled with joy and success!`,
                icon: '/assets/icons/birthday-cake.png', // Ensure this icon exists or use default
                data: {
                    url: '/student/dashboard'
                }
            };

            try {
                // Check if user has subscription (handled by controller function, but helpful to log)
                // We map student.id to user_id in push_subscriptions. 
                // However, push_subscriptions uses user_id which usually refers to rbac_users or students depending on valid implementation.
                // In Pydah Backend, students might not be in rbac_users if they are just students. 
                // If auth uses student.id as user.id, then we are good.

                const response = await sendNotificationToUser(student.id, notificationPayload);

                if (response.success) {
                    console.log(`✅ Sent birthday notification to ${student.student_name} (${student.admission_number})`);
                    results.sent++;
                } else {
                    if (response.message === 'No subscriptions found for user') {
                        results.noSubscription++;
                    } else {
                        console.error(`❌ Failed to send to ${student.student_name}:`, response.error || response.message);
                        results.failed++;
                    }
                }
            } catch (err) {
                console.error(`❌ Error processing student ${student.admission_number}:`, err);
                results.failed++;
            }
        }

        return results;

    } catch (error) {
        console.error('Error in birthday check:', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
};

module.exports = { checkAndSendBirthdayNotifications };
