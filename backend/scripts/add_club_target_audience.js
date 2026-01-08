const { masterPool } = require('../config/database');

async function runMigration() {
    try {
        console.log('Starting migration: add_club_target_audience');

        // Add target_audience column (JSON)
        try {
            await masterPool.query(
                "ALTER TABLE clubs ADD COLUMN target_audience JSON DEFAULT NULL"
            );
            console.log('Added target_audience column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('target_audience column already exists');
            } else {
                throw error;
            }
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
