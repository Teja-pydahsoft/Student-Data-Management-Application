const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database',
      multipleStatements: true
    });

    console.log('Connected to database');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'add_year_semester_to_student_fees.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Executing migration...');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed.length === 0 || trimmed.startsWith('--')) continue;
      
      try {
        const [results] = await connection.query(trimmed + ';');
        if (results && results.length > 0) {
          console.log('Result:', results);
        }
      } catch (error) {
        // Ignore "Duplicate column name" errors - columns might already exist
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('Column already exists, skipping:', error.sqlMessage);
        } else {
          throw error;
        }
      }
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

runMigration();
