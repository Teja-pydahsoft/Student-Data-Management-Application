const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runStudentCollegeMigration() {
  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database',
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database successfully');
    console.log('📊 Database:', process.env.DB_NAME || 'student_database');

    const dbName = process.env.DB_NAME || 'student_database';

    // Step 1: Check if college column exists
    console.log('\n🔍 Step 1: Checking if college column exists...');
    const [colCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'college'
    `, [dbName]);

    if (colCheck[0].count === 0) {
      console.log('➕ Adding college column...');
      await connection.execute('ALTER TABLE students ADD COLUMN college VARCHAR(255) NULL AFTER batch');
      console.log('✅ College column added');
    } else {
      console.log('ℹ️  College column already exists');
    }

    // Step 2: Check if index exists
    console.log('\n🔍 Step 2: Checking if index exists...');
    const [idxCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'students' 
        AND INDEX_NAME = 'idx_students_college'
    `, [dbName]);

    if (idxCheck[0].count === 0) {
      console.log('➕ Creating index...');
      await connection.execute('CREATE INDEX idx_students_college ON students(college)');
      console.log('✅ Index created');
    } else {
      console.log('ℹ️  Index already exists');
    }

    console.log('\n✅ Database migration completed!');
    console.log('📝 Next: Run migrateStudentCollege.js to populate college data');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  runStudentCollegeMigration();
}

module.exports = { runStudentCollegeMigration };

