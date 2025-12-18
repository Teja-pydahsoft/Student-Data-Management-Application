const { masterPool } = require('../config/database');

const createPollsTable = async () => {
    try {
        console.log('Dropping old tables if they exist...');
        await masterPool.query('DROP TABLE IF EXISTS poll_votes');
        await masterPool.query('DROP TABLE IF EXISTS polls');

        console.log('Creating single polls table...');
        // votes column will store a JSON object mapping student_id -> option_index
        // e.g., { "12345": 0, "67890": 1 }
        await masterPool.query(`
            CREATE TABLE polls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                question TEXT NOT NULL,
                options JSON NOT NULL,
                votes JSON DEFAULT (JSON_OBJECT()),
                is_active TINYINT(1) DEFAULT 1,
                created_by INT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                target_college TEXT,
                target_batch TEXT,
                target_course TEXT,
                target_branch TEXT,
                target_year TEXT,
                target_semester TEXT
            )
        `);
        console.log('Polls table created successfully.');

        process.exit(0);
    } catch (error) {
        console.error('Error creating polls table:', error);
        process.exit(1);
    }
};

createPollsTable();
