const { masterPool } = require('../config/database');
const fs = require('fs');

async function initFilterFieldsTable() {
  try {
    console.log('Creating filter_fields table...');

    // Create the filter_fields table
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS filter_fields (
        id INT PRIMARY KEY AUTO_INCREMENT,
        field_name VARCHAR(255) UNIQUE NOT NULL,
        field_type VARCHAR(50) DEFAULT 'text',
        enabled BOOLEAN DEFAULT TRUE,
        required BOOLEAN DEFAULT FALSE,
        options JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_field_name (field_name),
        INDEX idx_enabled (enabled)
      )
    `);

    console.log('✅ filter_fields table created successfully');

    // Insert default filter field configurations
    const defaultFields = [
      'batch', 'branch', 'stud_type', 'caste', 'gender',
      'district', 'mandal_name', 'city_village', 'student_status',
      'scholar_status', 'admission_date', 'dob'
    ];

    for (const fieldName of defaultFields) {
      await masterPool.query(`
        INSERT IGNORE INTO filter_fields (field_name, field_type, enabled, required, options)
        VALUES (?, 'text', true, false, JSON_ARRAY())
      `, [fieldName]);
    }

    console.log('✅ Default filter field configurations inserted');

    // Verify the table was created
    const [rows] = await masterPool.query('SELECT COUNT(*) as count FROM filter_fields');
    console.log(`✅ Filter fields table initialized with ${rows[0].count} records`);

  } catch (error) {
    console.error('❌ Error initializing filter_fields table:', error);
  } finally {
    process.exit(0);
  }
}

initFilterFieldsTable();