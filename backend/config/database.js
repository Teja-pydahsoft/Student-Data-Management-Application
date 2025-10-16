const mysql = require('mysql2');
require('dotenv').config();
const { supabase } = require('./supabase');

console.log('🔧 Database Configuration:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_SSL:', process.env.DB_SSL);

// Master DB connection pool
const masterPoolRaw = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
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

// Test connections
const testConnection = async () => {
  console.log('🔌 Testing Master DB connection...');
  console.log('📋 Master DB Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL
  });

  try {
    const conn = await masterPool.getConnection();
    console.log('✅ Master DB connected successfully');
    conn.release();
  } catch (error) {
    console.error('❌ Master DB connection failed:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error details:', error);
    return false;
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

  return true;
};

module.exports = {
  masterPool,
  stagingPool,
  // Backward compat: default pool points to master
  pool: masterPool,
  testConnection
};
