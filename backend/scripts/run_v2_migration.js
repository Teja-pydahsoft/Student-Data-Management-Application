/**
 * Run Pydah v2.0 faculty & academics migration manually.
 * Usage: node backend/scripts/run_v2_migration.js
 * (Or rely on server startup which runs all migrations in backend/migrations/)
 */

const path = require('path');
const fs = require('fs');
const { masterPool } = require('../config/database');

async function run() {
  const file = path.join(__dirname, '..', 'migrations', 'pydah_v2_faculty_and_academics.sql');
  if (!fs.existsSync(file)) {
    console.error('Migration file not found:', file);
    process.exit(1);
  }
  const sql = fs.readFileSync(file, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--') && s.toLowerCase() !== 'use student_database');
  for (const stmt of statements) {
    if (stmt.toLowerCase().startsWith('select')) continue;
    try {
      await masterPool.execute(stmt);
      console.log('OK:', stmt.slice(0, 80).replace(/\s+/g, ' ') + '...');
    } catch (e) {
      if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_DUP_KEYNAME' || e.message?.includes('already exists')) {
        console.log('Skip (exists):', e.message);
      } else throw e;
    }
  }
  console.log('v2 migration completed.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
