const fs = require("fs");
const path = require("path");
const { masterPool } = require("../config/database");

/**
 * Run all SQL migration files in the migrations directory
 */
async function runMigrations() {
  const migrationsDir = path.join(__dirname, "..", "migrations");

  console.log("🔄 Checking for database migrations...");

  try {
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log("📁 No migrations directory found, skipping migrations.");
      return;
    }

    // Get all .sql files from migrations directory
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort alphabetically to ensure consistent order

    if (files.length === 0) {
      console.log("✅ No migration files found, database is up to date.");
      return;
    }

    console.log(`📋 Found ${files.length} migration file(s)`);

    // Create migrations tracking table if it doesn't exist
    await masterPool.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_migration_name (migration_name)
      )
    `);

    // Process each migration file
    for (const file of files) {
      const migrationName = file;

      // Check if migration has already been executed
      const [rows] = await masterPool.execute(
        "SELECT id FROM schema_migrations WHERE migration_name = ?",
        [migrationName],
      );

      if (rows.length > 0) {
        console.log(`⏭️  Skipping ${migrationName} (already executed)`);
        continue;
      }

      console.log(`🔧 Running migration: ${migrationName}`);

      try {
        // Read the migration file
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf8");

        // Split SQL statements by semicolon (handling multi-statement files)
        const statements = sql
          .split(";")
          .map((stmt) => stmt.trim())
          .filter(
            (stmt) =>
              stmt.length > 0 &&
              !stmt.startsWith("--") &&
              stmt.toLowerCase() !== "use student_database",
          );

        // Execute each statement
        for (const statement of statements) {
          if (
            statement.toLowerCase().startsWith("describe") ||
            statement.toLowerCase().startsWith("show") ||
            statement.toLowerCase().startsWith("select")
          ) {
            // Skip verification statements in migrations
            continue;
          }

          try {
            await masterPool.execute(statement);
          } catch (stmtError) {
            // Check if error is "column/index already exists" or "doesn't exist" - this is okay
            if (
              stmtError.code === "ER_DUP_FIELDNAME" ||
              stmtError.code === "ER_CANT_DROP_FIELD_OR_KEY" ||
              stmtError.code === "ER_DUP_KEYNAME" ||
              stmtError.code === "ER_BAD_FIELD_ERROR" ||
              stmtError.message.includes("Duplicate column name") ||
              stmtError.message.includes("already exists") ||
              stmtError.message.includes("doesn't exist") ||
              stmtError.message.includes("Unknown key")
            ) {
              console.log(
                `   ⚠️  ${stmtError.message} (continuing...)`,
              );
              continue;
            }
            throw stmtError;
          }
        }

        // Record successful migration
        await masterPool.execute(
          "INSERT INTO schema_migrations (migration_name) VALUES (?)",
          [migrationName],
        );

        console.log(`   ✅ Successfully executed ${migrationName}`);
      } catch (error) {
        console.error(`   ❌ Error executing ${migrationName}:`, error.message);

        // Check if it's a "column already exists" error - log warning but continue
        if (
          error.code === "ER_DUP_FIELDNAME" ||
          error.message.includes("Duplicate column name")
        ) {
          console.log(
            `   ⚠️  Migration may have been partially applied, marking as complete.`,
          );

          // Mark as executed to prevent re-running
          await masterPool.execute(
            "INSERT IGNORE INTO schema_migrations (migration_name) VALUES (?)",
            [migrationName],
          );

          continue;
        }

        // For other errors, stop migration process
        throw error;
      }
    }

    console.log("✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration error:", error.message);
    console.error("   Database may be in an inconsistent state.");
    // Don't throw - allow server to continue starting
  }
}

module.exports = { runMigrations };
