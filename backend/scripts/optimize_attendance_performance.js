/**
 * Performance Optimization Script for Attendance Page
 * 
 * This script adds critical database indexes to optimize attendance queries
 * Target: Reduce query time from 30-60 seconds to 2-3 seconds for up to 10,000 students
 * 
 * Run: node backend/scripts/optimize_attendance_performance.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load .env file from backend directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function optimizeAttendancePerformance() {
  let connection;
  try {
    console.log('🚀 Starting attendance performance optimization...\n');
    
    // Get database connection details from environment variables
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'student_database';
    const dbPort = process.env.DB_PORT || 3306;

    console.log('🔍 Database Connection Details:');
    console.log('📊 Database:', dbName);
    console.log('🔌 Host:', dbHost);
    console.log('🔌 Port:', dbPort);
    console.log('👤 User:', dbUser);
    console.log('🔑 Password:', dbPassword ? '***' : '(not set - using empty string)');
    console.log('');

    // Check if .env file was loaded
    if (!process.env.DB_PASSWORD && !process.env.DB_USER) {
      const envPath = path.join(__dirname, '..', '.env');
      console.log('⚠️  Warning: Environment variables not found.');
      console.log(`   Expected .env file at: ${envPath}`);
      console.log('   Make sure your .env file exists in the backend directory.\n');
    }

    // Create database connection
    console.log('🔄 Attempting to connect to database...');
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

    console.log('✅ Connected to database successfully\n');

    // 1. Composite index for students table - most common filter combination
    console.log('1️⃣  Creating composite index for students (student_status, course, batch, current_year, current_semester)...');
    try {
      await connection.execute(`
        CREATE INDEX idx_students_status_course_batch_year_sem 
        ON students(student_status, course, batch, current_year, current_semester)
      `);
      console.log('   ✅ Index created\n');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Index already exists\n');
      } else {
        throw error;
      }
    }

    // 2. Index on student_name for ORDER BY optimization
    console.log('2️⃣  Creating index on student_name for ORDER BY...');
    try {
      await connection.execute(`
        CREATE INDEX idx_students_name 
        ON students(student_name)
      `);
      console.log('   ✅ Index created\n');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Index already exists\n');
      } else {
        throw error;
      }
    }

    // 3. Composite index for attendance_records JOIN optimization
    console.log('3️⃣  Creating composite index for attendance_records (student_id, attendance_date)...');
    try {
      await connection.execute(`
        CREATE INDEX idx_attendance_student_date 
        ON attendance_records(student_id, attendance_date)
      `);
      console.log('   ✅ Index created\n');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Index already exists\n');
      } else {
        throw error;
      }
    }

    // 4. Additional composite index for attendance_records with status
    console.log('4️⃣  Creating composite index for attendance_records (attendance_date, status)...');
    try {
      await connection.execute(`
        CREATE INDEX idx_attendance_date_status 
        ON attendance_records(attendance_date, status)
      `);
      console.log('   ✅ Index created\n');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Index already exists\n');
      } else {
        throw error;
      }
    }

    // 5. Index on parent_mobile columns for search optimization
    console.log('5️⃣  Creating indexes on parent_mobile columns...');
    try {
      await connection.execute(`
        CREATE INDEX idx_students_parent_mobile1 
        ON students(parent_mobile1)
      `);
      console.log('   ✅ Index on parent_mobile1 created');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Index on parent_mobile1 already exists');
      } else {
        throw error;
      }
    }

    try {
      await connection.execute(`
        CREATE INDEX idx_students_parent_mobile2 
        ON students(parent_mobile2)
      `);
      console.log('   ✅ Index on parent_mobile2 created\n');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Index on parent_mobile2 already exists\n');
      } else {
        throw error;
      }
    }

    // 6. Composite index for registration_status and fee_status (if they exist as columns)
    console.log('6️⃣  Checking and creating indexes on registration_status and fee_status...');
    try {
      const [cols] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'students' 
          AND COLUMN_NAME IN ('registration_status', 'fee_status')
      `, [dbName]);
      
      const colNames = cols.map(c => c.COLUMN_NAME);
      
      if (colNames.includes('registration_status')) {
        try {
          await connection.execute(`
            CREATE INDEX idx_students_registration_status 
            ON students(registration_status)
          `);
          console.log('   ✅ Index on registration_status created');
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            console.log('   ℹ️  Index on registration_status already exists');
          } else {
            throw error;
          }
        }
      }
      
      if (colNames.includes('fee_status')) {
        try {
          await connection.execute(`
            CREATE INDEX idx_students_fee_status 
            ON students(fee_status)
          `);
          console.log('   ✅ Index on fee_status created');
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            console.log('   ℹ️  Index on fee_status already exists');
          } else {
            throw error;
          }
        }
      }
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Error checking status columns: ${error.message}\n`);
    }

    // Verify all indexes were created
    console.log('🔍 Verifying indexes...\n');
    const [indexes] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('students', 'attendance_records')
        AND INDEX_NAME LIKE 'idx_%'
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME, INDEX_NAME
    `, [dbName]);

    console.log('📋 Created/Verified Indexes:');
    indexes.forEach(idx => {
      console.log(`   ✅ ${idx.TABLE_NAME}.${idx.INDEX_NAME} (${idx.COLUMNS})`);
    });

    console.log('\n✅ Performance optimization completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Monitor query performance');
    console.log('   2. Run ANALYZE TABLE students, attendance_records to update statistics');
    console.log('   3. Test attendance page load times\n');

  } catch (error) {
    console.error('\n❌ Error during optimization:', error.message);
    console.error('💡 Full error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  optimizeAttendancePerformance()
    .then(() => {
      console.log('✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = optimizeAttendancePerformance;

