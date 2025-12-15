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
 * Migration: Add fee_status and registration_status columns to students table
 * 
 * PURPOSE: Add status tracking columns for fee payment and registration completion
 * - fee_status: ENUM('pending', 'partially_completed', 'completed') DEFAULT 'pending'
 * - registration_status: ENUM('pending', 'completed') DEFAULT 'pending'
 */
async function addStatusColumns() {
  let connection;
  
  try {
    console.log('📦 Attempting to connect to database...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'student_database'}`);
    console.log(`   User: ${process.env.DB_USER || 'root'}`);
    
    connection = await masterPool.getConnection();
    console.log('✅ Connected to database\n');

    const dbName = process.env.DB_NAME || 'student_database';
    
    // Check if fee_status column already exists
    console.log('🔍 Step 1: Checking if fee_status column exists...');
    const [feeStatusColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'fee_status'
    `, [dbName]);

    if (feeStatusColumns && feeStatusColumns.length > 0) {
      console.log('ℹ️  Column fee_status already exists');
    } else {
      // Add fee_status column
      console.log('➕ Adding fee_status column to students table...');
      await connection.query(`
        ALTER TABLE students
        ADD COLUMN fee_status ENUM('pending', 'partially_completed', 'completed') DEFAULT 'pending'
      `);
      console.log('✅ Successfully added fee_status column');
    }

    // Check if registration_status column already exists
    console.log('\n🔍 Step 2: Checking if registration_status column exists...');
    const [regStatusColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'registration_status'
    `, [dbName]);

    if (regStatusColumns && regStatusColumns.length > 0) {
      console.log('ℹ️  Column registration_status already exists');
    } else {
      // Add registration_status column
      console.log('➕ Adding registration_status column to students table...');
      await connection.query(`
        ALTER TABLE students
        ADD COLUMN registration_status ENUM('pending', 'completed') DEFAULT 'pending'
      `);
      console.log('✅ Successfully added registration_status column');
    }

    // Verify the migration
    console.log('\n🔍 Step 3: Verifying migration...');
    const [verifyColumns] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        COLUMN_TYPE,
        COLUMN_DEFAULT,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME IN ('fee_status', 'registration_status')
      ORDER BY COLUMN_NAME
    `, [dbName]);

    if (verifyColumns.length > 0) {
      console.log('✅ Verification successful:');
      verifyColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}:`);
        console.log(`     Type: ${col.COLUMN_TYPE}`);
        console.log(`     Default: ${col.COLUMN_DEFAULT}`);
        console.log(`     Nullable: ${col.IS_NULLABLE}`);
      });
    } else {
      console.log('⚠️  Warning: Columns not found after migration');
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 The fee_status and registration_status columns are now available in the students table.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Full error:', error);
    console.error('\n💡 Alternative: You can run the SQL script directly:');
    console.error('   mysql -u root -p < backend/scripts/add_status_columns.sql');
    console.error('\n   Or manually run this SQL:');
    console.error('   ALTER TABLE students');
    console.error('   ADD COLUMN fee_status ENUM(\'pending\', \'partially_completed\', \'completed\') DEFAULT \'pending\',');
    console.error('   ADD COLUMN registration_status ENUM(\'pending\', \'completed\') DEFAULT \'pending\';');
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await masterPool.end();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the migration
if (require.main === module) {
  addStatusColumns()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { addStatusColumns };

