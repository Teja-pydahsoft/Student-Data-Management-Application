/**
 * Fix: Change student_data column from TEXT to LONGTEXT
 * TEXT can only hold 64KB, which is too small for JSON data that might include photos
 * LONGTEXT can hold up to 4GB
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function runMigration() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_database',
    port: process.env.DB_PORT || 3306
  };

  console.log('🔧 Running migration to fix student_data column size...');
  console.log(`📊 Database: ${config.database}@${config.host}`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');

    // Check current column type
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'student_data'
    `, [config.database]);

    if (columns.length > 0) {
      console.log(`📋 Current student_data column type: ${columns[0].DATA_TYPE} (max length: ${columns[0].CHARACTER_MAXIMUM_LENGTH})`);
    }

    // Alter the student_data column to LONGTEXT
    console.log('⏳ Altering students.student_data to LONGTEXT...');
    await connection.query('ALTER TABLE students MODIFY COLUMN student_data LONGTEXT');
    console.log('✅ students.student_data changed to LONGTEXT');

    // Also fix form_submissions.submission_data
    console.log('⏳ Altering form_submissions.submission_data to LONGTEXT...');
    await connection.query('ALTER TABLE form_submissions MODIFY COLUMN submission_data LONGTEXT');
    console.log('✅ form_submissions.submission_data changed to LONGTEXT');

    // Verify the changes
    const [verifyStudents] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'student_data'
    `, [config.database]);

    if (verifyStudents.length > 0) {
      console.log(`✅ Verified students.student_data: ${verifyStudents[0].DATA_TYPE}`);
    }

    const [verifySubmissions] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'form_submissions' AND COLUMN_NAME = 'submission_data'
    `, [config.database]);

    if (verifySubmissions.length > 0) {
      console.log(`✅ Verified form_submissions.submission_data: ${verifySubmissions[0].DATA_TYPE}`);
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

