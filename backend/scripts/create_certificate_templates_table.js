const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_database',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
};

async function createCertificateTemplatesTable() {
    console.log('🔄 Connecting to database...');
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to database');

        const schema = `
      -- Certificate Templates Table
      CREATE TABLE IF NOT EXISTS certificate_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        service_id INT NOT NULL,
        college_id INT NULL,
        header_image_url VARCHAR(500),
        footer_image_url VARCHAR(500),
        
        -- Three Section Content (Justified Text)
        top_content TEXT,
        middle_content TEXT NOT NULL,
        bottom_content TEXT,
        
        -- Padding Controls
        padding_left INT DEFAULT 40,
        padding_right INT DEFAULT 40,
        padding_top INT DEFAULT 40,
        padding_bottom INT DEFAULT 40,
        
        -- Blank Variables for Admin Input
        blank_variables JSON DEFAULT NULL,
        
        -- Page Settings
        page_size VARCHAR(10) DEFAULT 'A4',
        page_orientation VARCHAR(20) DEFAULT 'portrait',
        
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL,
        UNIQUE KEY unique_service_college (service_id, college_id),
        INDEX idx_service (service_id),
        INDEX idx_college (college_id)
      );
    `;

        console.log('🔄 Creating certificate_templates table...');
        await connection.query(schema);
        console.log('✅ Certificate templates table created successfully');

    } catch (error) {
        console.error('❌ Error creating table:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Connection closed');
        }
    }
}

createCertificateTemplatesTable();
