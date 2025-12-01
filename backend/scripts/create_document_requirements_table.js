/**
 * Migration Script: Create document_requirements table in MySQL
 * 
 * This script creates the document_requirements table in MySQL (master database)
 * for managing document requirements configuration for student registration forms.
 * 
 * Run: npm run migrate-document-requirements
 */

const { masterPool } = require('../config/database');

async function createDocumentRequirementsTable() {
  let conn = null;
  try {
    console.log('🔧 Creating document_requirements table in MySQL...');
    console.log('');

    conn = await masterPool.getConnection();

    // Create the table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_requirements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_type VARCHAR(10) NOT NULL CHECK (course_type IN ('UG', 'PG')),
        academic_stage VARCHAR(50) NOT NULL CHECK (academic_stage IN ('10th', 'Inter', 'Diploma', 'UG')),
        required_documents JSON NOT NULL DEFAULT ('[]'),
        is_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_course_stage (course_type, academic_stage)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ document_requirements table created successfully!');

    // Create indexes
    try {
      await conn.query(`
        CREATE INDEX idx_document_requirements_course_type 
        ON document_requirements(course_type);
      `);
      console.log('✅ Index on course_type created');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
      console.log('ℹ️  Index on course_type already exists');
    }

    try {
      await conn.query(`
        CREATE INDEX idx_document_requirements_academic_stage 
        ON document_requirements(academic_stage);
      `);
      console.log('✅ Index on academic_stage created');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
      console.log('ℹ️  Index on academic_stage already exists');
    }

    try {
      await conn.query(`
        CREATE INDEX idx_document_requirements_enabled 
        ON document_requirements(is_enabled);
      `);
      console.log('✅ Index on is_enabled created');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
      console.log('ℹ️  Index on is_enabled already exists');
    }

    // Verify table exists
    const [tables] = await conn.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'document_requirements'
    `);

    if (tables.length > 0) {
      console.log('');
      console.log('✅ Migration completed successfully!');
      console.log('   The document_requirements table is ready to use.');
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Configure document requirements in Settings → Document Requirements');
      console.log('   2. Students can now upload documents based on course type (UG/PG)');
    } else {
      throw new Error('Table creation verification failed');
    }

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error('');
    
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  Table already exists. Migration may have already been run.');
      console.log('   You can safely ignore this if the table is working correctly.');
    } else {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check your .env file has correct MySQL credentials');
      console.log('   2. Verify MySQL connection: npm run test-supabase (tests DB connection)');
      console.log('   3. Ensure you have CREATE TABLE permissions');
      console.log('');
      console.log('📋 Manual SQL (if needed):');
      console.log('   Run this SQL directly in your MySQL database:');
      console.log('');
      console.log(`
CREATE TABLE IF NOT EXISTS document_requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_type VARCHAR(10) NOT NULL,
  academic_stage VARCHAR(50) NOT NULL,
  required_documents JSON NOT NULL DEFAULT ('[]'),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_course_stage (course_type, academic_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

// Run the migration
if (require.main === module) {
  createDocumentRequirementsTable()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createDocumentRequirementsTable };
