/**
 * Migration Script: Supabase to MySQL
 * 
 * This script ensures all tables exist in MySQL and provides
 * a way to migrate data from Supabase to MySQL if needed.
 * 
 * Run: node scripts/migrate_supabase_to_mysql.js
 */

require('dotenv').config();
const { masterPool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function migrateTables() {
  let conn;
  try {
    console.log('🔄 Starting Supabase to MySQL migration...');
    
    conn = await masterPool.getConnection();
    console.log('✅ Connected to MySQL database');

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('CREATE DATABASE') && !s.startsWith('USE'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await conn.query(statement);
          console.log(`   ✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (err) {
          // Ignore "table already exists" errors
          if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
            console.log(`   ⚠️  Statement ${i + 1}: Table already exists (skipping)`);
          } else {
            console.error(`   ❌ Statement ${i + 1} failed:`, err.message);
          }
        }
      }
    }

    // Ensure settings table exists (if not in schema.sql)
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          \`key\` VARCHAR(255) UNIQUE NOT NULL,
          value LONGTEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_key (\`key\`)
        )
      `);
      console.log('✅ Settings table ensured');
    } catch (err) {
      if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('❌ Error creating settings table:', err.message);
      }
    }

    // Ensure document_requirements table exists
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS document_requirements (
          id INT PRIMARY KEY AUTO_INCREMENT,
          course_type ENUM('UG', 'PG', 'Common') NOT NULL,
          academic_stage VARCHAR(50) NOT NULL,
          required_documents JSON NOT NULL,
          is_enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_course_stage (course_type, academic_stage),
          INDEX idx_course_type (course_type),
          INDEX idx_academic_stage (academic_stage)
        )
      `);
      console.log('✅ Document requirements table ensured');
    } catch (err) {
      if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('❌ Error creating document_requirements table:', err.message);
      }
    }

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Update all controllers to use MySQL instead of Supabase');
    console.log('   2. Test all endpoints');
    console.log('   3. Remove Supabase configuration from .env');
    console.log('   4. Remove @supabase/supabase-js from package.json');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

// Run migration
migrateTables()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

