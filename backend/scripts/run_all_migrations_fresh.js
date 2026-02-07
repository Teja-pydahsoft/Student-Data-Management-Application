/**
 * Run migrations including re-running create_chat_tables if tables are missing.
 * Use when chat tables were marked "executed" but never actually created.
 * Usage: node backend/scripts/run_all_migrations_fresh.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { runMigrations } = require("./runMigrations");
const { masterPool } = require("../config/database");

async function ensureChatTables() {
  const dbName = process.env.DB_NAME || "student_database";
  const [rows] = await masterPool.execute(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = 'chat_channels' LIMIT 1",
    [dbName]
  );
  if (rows.length > 0) return;
  // Tables missing - remove from schema_migrations so runMigrations will re-run
  await masterPool.execute(
    "DELETE FROM schema_migrations WHERE migration_name = ?",
    ["create_chat_tables.sql"]
  );
  console.log("   chat tables missing - will re-run create_chat_tables.sql");
}

async function run() {
  await ensureChatTables();
  await runMigrations();
  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
