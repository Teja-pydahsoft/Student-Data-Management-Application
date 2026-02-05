const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Run RBAC Role Config migration - creates rbac_role_config table
 */
async function run() {
  let connection;
  try {
    const dbName = process.env.DB_NAME || 'student_database';
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });
    const sql = fs.readFileSync(path.join(__dirname, 'add_rbac_role_config.sql'), 'utf8');
    await connection.query(sql);
    console.log('rbac_role_config migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
