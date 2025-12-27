const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_database',
    multipleStatements: true
};

async function setupPreviousColleges() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS previous_colleges (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

        console.log('Creating previous_colleges table...');
        await connection.query(createTableQuery);
        console.log('Table created or already exists.');

        // Add reasonable initial data/index if needed
        // The user has a list but didn't provide it. I can't add it yet.

        console.log('Setup complete.');
    } catch (error) {
        console.error('Setup failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

setupPreviousColleges();
