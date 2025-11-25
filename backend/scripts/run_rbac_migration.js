const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Run RBAC migration to create users table
 */
async function runRBACMigration() {
  let connection;

  try {
    console.log('🔄 Starting RBAC Migration...\n');

    const dbName = process.env.DB_NAME || 'student_database';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbPort = process.env.DB_PORT || 3306;

    console.log(`📊 Database: ${dbName}`);
    console.log(`🔌 Host: ${dbHost}:${dbPort}\n`);

    // First, connect without database to create it if needed
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL server\n');

    // Create database if it doesn't exist
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      console.log(`✅ Database '${dbName}' ensured\n`);
    } catch (error) {
      console.error('❌ Failed to create database:', error.message);
      throw error;
    }

    // Now connect to the specific database
    await connection.end();
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      multipleStatements: true
    });

    console.log(`✅ Connected to database '${dbName}'\n`);

    // Read migration file
    const migrationPath = path.join(__dirname, 'migration_rbac_users.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Replace hardcoded database name with actual database name
    migrationSQL = migrationSQL.replace(/USE\s+student_database;/gi, `USE \`${dbName}\`;`);

    // Execute migration
    console.log('📋 Creating RBAC users table...\n');
    await connection.query(migrationSQL);

    console.log('✅ RBAC migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Migrate existing admin: node scripts/migrateExistingAdminToRBAC.js');
    console.log('   2. Or create new Super Admin: node scripts/seedSuperAdmin.js');
    console.log('   3. Update your application to use the new RBAC system');
    console.log('   4. Test user creation and permissions\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run migration
runRBACMigration();

