const { masterPool } = require('../config/database');

const updatePollsTable = async () => {
    try {
        console.log('Adding start_time and end_time to polls table...');

        // Add columns if they don't exist
        // Using a safe approach by checking or just trying to add and catching duplicate column error is messy in raw SQL without stored procedures.
        // We will just run ALTER TABLE and ignore "duplicate column" errors if they happen, or check simpler.

        // Since we know the table state from previous steps (it doesn't have them), we can force add.

        await masterPool.query(`
            ALTER TABLE polls
            ADD COLUMN start_time DATETIME NULL AFTER is_active,
            ADD COLUMN end_time DATETIME NULL AFTER start_time
        `);

        console.log('Polls table updated successfully.');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist.');
            process.exit(0);
        }
        console.error('Error updating polls table:', error);
        process.exit(1);
    }
};

updatePollsTable();
