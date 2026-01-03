const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');

const updateSchema = async () => {
    try {
        console.log('Updating announcements table schema...');

        // 1. Drop index if exists (it uses old columns)
        try {
            await masterPool.query('DROP INDEX idx_targets ON announcements');
            console.log('Dropped old index idx_targets');
        } catch (e) {
            // Ignore if index doesn't exist
        }

        // 2. Add target_batch column if it doesn't exist
        try {
            const [columns] = await masterPool.query("SHOW COLUMNS FROM announcements LIKE 'target_batch'");
            if (columns.length === 0) {
                await masterPool.query('ALTER TABLE announcements ADD COLUMN target_batch TEXT DEFAULT NULL AFTER target_college');
                console.log('Added target_batch column');
            }
        } catch (e) {
            console.error('Error checking/adding target_batch:', e);
        }

        // 3. Modify all target columns to TEXT to support JSON arrays
        console.log('Modifying column types to TEXT...');
        await masterPool.query(`
            ALTER TABLE announcements 
            MODIFY COLUMN target_college TEXT DEFAULT NULL,
            MODIFY COLUMN target_batch TEXT DEFAULT NULL,
            MODIFY COLUMN target_course TEXT DEFAULT NULL,
            MODIFY COLUMN target_branch TEXT DEFAULT NULL,
            MODIFY COLUMN target_year TEXT DEFAULT NULL,
            MODIFY COLUMN target_semester TEXT DEFAULT NULL
        `);

        console.log('✅ Announcements table schema updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating schema:', error);
        process.exit(1);
    }
};

updateSchema();
