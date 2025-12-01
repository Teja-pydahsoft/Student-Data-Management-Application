/**
 * Test MySQL Connection
 * Verifies that MySQL is properly configured and document_requirements table exists
 */

require('dotenv').config();
const { masterPool } = require('../config/database');

async function testConnection() {
  let conn = null;
  try {
    console.log('🔍 Testing MySQL connection...');
    console.log('');

    // Check environment variables
    if (!process.env.DB_HOST) {
      console.error('❌ DB_HOST is not set in .env');
      return false;
    }
    if (!process.env.DB_NAME) {
      console.error('❌ DB_NAME is not set in .env');
      return false;
    }

    console.log('✅ Environment variables found');
    console.log(`   DB_HOST: ${process.env.DB_HOST}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME}`);
    console.log('');

    // Test connection
    console.log('🔌 Testing database connection...');
    conn = await masterPool.getConnection();
    conn.release();
    console.log('✅ MySQL connection successful!');
    console.log('');

    // Check if document_requirements table exists
    console.log('🔍 Checking for document_requirements table...');
    conn = await masterPool.getConnection();
    
    const [tables] = await conn.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'document_requirements'
    `);

    conn.release();

    if (tables.length === 0) {
      console.log('❌ document_requirements table does NOT exist');
      console.log('');
      console.log('📝 To create it, run:');
      console.log('   npm run migrate-document-requirements');
      return false;
    }

    console.log('✅ document_requirements table EXISTS!');
    
    // Check table structure
    conn = await masterPool.getConnection();
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'document_requirements'
      ORDER BY ORDINAL_POSITION
    `);
    conn.release();

    console.log('');
    console.log('📊 Table structure:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Check if there are any records
    conn = await masterPool.getConnection();
    const [count] = await conn.query(
      'SELECT COUNT(*) as count FROM document_requirements'
    );
    conn.release();

    console.log('');
    console.log(`📈 Records in table: ${count[0].count}`);
    console.log('');
    console.log('✅ Everything is set up correctly!');
    return true;

  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check your .env file has correct MySQL credentials');
    console.error('   2. Verify MySQL server is running');
    console.error('   3. Check your network connection');
    console.error('   4. Ensure database exists: ' + (process.env.DB_NAME || 'student_database'));
    return false;
  } finally {
    if (conn) conn.release();
  }
}

if (require.main === module) {
  testConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testConnection };
