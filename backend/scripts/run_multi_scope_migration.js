/**
 * Migration Script: Add Multi-Scope Columns to rbac_users table
 * 
 * This script adds support for assigning users to multiple colleges, courses, and branches.
 * 
 * Run with: node backend/scripts/run_multi_scope_migration.js
 */

const path = require('path');

// Load environment variables from the backend .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2');

// Create database connection using env variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
}).promise();

const runMigration = async () => {
  console.log('🚀 Starting Multi-Scope Migration...\n');
  console.log(`📡 Connecting to database: ${process.env.DB_NAME || 'student_database'}@${process.env.DB_HOST || 'localhost'}`);

  try {
    // Test connection first
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful!\n');

    // Step 1: Check if columns already exist
    console.log('📋 Checking existing table structure...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rbac_users'
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('   Existing columns:', existingColumns.join(', '));

    // Step 2: Add college_ids column if not exists
    if (!existingColumns.includes('college_ids')) {
      console.log('\n➕ Adding college_ids column...');
      await pool.query(`
        ALTER TABLE rbac_users 
        ADD COLUMN college_ids JSON DEFAULT NULL AFTER branch_id
      `);
      console.log('   ✅ college_ids column added');
    } else {
      console.log('\n⏭️  college_ids column already exists, skipping...');
    }

    // Step 3: Add course_ids column if not exists
    if (!existingColumns.includes('course_ids')) {
      console.log('\n➕ Adding course_ids column...');
      await pool.query(`
        ALTER TABLE rbac_users 
        ADD COLUMN course_ids JSON DEFAULT NULL AFTER college_ids
      `);
      console.log('   ✅ course_ids column added');
    } else {
      console.log('\n⏭️  course_ids column already exists, skipping...');
    }

    // Step 4: Add branch_ids column if not exists
    if (!existingColumns.includes('branch_ids')) {
      console.log('\n➕ Adding branch_ids column...');
      await pool.query(`
        ALTER TABLE rbac_users 
        ADD COLUMN branch_ids JSON DEFAULT NULL AFTER course_ids
      `);
      console.log('   ✅ branch_ids column added');
    } else {
      console.log('\n⏭️  branch_ids column already exists, skipping...');
    }

    // Step 5: Add all_courses column if not exists
    if (!existingColumns.includes('all_courses')) {
      console.log('\n➕ Adding all_courses column...');
      await pool.query(`
        ALTER TABLE rbac_users 
        ADD COLUMN all_courses TINYINT(1) DEFAULT 0 AFTER branch_ids
      `);
      console.log('   ✅ all_courses column added');
    } else {
      console.log('\n⏭️  all_courses column already exists, skipping...');
    }

    // Step 6: Add all_branches column if not exists
    if (!existingColumns.includes('all_branches')) {
      console.log('\n➕ Adding all_branches column...');
      await pool.query(`
        ALTER TABLE rbac_users 
        ADD COLUMN all_branches TINYINT(1) DEFAULT 0 AFTER all_courses
      `);
      console.log('   ✅ all_branches column added');
    } else {
      console.log('\n⏭️  all_branches column already exists, skipping...');
    }

    // Step 7: Migrate existing data
    console.log('\n📦 Migrating existing data to new columns...');
    
    // Migrate college_id to college_ids
    const [collegeResult] = await pool.query(`
      UPDATE rbac_users 
      SET college_ids = JSON_ARRAY(college_id) 
      WHERE college_id IS NOT NULL 
      AND (college_ids IS NULL OR college_ids = '[]' OR college_ids = 'null')
    `);
    console.log(`   ✅ Migrated ${collegeResult.affectedRows} users' college data`);

    // Migrate course_id to course_ids
    const [courseResult] = await pool.query(`
      UPDATE rbac_users 
      SET course_ids = JSON_ARRAY(course_id) 
      WHERE course_id IS NOT NULL 
      AND (course_ids IS NULL OR course_ids = '[]' OR course_ids = 'null')
    `);
    console.log(`   ✅ Migrated ${courseResult.affectedRows} users' course data`);

    // Migrate branch_id to branch_ids
    const [branchResult] = await pool.query(`
      UPDATE rbac_users 
      SET branch_ids = JSON_ARRAY(branch_id) 
      WHERE branch_id IS NOT NULL 
      AND (branch_ids IS NULL OR branch_ids = '[]' OR branch_ids = 'null')
    `);
    console.log(`   ✅ Migrated ${branchResult.affectedRows} users' branch data`);

    // Step 8: Verify migration
    console.log('\n🔍 Verifying migration...');
    const [verifyColumns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rbac_users'
      AND COLUMN_NAME IN ('college_ids', 'course_ids', 'branch_ids', 'all_courses', 'all_branches')
    `);
    
    console.log('\n   New columns added:');
    verifyColumns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Step 9: Show summary
    const [userCount] = await pool.query('SELECT COUNT(*) as total FROM rbac_users');
    const [migratedCount] = await pool.query(`
      SELECT COUNT(*) as total FROM rbac_users 
      WHERE college_ids IS NOT NULL AND college_ids != '[]' AND college_ids != 'null'
    `);

    console.log('\n📊 Migration Summary:');
    console.log(`   Total users: ${userCount[0].total}`);
    console.log(`   Users with multi-scope data: ${migratedCount[0].total}`);

    console.log('\n✅ Migration completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
    process.exit(0);
  }
};

// Run the migration
runMigration();
