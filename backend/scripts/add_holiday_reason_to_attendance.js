const path = require('path');
const fs = require('fs');

// Try multiple .env file locations
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../backend/.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    console.log(`📄 Loaded .env from: ${envPath}`);
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file found. Using default values or environment variables.');
  require('dotenv').config();
}

const { masterPool } = require('../config/database');

/**
 * Migration: Add holiday_reason column to attendance_records table
 */
async function addHolidayReasonColumn() {
  let connection;
  
  try {
    console.log('📦 Attempting to connect to database...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'student_database'}`);
    console.log(`   User: ${process.env.DB_USER || 'root'}`);
    
    connection = await masterPool.getConnection();
    console.log('✅ Connected to database');

    const dbName = process.env.DB_NAME || 'student_database';
    
    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'attendance_records' 
        AND COLUMN_NAME = 'holiday_reason'
    `, [dbName]);

    if (columns && columns.length > 0) {
      console.log('✅ Column holiday_reason already exists');
      return;
    }

    // Add holiday_reason column
    console.log('📋 Adding holiday_reason column to attendance_records...');
    await connection.query(`
      ALTER TABLE attendance_records 
      ADD COLUMN holiday_reason TEXT NULL 
      AFTER status
    `);

    console.log('✅ Successfully added holiday_reason column');
    console.log('🎉 Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n💡 Alternative: You can run the SQL script directly:');
    console.error('   mysql -u root -p < backend/scripts/add_holiday_reason_to_attendance.sql');
    console.error('\n   Or manually run this SQL:');
    console.error('   ALTER TABLE attendance_records ADD COLUMN holiday_reason TEXT NULL AFTER status;');
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

// Run the migration
addHolidayReasonColumn();

