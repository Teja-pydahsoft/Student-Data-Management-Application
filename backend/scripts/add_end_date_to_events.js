const { masterPool } = require('../config/database');

const run = async () => {
    try {
        console.log('Adding end_date column to events table...');

        // Check if column exists
        const [columns] = await masterPool.query("SHOW COLUMNS FROM events LIKE 'end_date'");
        if (columns.length > 0) {
            console.log('Column end_date already exists.');
        } else {
            await masterPool.query("ALTER TABLE events ADD COLUMN end_date DATE DEFAULT NULL AFTER event_date");
            console.log('Column end_date added successfully.');
        }

    } catch (error) {
        console.error('Failed to update events table:', error);
    } finally {
        process.exit();
    }
};

run();
