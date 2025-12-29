const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');

async function addLoginStatsColumns() {
    let connection;
    try {
        connection = await masterPool.getConnection();
        console.log('📦 Connected to database');

        console.log('Checking for last_login column...');
        const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'student_credentials' 
      AND COLUMN_NAME = 'last_login'
    `);

        if (columns.length === 0) {
            console.log('Adding last_login and login_count columns...');
            await connection.query(`
        ALTER TABLE student_credentials
        ADD COLUMN last_login DATETIME NULL,
        ADD COLUMN login_count INT DEFAULT 0
      `);
            console.log('✅ Columns added successfully');
        } else {
            console.log('ℹ️ Columns already exist');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

addLoginStatsColumns();
