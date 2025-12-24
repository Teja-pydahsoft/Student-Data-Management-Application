
const { masterPool } = require('./config/database');
require('dotenv').config();

async function updateSchema() {
    console.log('Switching to Single Table Architecture for Clubs...');
    const connection = await masterPool.getConnection();
    try {
        // Drop old tables if they exist
        await connection.query('DROP TABLE IF EXISTS club_activities');
        await connection.query('DROP TABLE IF EXISTS club_memberships');
        await connection.query('DROP TABLE IF EXISTS clubs');
        console.log('Dropped old tables.');

        // Create new single table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        image_url VARCHAR(255),
        form_fields JSON,
        members JSON,
        activities JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
      );
    `);
        console.log('Created new "clubs" table with JSON columns.');

    } catch (error) {
        console.error('Error updating schema:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

updateSchema();
