/**
 * One-time: Remove the add_year_semester_to_attendance_records migration record
 * so it runs again on next server start (Option B).
 * Run: node scripts/reset_year_semester_migration.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { masterPool } = require('../config/database');

async function main() {
  try {
    const [r] = await masterPool.execute(
      "DELETE FROM schema_migrations WHERE migration_name = 'add_year_semester_to_attendance_records.sql'"
    );
    console.log('Removed migration record. Rows affected:', r.affectedRows);
    console.log('Restart the server so the migration runs again and adds the year/semester columns.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main();
