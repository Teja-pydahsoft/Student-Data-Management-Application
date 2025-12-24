const { masterPool } = require('../config/database');

async function checkSubscriptions() {
    try {
        const [rows] = await masterPool.query('SELECT COUNT(*) as count FROM push_subscriptions');
        console.log(`Current subscription count: ${rows[0].count}`);
        process.exit(0);
    } catch (error) {
        console.error('Error checking subscriptions:', error);
        process.exit(1);
    }
}

checkSubscriptions();
