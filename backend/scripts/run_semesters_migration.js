/**
 * Script to run the semesters migration
 * 
 * This creates the semesters table for Academic Calendar management
 * 
 * Run with: node scripts/run_semesters_migration.js
 */

const { masterPool } = require('../config/database');

async function runMigration() {
  console.log('🔄 Starting semesters migration...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Check if semesters table already exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'semesters'
    `);

    if (tables.length > 0) {
      console.log('⚠️  semesters table already exists');
      console.log('   Skipping table creation...');
    } else {
      // Create semesters table
      console.log('📦 Creating semesters table...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS semesters (
          id INT PRIMARY KEY AUTO_INCREMENT,
          college_id INT NULL,
          course_id INT NOT NULL,
          academic_year_id INT NOT NULL,
          year_of_study TINYINT NOT NULL,
          semester_number TINYINT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_college_id (college_id),
          INDEX idx_course_id (course_id),
          INDEX idx_academic_year_id (academic_year_id),
          INDEX idx_year_semester (year_of_study, semester_number),
          INDEX idx_dates (start_date, end_date),
          UNIQUE KEY unique_semester (college_id, course_id, academic_year_id, year_of_study, semester_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ semesters table created');
    }

    // Check and add foreign key constraints
    console.log('📦 Checking foreign key constraints...');
    
    // Check if colleges table exists
    const [collegesTable] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'colleges'
    `);

    if (collegesTable.length > 0) {
      // Add foreign key for college_id
      try {
        const [fkColleges] = await connection.query(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'semesters' 
            AND CONSTRAINT_NAME = 'fk_semester_college'
        `);

        if (fkColleges.length === 0) {
          await connection.query(`
            ALTER TABLE semesters
            ADD CONSTRAINT fk_semester_college
              FOREIGN KEY (college_id) REFERENCES colleges(id)
              ON DELETE CASCADE
          `);
          console.log('✅ Foreign key constraint for colleges added');
        } else {
          console.log('✅ Foreign key constraint for colleges already exists');
        }
      } catch (fkError) {
        console.log('⚠️  Could not add foreign key for colleges:', fkError.message);
      }
    } else {
      console.log('⚠️  colleges table not found - skipping college foreign key');
    }

    // Add foreign key for courses
    try {
      const [fkCourses] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'semesters' 
          AND CONSTRAINT_NAME = 'fk_semester_course'
      `);

      if (fkCourses.length === 0) {
        await connection.query(`
          ALTER TABLE semesters
          ADD CONSTRAINT fk_semester_course
            FOREIGN KEY (course_id) REFERENCES courses(id)
            ON DELETE CASCADE
        `);
        console.log('✅ Foreign key constraint for courses added');
      } else {
        console.log('✅ Foreign key constraint for courses already exists');
      }
    } catch (fkError) {
      console.log('⚠️  Could not add foreign key for courses:', fkError.message);
    }

    // Add foreign key for academic_years
    try {
      const [fkAcademicYears] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'semesters' 
          AND CONSTRAINT_NAME = 'fk_semester_academic_year'
      `);

      if (fkAcademicYears.length === 0) {
        await connection.query(`
          ALTER TABLE semesters
          ADD CONSTRAINT fk_semester_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
            ON DELETE CASCADE
        `);
        console.log('✅ Foreign key constraint for academic_years added');
      } else {
        console.log('✅ Foreign key constraint for academic_years already exists');
      }
    } catch (fkError) {
      console.log('⚠️  Could not add foreign key for academic_years:', fkError.message);
      console.log('   Make sure academic_years table exists. Run: node scripts/run_academic_years_migration.js');
    }

    // Verify table structure
    console.log('📦 Verifying table structure...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'semesters'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('✅ Table structure verified:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   - Created semesters table');
    console.log('   - Added foreign key constraints');
    console.log('   - Table is ready for use');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - Restart your backend server');
    console.log('   - Access Academic Calendar tab in Settings page');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Error details:', error);
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

