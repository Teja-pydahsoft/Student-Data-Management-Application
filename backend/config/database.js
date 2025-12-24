const mysql = require('mysql2');
require('dotenv').config();


// Master DB connection pool with enhanced configuration for performance
const masterPoolRaw = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20, // Increased for better concurrency
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Performance optimizations
  multipleStatements: false, // Security: prevent SQL injection via multiple statements
  // Valid MySQL2 options for connection pooling
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false,
    // For production, use proper SSL configuration
    // rejectUnauthorized: true,
    // ca: fs.readFileSync(path.join(__dirname, '../certs/ca.pem')),
    // cert: fs.readFileSync(path.join(__dirname, '../certs/client-cert.pem')),
  } : false,
  timezone: '+05:30' // Enforce IST for database connections
});

// Enforce IST on every connection establishment
masterPoolRaw.on('connection', (connection) => {
  connection.query('SET time_zone = "+05:30"');
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
  queueLimit: 0,
  timezone: '+05:30' // Enforce IST for database connections
});

// Enforce IST on every connection establishment
stagingPoolRaw.on('connection', (connection) => {
  connection.query('SET time_zone = "+05:30"');
});

// Promise-based pools
const masterPool = masterPoolRaw.promise();
const stagingPool = stagingPoolRaw.promise();

// Test connections with retry logic
const testConnection = async (retries = 3) => {
  let dbConnected = false;

  for (let i = 0; i < retries; i++) {
    try {
      const conn = await masterPool.getConnection();
      conn.release();
      dbConnected = true;
      break;
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  return dbConnected;
};

module.exports = {
  masterPool,
  stagingPool,
  // Backward compat: default pool points to master
  pool: masterPool,
  testConnection
};
