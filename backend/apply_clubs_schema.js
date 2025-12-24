
const { masterPool } = require('./config/database');
require('dotenv').config();

async function applySchema() {
    console.log('Applying new schema changes...');
    const connection = await masterPool.getConnection();
    try {
        await connection.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        image_url VARCHAR(255),
        form_fields JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
      );
    `);
        console.log('Created clubs table');

        await connection.query(`
      CREATE TABLE IF NOT EXISTS club_memberships (
        id INT PRIMARY KEY AUTO_INCREMENT,
        club_id INT NOT NULL,
        student_id INT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        submission_data JSON,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY unique_membership (club_id, student_id)
      );
    `);
        console.log('Created club_memberships table');

        await connection.query(`
      CREATE TABLE IF NOT EXISTS club_activities (
        id INT PRIMARY KEY AUTO_INCREMENT,
        club_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url VARCHAR(255),
        posted_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (posted_by) REFERENCES admins(id) ON DELETE SET NULL
      );
    `);
        console.log('Created club_activities table');

    } catch (error) {
        console.error('Error applying schema:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

applySchema();
