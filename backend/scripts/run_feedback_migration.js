const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const runMigration = async () => {
    try {
        // Read .env file manually
        const envPath = path.resolve(__dirname, '../../backend/.env');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            });
        }

        // Connect to database using env vars
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('Connected to database...');

        // Add recurrence_config column if it doesn't exist
        const conn = await pool.getConnection();

        // Check if column exists
        const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forms' AND COLUMN_NAME = 'recurrence_config'
    `);

        if (columns.length === 0) {
            console.log('Adding recurrence_config column to forms table...');
            await conn.query(`
        ALTER TABLE forms
        ADD COLUMN recurrence_config JSON DEFAULT NULL COMMENT 'Config for recurring feedback: {type: "days", value: 30, next_run: "2024-01-01"}'
      `);
            console.log('recurrence_config column added.');
        } else {
            console.log('recurrence_config column already exists.');
        }

        conn.release();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
