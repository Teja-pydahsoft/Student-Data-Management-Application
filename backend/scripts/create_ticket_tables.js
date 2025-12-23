/**
 * Script to create ticket management tables
 * Run with: node scripts/create_ticket_tables.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function createTicketTables() {
  let connection;
  
  try {
    const dbName = process.env.DB_NAME || 'student_database';
    
    // First, connect without database to check if it exists
    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    // Check if database exists, create if it doesn't
    const [databases] = await tempConnection.query('SHOW DATABASES LIKE ?', [dbName]);
    if (databases.length === 0) {
      console.log(`📦 Database '${dbName}' does not exist. Creating...`);
      await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      console.log(`✅ Database '${dbName}' created`);
    }
    await tempConnection.end();

    // Now connect to the database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log(`✅ Connected to database '${dbName}'`);

    // Read SQL file
    const sqlPath = path.join(__dirname, 'create_ticket_management_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL script...');

    // Execute SQL
    await connection.query(sql);

    console.log('✅ Ticket management tables created successfully!');
    console.log('\nCreated tables:');
    console.log('  - complaint_categories');
    console.log('  - tickets');
    console.log('  - ticket_assignments');
    console.log('  - ticket_status_history');
    console.log('  - ticket_feedback');
    console.log('  - ticket_comments');

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the script
createTicketTables();

