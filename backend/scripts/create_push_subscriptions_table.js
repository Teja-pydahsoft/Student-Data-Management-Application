const { masterPool } = require('../config/database');

async function createPushSubscriptionsTable() {
    let conn = null;
    try {
        console.log('🔧 Creating push_subscriptions table...');

        conn = await masterPool.getConnection();

        await conn.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        endpoint TEXT NOT NULL,
        keys_auth VARCHAR(255) NOT NULL,
        keys_p256dh VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        console.log('✅ push_subscriptions table created successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (conn) conn.release();
    }
}

if (require.main === module) {
    createPushSubscriptionsTable()
        .then(() => {
            console.log('✅ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}
