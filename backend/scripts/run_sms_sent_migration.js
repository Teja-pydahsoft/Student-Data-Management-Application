const mysql = require('mysql2/promise');
const path = require('path');

// Load .env file from backend directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Migration: Add sms_sent column to attendance_records table
 * 
 * PURPOSE: Track SMS notification status for absent students
 * This allows the UI to show correct SMS status even after page refresh
 */
async function runSmsSentMigration() {
  let connection;

  try {
    // Show connection details (before attempting connection)
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'student_database';
    const dbPort = process.env.DB_PORT || 3306;

    console.log('🔍 Database Connection Details:');
    console.log('📊 Database:', dbName);
    console.log('🔌 Host:', dbHost);
    console.log('🔌 Port:', dbPort);
    console.log('👤 User:', dbUser);
    console.log('🔑 Password:', dbPassword ? '***' : '(not set - using empty string)');
    console.log('');

    // Check if .env file was loaded
    if (!process.env.DB_PASSWORD && !process.env.DB_USER) {
      const envPath = path.join(__dirname, '..', '.env');
      console.log('⚠️  Warning: Environment variables not found.');
      console.log(`   Expected .env file at: ${envPath}`);
      console.log('   Make sure your .env file exists in the backend directory.\n');
    }

    // Create database connection
    console.log('🔄 Attempting to connect to database...');
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database successfully\n');

    // Step 1: Check if sms_sent column exists
    console.log('\n🔍 Step 1: Checking if sms_sent column exists...');
    const [colCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'attendance_records' 
        AND COLUMN_NAME = 'sms_sent'
    `, [dbName]);

    if (colCheck[0].count === 0) {
      console.log('➕ Adding sms_sent column...');
      await connection.execute(`
        ALTER TABLE attendance_records 
        ADD COLUMN sms_sent TINYINT(1) DEFAULT 0 
        COMMENT 'Indicates if SMS notification was sent (1 = sent, 0 = not sent)'
      `);
      console.log('✅ sms_sent column added');
    } else {
      console.log('ℹ️  sms_sent column already exists');
    }

    // Step 2: Check if index exists
    console.log('\n🔍 Step 2: Checking if index exists...');
    const [idxCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'attendance_records' 
        AND INDEX_NAME = 'idx_sms_sent'
    `, [dbName]);

    if (idxCheck[0].count === 0) {
      console.log('➕ Creating index...');
      await connection.execute('CREATE INDEX idx_sms_sent ON attendance_records(sms_sent)');
      console.log('✅ Index created');
    } else {
      console.log('ℹ️  Index already exists');
    }

    // Step 3: Verify the migration
    console.log('\n🔍 Step 3: Verifying migration...');
    const [verifyCol] = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_DEFAULT,
        COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'attendance_records' 
        AND COLUMN_NAME = 'sms_sent'
    `, [dbName]);

    if (verifyCol.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   - Column: ${verifyCol[0].COLUMN_NAME}`);
      console.log(`   - Type: ${verifyCol[0].DATA_TYPE}`);
      console.log(`   - Default: ${verifyCol[0].COLUMN_DEFAULT}`);
      console.log(`   - Comment: ${verifyCol[0].COLUMN_COMMENT || 'N/A'}`);
    } else {
      console.log('⚠️  Warning: Column not found after migration');
    }

    console.log('\n✅ Database migration completed successfully!');
    console.log('📝 The sms_sent column is now available for tracking SMS notification status.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  runSmsSentMigration()
    .then(() => {
      console.log('\n🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runSmsSentMigration };
