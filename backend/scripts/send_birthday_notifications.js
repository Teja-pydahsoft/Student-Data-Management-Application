const { checkAndSendBirthdayNotifications } = require('../services/birthdayNotificationService');
const { masterPool } = require('../config/database');

const run = async () => {
    try {
        console.log('--- Manual Trigger: Birthday Notifications ---');
        const results = await checkAndSendBirthdayNotifications();
        console.log('--- Summary ---');
        console.log(`Sent: ${results.sent}`);
        console.log(`Failed: ${results.failed}`);
        console.log(`No Subscription: ${results.noSubscription}`);
        console.log('----------------');
    } catch (error) {
        console.error('Script failed:', error);
    } finally {
        // Close pools
        try {
            await masterPool.end();
            console.log('Database connection closed.');
        } catch (e) {
            console.error('Error closing pool', e);
        }
        process.exit(0);
    }
};

run();
