/**
 * Script to run the academic years migration
 * 
 * This creates the academic_years table and adds the academic_year_id column to course_branches
 * 
 * Run with: node scripts/run_academic_years_migration.js
 */

const { masterPool } = require('../config/database');

async function runMigration() {
  console.log('🔄 Starting academic years migration...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Create academic_years table
    console.log('📦 Creating academic_years table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INT PRIMARY KEY AUTO_INCREMENT,
        year_label VARCHAR(20) NOT NULL UNIQUE,
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_year_label (year_label),
        INDEX idx_is_active (is_active)
      )
    `);
    console.log('✅ academic_years table created');

    // Check if academic_year_id column exists in course_branches
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'course_branches' 
        AND COLUMN_NAME = 'academic_year_id'
    `);

    if (columns.length === 0) {
      console.log('📦 Adding academic_year_id column to course_branches...');
      await connection.query(`
        ALTER TABLE course_branches
        ADD COLUMN academic_year_id INT NULL
      `);
      console.log('✅ academic_year_id column added');

      // Add foreign key constraint
      try {
        await connection.query(`
          ALTER TABLE course_branches
          ADD CONSTRAINT fk_branch_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
            ON DELETE SET NULL
        `);
        console.log('✅ Foreign key constraint added');
      } catch (fkError) {
        // Constraint might already exist
        console.log('⚠️  Foreign key constraint already exists or could not be added');
      }

      // Add index
      try {
        await connection.query(`
          CREATE INDEX idx_branch_academic_year ON course_branches(academic_year_id)
        `);
        console.log('✅ Index created');
      } catch (idxError) {
        console.log('⚠️  Index already exists');
      }
    } else {
      console.log('✅ academic_year_id column already exists');
    }

    // Insert default academic years
    console.log('📦 Inserting default academic years...');
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    
    for (const year of years) {
      try {
        await connection.query(`
          INSERT IGNORE INTO academic_years (year_label, start_date, end_date, is_active) 
          VALUES (?, ?, ?, TRUE)
        `, [
          year.toString(),
          `${year}-06-01`,
          `${year + 1}-05-31`
        ]);
      } catch (insertError) {
        // Ignore duplicate entry errors
      }
    }
    console.log('✅ Default academic years inserted');

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   - Created academic_years table');
    console.log('   - Added academic_year_id column to course_branches');
    console.log('   - Inserted default academic years');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});

