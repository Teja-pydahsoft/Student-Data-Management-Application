const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Migration: Add year and semester columns to attendance_records table
 * Purpose: Store academic year and semester when attendance was marked so old data
 *          can be fetched by year/semester (e.g. after student promotion).
 */
async function runYearSemesterMigration() {
  let connection;

  try {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'student_database';
    const dbPort = process.env.DB_PORT || 3306;

    console.log('Migration: add year & semester to attendance_records');
    console.log('Database:', dbName);

    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Add year column if missing
    const [yearCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'year'
    `, [dbName]);
    if (yearCheck[0].count === 0) {
      await connection.execute(`
        ALTER TABLE attendance_records
        ADD COLUMN year TINYINT UNSIGNED NULL COMMENT 'Academic year of study when attendance was marked' AFTER attendance_date
      `);
      console.log('Added column: year');
    } else {
      console.log('Column year already exists');
    }

    // Add semester column if missing
    const [semCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'semester'
    `, [dbName]);
    if (semCheck[0].count === 0) {
      await connection.execute(`
        ALTER TABLE attendance_records
        ADD COLUMN semester TINYINT UNSIGNED NULL COMMENT 'Semester when attendance was marked' AFTER year
      `);
      console.log('Added column: semester');
    } else {
      console.log('Column semester already exists');
    }

    // Add index if missing
    const [idxCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_records' AND INDEX_NAME = 'idx_year_semester'
    `, [dbName]);
    if (idxCheck[0].count === 0) {
      await connection.execute('CREATE INDEX idx_year_semester ON attendance_records(year, semester)');
      console.log('Added index: idx_year_semester');
    } else {
      console.log('Index idx_year_semester already exists');
    }

    console.log('\nMigration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  runYearSemesterMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runYearSemesterMigration };
