const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');

const createAnnouncementTable = async () => {
    try {
        console.log('Creating announcements table...');

        await masterPool.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                image_url VARCHAR(512) DEFAULT NULL,
                target_college VARCHAR(100) DEFAULT NULL,
                target_course VARCHAR(100) DEFAULT NULL,
                target_branch VARCHAR(100) DEFAULT NULL,
                target_year INT DEFAULT NULL,
                target_semester INT DEFAULT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_targets (target_college, target_course, target_branch, target_year, target_semester),
                INDEX idx_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✅ Announcements table created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating announcements table:', error);
        process.exit(1);
    }
};

createAnnouncementTable();
