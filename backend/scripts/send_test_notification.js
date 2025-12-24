require('dotenv').config();
const webpush = require('web-push');
const { masterPool } = require('../config/database');

// Configure web-push
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function sendTestNotification() {
    let conn = null;
    try {
        console.log('🔔 Sending test notifications...');

        conn = await masterPool.getConnection();
        const [subscriptions] = await conn.query('SELECT * FROM push_subscriptions');

        if (subscriptions.length === 0) {
            console.log('⚠️  No subscriptions found in database.');
            console.log('👉 Please log in to the frontend first to subscribe this device.');
            return;
        }

        console.log(`Found ${subscriptions.length} subscriptions.`);

        const payload = JSON.stringify({
            title: 'Test Notification',
            body: 'This is a test notification from the student portal!',
            icon: '/icon-192x192.png'
        });

        const promises = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.keys_auth,
                    p256dh: sub.keys_p256dh
                }
            };

            return webpush.sendNotification(pushSubscription, payload)
                .then(() => ({ success: true, id: sub.id }))
                .catch(err => ({ success: false, id: sub.id, error: err.message }));
        });

        const results = await Promise.all(promises);

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`✅ Sent: ${successful}`);
        console.log(`❌ Failed: ${failed}`);

        if (failed > 0) {
            console.log('First failure reason:', results.find(r => !r.success).error);
        }

    } catch (error) {
        console.error('❌ Error sending notifications:', error);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

sendTestNotification();
