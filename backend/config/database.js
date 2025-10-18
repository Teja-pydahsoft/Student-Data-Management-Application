const mysql = require('mysql2');
require('dotenv').config();
const { supabase } = require('./supabase');

console.log('🔧 Database Configuration:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_SSL:', process.env.DB_SSL);

// Master DB connection pool with enhanced configuration
const masterPoolRaw = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  // Valid MySQL2 options for connection pooling
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false,
    // For production, use proper SSL configuration
    // rejectUnauthorized: true,
    // ca: fs.readFileSync(path.join(__dirname, '../certs/ca.pem')),
    // cert: fs.readFileSync(path.join(__dirname, '../certs/client-cert.pem')),
    // key: fs.readFileSync(path.join(__dirname, '../certs/client-key.pem'))
  } : false
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

// Test connections with retry logic and Supabase testing
const testConnection = async (retries = 3) => {
  console.log('🔌 Testing Master DB connection...');
  console.log('📋 Master DB Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL
  });

  let dbConnected = false;

  for (let i = 0; i < retries; i++) {
    try {
      const conn = await masterPool.getConnection();
      console.log('✅ Master DB connected successfully');
      conn.release();
      dbConnected = true;
      break;
    } catch (error) {
      console.error(`❌ Master DB connection failed (attempt ${i + 1}/${retries}):`, error.message);
      console.error('❌ Error code:', error.code);

      // Provide specific troubleshooting guidance based on error type
      if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('💡 Troubleshooting: Check DB_USER, DB_PASSWORD, and user permissions in AWS RDS');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('💡 Troubleshooting: Verify DB_HOST and security group settings in AWS RDS');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('💡 Troubleshooting: Check network connectivity and VPC configuration');
      }

      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${i + 1} seconds...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  console.log('🔌 Testing Supabase connection...');
  try {
    if (supabase) {
      const { error } = await supabase.from('admins').select('id').limit(1);
      if (error) throw error;
      console.log('✅ Supabase connected successfully');
    } else {
      console.log('⚠️  Supabase not configured');
    }
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    console.error('❌ Error details:', error);
    // Don't return false for Supabase errors, as the app can still work with just MySQL
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
