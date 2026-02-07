/**
 * Run chat tables migration (standalone).
 * Usage: node backend/scripts/run_chat_migration.js
 */
const fs = require('fs');
const path = require('path');
const { masterPool } = require('../config/database');

async function run() {
  const file = path.join(__dirname, '..', 'migrations', 'create_chat_tables.sql');
  if (!fs.existsSync(file)) {
    console.error('Migration file not found');
    process.exit(1);
  }
  const sql = fs.readFileSync(file, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
  for (const stmt of statements) {
    try {
      await masterPool.execute(stmt);
      console.log('OK');
    } catch (e) {
      if (e.message?.includes('already exists') || e.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('Tables already exist, skipping.');
      } else {
        throw e;
      }
    }
  }
  console.log('Chat tables migration completed.');
  process.exit(0);
}
run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
