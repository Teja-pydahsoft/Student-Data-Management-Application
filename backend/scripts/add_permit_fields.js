const path = require('path');
// Ensure we load the backend .env even when running from repo root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { masterPool } = require('../config/database');

/**
 * Migration: Add permit_ending_date and permit_remarks columns to students table
 * 
 * This script adds:
 * - permit_ending_date: DATE column to store when the permit expires
 * - permit_remarks: TEXT column to store remarks about the permit
 * 
 * Run this script to add the permit fields to the students table.
 */

async function addPermitFields() {
  let connection;
  
  try {
    // Get connection from pool (uses env from backend/.env)
    connection = await masterPool.getConnection();

    console.log('🔍 Checking if permit_ending_date column exists...');
    
    // Get database name from connection
    const dbName = process.env.DB_NAME || 'student_database';
    
    // Check if permit_ending_date column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'students' 
      AND COLUMN_NAME = 'permit_ending_date'
    `, [dbName]);

    if (columns && columns.length > 0) {
      console.log('ℹ️  Column permit_ending_date already exists');
    } else {
      // Add permit_ending_date column
      console.log('➕ Adding permit_ending_date column to students table...');
      await connection.query(`
        ALTER TABLE students
        ADD COLUMN permit_ending_date DATE NULL
      `);
      console.log('✅ Successfully added permit_ending_date column');
    }

    // Check if permit_remarks column already exists
    console.log('🔍 Checking if permit_remarks column exists...');
    const [remarksColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'students' 
      AND COLUMN_NAME = 'permit_remarks'
    `, [dbName]);

    if (remarksColumns && remarksColumns.length > 0) {
      console.log('ℹ️  Column permit_remarks already exists');
    } else {
      // Add permit_remarks column
      console.log('➕ Adding permit_remarks column to students table...');
      await connection.query(`
        ALTER TABLE students
        ADD COLUMN permit_remarks TEXT NULL
      `);
      console.log('✅ Successfully added permit_remarks column');
    }

    // Add index for permit_ending_date
    console.log('🔍 Checking if index on permit_ending_date exists...');
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'students' 
      AND INDEX_NAME = 'idx_permit_ending_date'
    `, [dbName]);

    if (indexes && indexes.length > 0) {
      console.log('ℹ️  Index idx_permit_ending_date already exists');
    } else {
      console.log('➕ Adding index on permit_ending_date...');
      await connection.query(`
        CREATE INDEX idx_permit_ending_date ON students(permit_ending_date)
      `);
      console.log('✅ Successfully added index on permit_ending_date');
    }

    // Verify columns exist
    const [verifyColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'students' 
      AND COLUMN_NAME IN ('permit_ending_date', 'permit_remarks')
    `, [dbName]);

    console.log('\n📋 Verification:');
    verifyColumns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('📝 The permit_ending_date and permit_remarks columns are now available in the students table.');

  } catch (error) {
    console.error('\n❌ Error running migration:', error);
    console.error('\n💡 If you see a syntax error, you may need to run the SQL manually:');
    console.error('   ALTER TABLE students');
    console.error('   ADD COLUMN permit_ending_date DATE NULL,');
    console.error('   ADD COLUMN permit_remarks TEXT NULL;');
    console.error('   CREATE INDEX idx_permit_ending_date ON students(permit_ending_date);');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

// Run migration
if (require.main === module) {
  addPermitFields()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addPermitFields };

