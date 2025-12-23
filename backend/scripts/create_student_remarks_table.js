const { masterPool } = require('../config/database');

const createTable = async () => {
    try {
        const query = `
      CREATE TABLE IF NOT EXISTS student_remarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admission_number VARCHAR(255) NOT NULL,
        remark TEXT NOT NULL,
        created_by VARCHAR(255) DEFAULT NULL,
        created_by_name VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admission_number (admission_number)
      )
    `;

        await masterPool.query(query);
        console.log('✅ student_remarks table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to create table:', error);
        process.exit(1);
    }
};

createTable();
