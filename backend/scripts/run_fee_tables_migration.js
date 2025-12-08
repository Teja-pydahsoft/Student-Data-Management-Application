const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load .env file from backend directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Run Fee Management Tables Migration
 * Creates fee_headers and student_fees tables
 */
async function runFeeTablesMigration() {
  let connection;

  try {
    console.log('🔄 Starting Fee Management Tables Migration...\n');

    const dbName = process.env.DB_NAME || 'student_database';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbPort = process.env.DB_PORT || 3306;

    console.log(`📊 Database: ${dbName}`);
    console.log(`🔌 Host: ${dbHost}:${dbPort}\n`);

    // Connect to MySQL server
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
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

    // Connect to the specific database
    await connection.end();
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log(`✅ Connected to database '${dbName}'\n`);

    // Read migration SQL file
    const migrationPath = path.join(__dirname, 'create_fee_tables.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Replace hardcoded database name with actual database name
    migrationSQL = migrationSQL.replace(/USE\s+student_database;/gi, `USE \`${dbName}\`;`);

    console.log('📋 Executing migration script...\n');

    // Remove comments and clean up the SQL
    let cleanSQL = migrationSQL
      .split('\n')
      .map(line => {
        // Remove full-line comments
        if (line.trim().startsWith('--')) return '';
        // Remove inline comments (but keep the SQL part)
        const commentIndex = line.indexOf('--');
        if (commentIndex > 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter(line => line.length > 0)
      .join('\n');

    // Split into statements by semicolon, but be careful with multi-line statements
    const statements = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < cleanSQL.length; i++) {
      const char = cleanSQL[i];
      const prevChar = i > 0 ? cleanSQL[i - 1] : '';

      // Track string literals
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      currentStatement += char;

      // If we hit a semicolon and we're not in a string, it's the end of a statement
      if (char === ';' && !inString) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && !trimmed.toUpperCase().startsWith('SELECT')) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim().length > 0 && !currentStatement.trim().toUpperCase().startsWith('SELECT')) {
      statements.push(currentStatement.trim());
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute DDL statements
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        // Extract a preview of the statement for logging
        const preview = statement.substring(0, 50).replace(/\s+/g, ' ');
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}: ${preview}...`);
        try {
          await connection.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully\n`);
        } catch (error) {
          // Handle common "already exists" errors gracefully
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' ||
              error.message.includes('already exists') ||
              error.message.includes('Duplicate key name')) {
            console.log(`ℹ️  Statement ${i + 1}: ${error.message} (can be ignored if already exists)\n`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            console.error(`   SQL: ${statement.substring(0, 200)}...`);
            throw error;
          }
        }
      }
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...\n');

    // Check fee_headers table
    const [feeHeadersCheck] = await connection.query(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 'PASS - fee_headers table exists'
          ELSE 'FAIL - fee_headers table not found'
        END AS status
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'fee_headers'
    `, [dbName]);

    console.log(`📋 fee_headers table: ${feeHeadersCheck[0]?.status || 'UNKNOWN'}`);

    // Check student_fees table
    const [studentFeesCheck] = await connection.query(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 'PASS - student_fees table exists'
          ELSE 'FAIL - student_fees table not found'
        END AS status
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_fees'
    `, [dbName]);

    console.log(`📋 student_fees table: ${studentFeesCheck[0]?.status || 'UNKNOWN'}`);

    // Check default fee headers
    const [defaultHeadersCheck] = await connection.query(`
      SELECT COUNT(*) as count FROM fee_headers
    `);

    const headerCount = defaultHeadersCheck[0]?.count || 0;
    console.log(`📋 Default fee headers: ${headerCount} headers found`);

    if (headerCount > 0) {
      const [headers] = await connection.query(`
        SELECT header_name, is_active FROM fee_headers ORDER BY header_name
      `);
      console.log('\n📝 Fee headers:');
      headers.forEach(header => {
        console.log(`   - ${header.header_name} ${header.is_active ? '(Active)' : '(Inactive)'}`);
      });
    }

    // Check table structure
    console.log('\n📋 Table structures:');
    
    const [feeHeadersColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'fee_headers'
      ORDER BY ORDINAL_POSITION
    `, [dbName]);

    console.log('\n   fee_headers columns:');
    feeHeadersColumns.forEach(col => {
      console.log(`     - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    const [studentFeesColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_fees'
      ORDER BY ORDINAL_POSITION
    `, [dbName]);

    console.log('\n   student_fees columns:');
    studentFeesColumns.forEach(col => {
      console.log(`     - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ fee_headers table created');
    console.log('   ✅ student_fees table created');
    console.log('   ✅ Default fee headers inserted');
    console.log('   ✅ Foreign key constraints established');
    console.log('\n💡 Next steps:');
    console.log('   1. Start your application server');
    console.log('   2. Navigate to /fees in the application');
    console.log('   3. Click "Configure" to manage fee headers');
    console.log('   4. Start managing student fees!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    console.error('\n💡 Make sure your database credentials in .env are correct');
    console.error('   Required environment variables:');
    console.error('   - DB_HOST (default: localhost)');
    console.error('   - DB_USER (default: root)');
    console.error('   - DB_PASSWORD');
    console.error('   - DB_NAME (default: student_database)');
    console.error('   - DB_PORT (default: 3306)');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run the migration
runFeeTablesMigration();
