const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');

const alterSmsLogsTable = async () => {
    try {
        console.log('🔄 Checking if sms_logs table needs to be altered for web notifications...');

        // Check if 'type' column exists
        const [columns] = await masterPool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'sms_logs' 
      AND COLUMN_NAME = 'type'
    `);

        if (columns.length === 0) {
            console.log('⚠️  Adding new columns (type, title, is_read) to sms_logs...');

            // Add columns
            await masterPool.query(`
        ALTER TABLE sms_logs
        ADD COLUMN type VARCHAR(20) DEFAULT 'SMS' AFTER message,
        ADD COLUMN title VARCHAR(255) DEFAULT NULL AFTER type,
        ADD COLUMN is_read BOOLEAN DEFAULT FALSE AFTER status; 
      `);

            // Add indexes for performance
            await masterPool.query(`
        ALTER TABLE sms_logs
        ADD INDEX idx_type (type),
        ADD INDEX idx_is_read (is_read);
      `);

            console.log('✅ sms_logs table altered successfully.');
        } else {
            console.log('ℹ️  sms_logs table already has the required columns.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error altering sms_logs table:', error);
        process.exit(1);
    }
};

alterSmsLogsTable();
