const { masterPool } = require('../config/database');

const createEventsTable = async () => {
    try {
        await masterPool.query(`
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                event_date DATE NOT NULL,
                start_time TIME,
                end_time TIME,
                event_type ENUM('academic', 'holiday', 'exam', 'other') DEFAULT 'other',
                created_by INT,
                target_college TEXT,
                target_batch TEXT,
                target_course TEXT,
                target_branch TEXT,
                target_year TEXT,
                target_semester TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
            )
        `);
        console.log('Events table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating events table:', error);
        process.exit(1);
    }
};

createEventsTable();
