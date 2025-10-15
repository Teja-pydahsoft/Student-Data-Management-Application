const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { createDefaultForm } = require('./createDefaultForm');
require('dotenv').config();

async function initializeDatabase() {
  let connection;
  
  try {
    // Connect without database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('📦 Connected to MySQL server');

    // Read and execute schema (now includes master and staging DDL)
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schema);
    console.log('✅ Master and staging schemas created successfully');

    // Create default admin user
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    
    await connection.query(
      `INSERT INTO student_database.admins (username, password, email) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE username=username`,
      [process.env.ADMIN_USERNAME || 'admin', hashedPassword, 'admin@example.com']
    );
    
    console.log('✅ Default admin user created');
    console.log(`   Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    
    // Create default student form
    console.log('\n📝 Creating default student form...');
    await createDefaultForm();
    
    console.log('\n🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run initialization
initializeDatabase();
