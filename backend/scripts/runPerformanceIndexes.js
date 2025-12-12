/**
 * Run Performance Indexes Migration
 * This script runs the SQL migration to add performance indexes to the database
 * Uses environment variables from .env file
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection = null;

  try {
    console.log('🚀 Starting performance indexes migration...\n');

    // Read SQL file
    const sqlFilePath = path.join(__dirname, 'add_performance_indexes.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database',
      port: process.env.DB_PORT || 3306,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false,
      multipleStatements: true // Allow multiple SQL statements
    });

    console.log('✅ Connected to database');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'student_database'}\n`);

    // Parse SQL statements - handle multi-line statements properly
    const statements = [];
    let currentStatement = '';
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and full-line comments
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }
      
      // Skip USE statements (we're already connected to the database)
      if (trimmed.toUpperCase().startsWith('USE ')) {
        continue;
      }
      
      // Add line to current statement
      currentStatement += (currentStatement ? ' ' : '') + trimmed;
      
      // If line ends with semicolon, we have a complete statement
      if (trimmed.endsWith(';')) {
        const statement = currentStatement.slice(0, -1).trim(); // Remove trailing semicolon
        if (statement.length > 0) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement (in case file doesn't end with semicolon)
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (const statement of statements) {
      if (!statement || statement.trim().length === 0) continue;

      try {
        // Execute statement
        await connection.query(statement);
        
        // Extract table and index names for better logging
        const upperStatement = statement.toUpperCase();
        
        if (upperStatement.includes('ALTER TABLE')) {
          const tableMatch = statement.match(/ALTER\s+TABLE\s+(\w+)/i);
          const indexMatches = statement.matchAll(/ADD\s+INDEX\s+(\w+)/gi);
          const indexes = Array.from(indexMatches).map(m => m[1]);
          
          if (tableMatch && indexes.length > 0) {
            const tableName = tableMatch[1];
            indexes.forEach(indexName => {
              console.log(`✅ Added index ${indexName} to table ${tableName}`);
            });
          } else if (tableMatch) {
            console.log(`✅ Executed ALTER TABLE on ${tableMatch[1]}`);
          }
          successCount++;
        } else if (upperStatement.includes('CREATE TABLE')) {
          const tableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
          if (tableMatch) {
            console.log(`✅ Created table ${tableMatch[1]}`);
          } else {
            console.log(`✅ Executed CREATE TABLE statement`);
          }
          successCount++;
        } else {
          console.log(`✅ Executed statement`);
          successCount++;
        }
      } catch (error) {
        // Check if error is because index already exists
        if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
          const indexMatch = statement.match(/ADD\s+INDEX\s+(\w+)/i);
          const tableMatch = statement.match(/ALTER\s+TABLE\s+(\w+)/i);
          if (indexMatch && tableMatch) {
            console.log(`⚠️  Index ${indexMatch[1]} already exists on ${tableMatch[1]}, skipping...`);
          } else {
            console.log(`⚠️  Index already exists, skipping...`);
          }
          skippedCount++;
        } else if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
          const tableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
          if (tableMatch) {
            console.log(`⚠️  Table ${tableMatch[1]} already exists, skipping...`);
          } else {
            console.log(`⚠️  Table already exists, skipping...`);
          }
          skippedCount++;
        } else {
          console.error(`❌ Error executing statement:`, error.message);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⚠️  Skipped (already exists): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   Your database is now optimized for better performance.');
    } else {
      console.log('\n⚠️  Migration completed with some errors.');
      console.log('   Please review the errors above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

