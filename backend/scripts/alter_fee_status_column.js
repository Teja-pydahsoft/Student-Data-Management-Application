const path = require('path');
// Ensure backend .env is loaded
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { masterPool } = require('../config/database');

/**
 * Migration: relax fee_status/registration_status to VARCHAR to allow new values
 * - fee_status: VARCHAR(20) DEFAULT 'pending'
 * - registration_status: VARCHAR(20) DEFAULT 'pending'
 *
 * This supports values like "no due", "due", "permitted", "completed".
 */
async function alterStatusColumns() {
  let connection;
  try {
    connection = await masterPool.getConnection();

    console.log('🔧 Modifying fee_status and registration_status columns to VARCHAR(20)...');
    await connection.query(`
      ALTER TABLE students
      MODIFY fee_status VARCHAR(20) DEFAULT 'pending',
      MODIFY registration_status VARCHAR(20) DEFAULT 'pending'
    `);

    console.log('✅ Columns modified successfully');

    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'students'
        AND COLUMN_NAME IN ('fee_status', 'registration_status')
    `);

    console.log('📋 Verification:');
    columns.forEach(col => {
      console.log(` - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}, default=${col.COLUMN_DEFAULT}`);
    });
  } catch (err) {
    console.error('❌ Error altering columns:', err);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  alterStatusColumns()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { alterStatusColumns };

