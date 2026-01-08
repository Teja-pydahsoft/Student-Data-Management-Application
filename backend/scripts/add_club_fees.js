const { masterPool } = require('../config/database');

async function runMigration() {
    try {
        console.log('Starting migration: add_club_fees');

        // Add membership_fee column
        try {
            await masterPool.query(
                "ALTER TABLE clubs ADD COLUMN membership_fee DECIMAL(10, 2) DEFAULT 0.00"
            );
            console.log('Added membership_fee column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('membership_fee column already exists');
            } else {
                throw error;
            }
        }

        // Add fee_type column
        try {
            await masterPool.query(
                "ALTER TABLE clubs ADD COLUMN fee_type VARCHAR(20) DEFAULT 'Yearly'"
            );
            console.log('Added fee_type column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('fee_type column already exists');
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
