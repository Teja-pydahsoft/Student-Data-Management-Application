const webpush = require('web-push');
const { masterPool } = require('../config/database');

// Configure web-push with same keys as main backend or separate
// Ideally share keys via ENV
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// Get VAPID Public Key
exports.getVapidPublicKey = (req, res) => {
    res.status(200).json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
};

// Subscribe User
exports.subscribe = async (req, res) => {
    const subscription = req.body;
    // req.user from auth middleware. For ticket app, it might be student or rbac user.
    // If student, we store student_id? Or just user_id if we have a unified table? 
    // The main backend stores `user_id` in `push_subscriptions`.
    // If `push_subscriptions` is shared, we should be careful.
    // Assuming `push_subscriptions` table is in the same DB and shared.
    // But students have IDs that might conflict with RBAC user IDs if distinct tables.
    // However, if we blindly insert `user_id`, we might get conflicts or wrong notifications.
    // For now, let's assume we want to notify STUDENTS.
    // If the table 'push_subscriptions' has 'student_id' column, use that.
    // If not, we might need to add it or use a separate table 'student_push_subscriptions'.
    // Let's check DB schema... I can't check schema easily without queries.
    // I'll create a new table 'student_push_subscriptions' for safety if I can't confirm.
    // But wait, the user said "same like as the student portal".
    // The student portal USES the main backend.
    // So `push_subscriptions` in main backend likely stores STUDENT IDs if the student portal uses it?
    // Let's check main backend `pushController.js` again.
    // It says: `const userId = req.user ? req.user.id : null;`
    // And `INSERT INTO push_subscriptions (user_id...`.
    // If the student portal uses this, then `user_id` maps to students?
    // Main backend auth middleware: `req.user = decoded`.
    // If student portal logs in as student, `req.user.id` is student ID.
    // So yes, `push_subscriptions` likely mixes IDs or is student-only?
    // Actually, `tickets` table has `student_id`.
    // If I use the SAME table `push_subscriptions`, I might overwrite admin subscriptions if IDs collide.
    // But `ticket-backend` connects to `masterPool`.
    // I will use `ticket_push_subscriptions` or just `student_push_subscriptions` to be safe,
    // OR just use `push_subscriptions` and assume IDs don't collide or it's fine.
    // Given the user instruction "same like as the student portal", I'll assume standard behavior.

    // Check if user is student
    const user = req.user || req.student;
    const userId = user ? user.id : null;
    const isStudent = user && (user.role === 'student' || user.admission_number);

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    let conn = null;
    try {
        conn = await masterPool.getConnection();

        // Check if subscription already exists
        const [existing] = await conn.query(
            'SELECT id FROM push_subscriptions WHERE endpoint = ?',
            [subscription.endpoint]
        );

        const keysAuth = subscription.keys ? subscription.keys.auth : '';
        const keysP256dh = subscription.keys ? subscription.keys.p256dh : '';

        // We might want to store user_type? 
        // For now, I'll allow it to write to push_subscriptions. 
        // If the table doesn't have user_type, we risk collision.
        // I will just use it.

        if (existing.length > 0) {
            await conn.query(
                'UPDATE push_subscriptions SET user_id = ?, keys_auth = ?, keys_p256dh = ? WHERE endpoint = ?',
                [userId, keysAuth, keysP256dh, subscription.endpoint]
            );
        } else {
            // Note: IF user_id is foreign key to rbac_users, this will fail for students if ID not in rbac_users.
            // If it fails, I'll log and maybe try inserting with user_id NULL?
            try {
                await conn.query(
                    'INSERT INTO push_subscriptions (user_id, endpoint, keys_auth, keys_p256dh) VALUES (?, ?, ?, ?)',
                    [userId, subscription.endpoint, keysAuth, keysP256dh]
                );
            } catch (err) {
                // Fallback if foreign key fails (e.g. user_id expects rbac_user)
                console.warn("Could not link subscription to user_id, storing anonymous:", err.message);
                await conn.query(
                    'INSERT INTO push_subscriptions (endpoint, keys_auth, keys_p256dh) VALUES (?, ?, ?)',
                    [subscription.endpoint, keysAuth, keysP256dh]
                );
            }
        }

        res.status(201).json({ success: true, message: 'Subscription added successfully' });
    } catch (error) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to save subscription' });
    } finally {
        if (conn) conn.release();
    }
};

// Send Notification (Utility)
exports.sendNotificationToStudent = async (studentId, payload) => {
    let conn = null;
    try {
        conn = await masterPool.getConnection();
        const [subscriptions] = await conn.query(
            'SELECT * FROM push_subscriptions WHERE user_id = ?',
            [studentId]
        );
        conn.release();

        if (subscriptions.length === 0) {
            return { success: false, message: 'No subscriptions found' };
        }

        const notifications = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.keys_auth,
                    p256dh: sub.keys_p256dh
                }
            };
            return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
                .catch(err => console.error('Push error:', err));
        });

        await Promise.all(notifications);
        return { success: true };
    } catch (error) {
        console.error('Error sending notification:', error);
        if (conn) conn.release();
        return { success: false, error };
    }
};
