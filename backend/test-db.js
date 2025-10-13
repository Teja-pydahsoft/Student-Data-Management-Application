const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  let connection;
  try {
    console.log('🔍 Testing connection to:', process.env.DB_HOST);
    
    // Test basic connection (without database)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      connectTimeout: 5000 // 5 seconds timeout
    });

    console.log('✅ Successfully connected to MySQL server');
    
    // Check if database exists
    const [rows] = await connection.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [process.env.DB_NAME]
    );
    
    if (rows.length === 0) {
      console.warn(`⚠️  Database '${process.env.DB_NAME}' does not exist. Run 'npm run init-db' to create it.`);
    } else {
      console.log(`✅ Database '${process.env.DB_NAME}' exists`);
      // Switch to the database
      await connection.changeUser({ database: process.env.DB_NAME });
      console.log('✅ Successfully connected to database');
    }

  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
    
    // Common error scenarios
    if (error.code === 'ETIMEDOUT') {
      console.log('\n🔧 Possible solutions:');
      console.log('1. Check if the RDS instance is running and accessible');
      console.log('2. Verify the hostname is correct:', process.env.DB_HOST);
      console.log('3. Check if your IP is whitelisted in the RDS security group');
      console.log('4. Try disabling SSL by setting DB_SSL=false in .env');
    }
    else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔧 Possible solutions:');
      console.log('1. Verify DB_USER and DB_PASSWORD in .env are correct');
      console.log('2. Check if the user has proper permissions');
    }
    else if (error.code === 'ENOTFOUND') {
      console.log('\n🔧 Possible solutions:');
      console.log('1. Check your internet connection');
      console.log('2. Verify the hostname is correct:', process.env.DB_HOST);
    }
    else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log(`\n🔧 The database '${process.env.DB_NAME}' doesn't exist. Run 'npm run init-db' to create it.`);
    }
    else if (error.code === 'ER_HOST_NOT_PRIVILEGED') {
      console.log('\n🔧 Your IP is not allowed to connect to the database');
      console.log('1. Add your IP to the RDS security group');
      console.log('2. Check if you need to use a VPN or proxy');
    }
    else if (error.code === 'HANDSHAKE_SSL_ERROR') {
      console.log('\n🔧 SSL connection error:');
      console.log('1. Try setting DB_SSL=false in .env');
      console.log('2. If using SSL, ensure your CA certificate is configured');
    }

  } finally {
    if (connection) await connection.end();
  }
}

testConnection();