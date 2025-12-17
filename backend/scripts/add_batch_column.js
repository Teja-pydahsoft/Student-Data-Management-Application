require('dotenv').config();
const { masterPool } = require('../config/database');

const addBatchColumn = async () => {
    try {
        console.log('Adding target_batch column to announcements table...');

        // Check if column exists
        const [columns] = await masterPool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'announcements' 
            AND COLUMN_NAME = 'target_batch'
        `);

        if (columns.length === 0) {
            await masterPool.query(`
                ALTER TABLE announcements
                ADD COLUMN target_batch TEXT DEFAULT NULL AFTER target_college
            `);
            console.log('Column target_batch added successfully.');
        } else {
            console.log('Column target_batch already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Schema update failed:', error);
        process.exit(1);
    }
};

addBatchColumn();
