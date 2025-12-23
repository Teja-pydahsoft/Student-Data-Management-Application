const { masterPool } = require('../config/database');

const createTable = async () => {
    try {
        const query = `
      CREATE TABLE IF NOT EXISTS sms_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        template_id VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        variable_mappings JSON,
        created_by INT,
        created_by_name VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_template_id (template_id)
      )
    `;

        await masterPool.query(query);
        console.log('✅ sms_templates table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to create table:', error);
        process.exit(1);
    }
};

createTable();
