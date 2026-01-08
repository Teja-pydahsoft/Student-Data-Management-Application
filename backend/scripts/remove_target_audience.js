require('dotenv').config({ path: './backend/.env' });
const { masterPool } = require('../config/database');

async function removeTargetAudience() {
    try {
        console.log('Removing target_audience column from clubs table...');

        // Check if column exists before dropping (optional but good practice, though ALTER TABLE DROP doesn't support IF EXISTS in all MySQL versions cleanly in one line without procedure, simple try-catch is usually fine for scripts)
        try {
            await masterPool.query(`ALTER TABLE clubs DROP COLUMN target_audience;`);
            console.log('Successfully dropped target_audience column.');
        } catch (e) {
            if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log('Column target_audience does not exist, skipping.');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

removeTargetAudience();
