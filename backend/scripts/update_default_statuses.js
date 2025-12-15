const path = require('path');
// Ensure we load the backend .env even when running from repo root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { masterPool } = require('../config/database');

/**
 * Script to update default fee_status and registration_status for students
 * 
 * This script updates:
 * - fee_status to 'no due' for all students
 * - registration_status to 'completed' for all students
 * 
 * Run this script to set default statuses for existing students.
 */

async function updateDefaultStatuses() {
  let connection;
  
  try {
    // Get connection from pool
    connection = await masterPool.getConnection();

    console.log('🔍 Checking if fee_status and registration_status columns exist...');
    
    // Check if columns exist
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'students' 
      AND COLUMN_NAME IN ('fee_status', 'registration_status')
    `, [process.env.DB_NAME || 'student_database']);

    const hasFeeStatus = columns.some(col => col.COLUMN_NAME === 'fee_status');
    const hasRegistrationStatus = columns.some(col => col.COLUMN_NAME === 'registration_status');

    if (!hasFeeStatus || !hasRegistrationStatus) {
      console.log('❌ Required columns do not exist. Please run add_status_columns migration first.');
      return;
    }

    console.log('✅ Columns exist. Proceeding with update...');

    // Update fee_status to 'no due' and registration_status to 'completed'
    console.log('📝 Updating fee_status to "no due" and registration_status to "completed"...');
    
    const [result] = await connection.query(`
      UPDATE students 
      SET fee_status = 'no due',
          registration_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE student_status = 'Regular'
        AND current_semester = 1
    `);

    console.log(`✅ Updated ${result.affectedRows} student(s)`);

    // Verify updates
    const [verifyFeeStatus] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM students 
      WHERE fee_status = 'no due' 
        AND student_status = 'Regular'
        AND current_semester = 1
    `);

    const [verifyRegStatus] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM students 
      WHERE registration_status = 'completed' 
        AND student_status = 'Regular'
        AND current_semester = 1
    `);

    console.log('\n📋 Verification:');
    console.log(`   - Students with fee_status = 'no due': ${verifyFeeStatus[0].count}`);
    console.log(`   - Students with registration_status = 'completed': ${verifyRegStatus[0].count}`);

    console.log('\n✅ Update completed successfully!');

  } catch (error) {
    console.error('\n❌ Error updating statuses:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

// Run script
if (require.main === module) {
  updateDefaultStatuses()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateDefaultStatuses };

