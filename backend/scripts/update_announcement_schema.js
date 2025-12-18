const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');

const updateSchema = async () => {
    try {
        console.log('Updating announcements table schema...');

        // Alter columns to support JSON/Text arrays
        // Drop index first to avoid BLOB/TEXT key error
        try {
            await masterPool.query('DROP INDEX idx_targets ON announcements');
        } catch (e) {
            console.log('Index might not exist, continuing...');
        }

        // Alter columns to support JSON/Text arrays
        await masterPool.query(`
            ALTER TABLE announcements 
            MODIFY COLUMN target_college TEXT DEFAULT NULL,
            MODIFY COLUMN target_course TEXT DEFAULT NULL,
            MODIFY COLUMN target_branch TEXT DEFAULT NULL,
            MODIFY COLUMN target_year VARCHAR(255) DEFAULT NULL,
            MODIFY COLUMN target_semester VARCHAR(255) DEFAULT NULL;
        `);

        console.log('✅ Announcements table schema updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating schema:', error);
        process.exit(1);
    }
};

updateSchema();
