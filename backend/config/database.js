const mysql = require('mysql2');
require('dotenv').config();

// Master DB connection pool
const masterPoolRaw = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Staging DB connection pool (for pending/unapproved submissions)
const stagingPoolRaw = mysql.createPool({
  host: process.env.STAGING_DB_HOST || process.env.DB_HOST || 'localhost',
  user: process.env.STAGING_DB_USER || process.env.DB_USER || 'root',
  password: process.env.STAGING_DB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.STAGING_DB_NAME || 'student_staging',
  port: process.env.STAGING_DB_PORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Promise-based pools
const masterPool = masterPoolRaw.promise();
const stagingPool = stagingPoolRaw.promise();

// Test connections
const testConnection = async () => {
  try {
    const conn = await masterPool.getConnection();
    console.log('✅ Master DB connected successfully');
    conn.release();
  } catch (error) {
    console.error('❌ Master DB connection failed:', error.message);
    return false;
  }

  try {
    const conn2 = await stagingPool.getConnection();
    console.log('✅ Staging DB connected successfully');
    conn2.release();
  } catch (error) {
    console.error('❌ Staging DB connection failed:', error.message);
    return false;
  }

  return true;
};

module.exports = {
  masterPool,
  stagingPool,
  // Backward compat: default pool points to master
  pool: masterPool,
  testConnection
};
