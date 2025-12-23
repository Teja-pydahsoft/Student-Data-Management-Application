const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Check if column exists
        const [columns] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'services' AND COLUMN_NAME = 'template_config'`,
            [process.env.DB_NAME]
        );

        if (columns.length > 0) {
            console.log("Column 'template_config' already exists. Skipping.");
        } else {
            console.log("Adding 'template_config' column...");
            await connection.execute(`
                ALTER TABLE services 
                ADD COLUMN template_config JSON DEFAULT NULL AFTER template_type
            `);
            console.log("Column 'template_config' added successfully.");
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
