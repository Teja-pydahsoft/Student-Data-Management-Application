/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SQL_PATH = path.join(__dirname, 'scripts', 'migration_course_configuration.sql');

(async () => {
  const {
    DB_HOST='student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com',
    DB_PORT = 3306,
    DB_USER='admin',
    DB_PASSWORD='Student!0000',
    DB_NAME = 'student_database'
  } = process.env;

  if (!DB_HOST || !DB_USER) {
    throw new Error('Missing DB_HOST or DB_USER in environment. Please update your .env file.');
  }

  let connection;
  try {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');

    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true
    });

    console.log('⚙️  Running course/branch migration on master database...');
    await connection.query(sql);
    console.log('✅ Migration applied successfully.');
    console.log(`   Master DB host: ${DB_HOST}`);
    console.log(`   Master schema: ${DB_NAME}`);
    console.log('ℹ️  All migrations are now handled in MySQL.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
})();