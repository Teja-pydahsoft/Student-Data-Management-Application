/**
 * Script to add year_semester_config column to courses and course_branches tables
 * 
 * Run with: node scripts/run_year_semester_config_migration.js
 */

const { masterPool } = require('../config/database');

async function runMigration() {
  console.log('🔄 Starting year_semester_config migration...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Check if year_semester_config column exists in courses
    const [coursesColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'year_semester_config'
    `);

    if (coursesColumns.length === 0) {
      console.log('📦 Adding year_semester_config column to courses table...');
      await connection.query(`
        ALTER TABLE courses 
        ADD COLUMN year_semester_config JSON NULL 
        AFTER semesters_per_year
      `);
      console.log('✅ year_semester_config column added to courses');
    } else {
      console.log('✅ year_semester_config column already exists in courses');
    }

    // Check if year_semester_config column exists in course_branches
    const [branchesColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'course_branches' 
        AND COLUMN_NAME = 'year_semester_config'
    `);

    if (branchesColumns.length === 0) {
      console.log('📦 Adding year_semester_config column to course_branches table...');
      await connection.query(`
        ALTER TABLE course_branches 
        ADD COLUMN year_semester_config JSON NULL 
        AFTER semesters_per_year
      `);
      console.log('✅ year_semester_config column added to course_branches');
    } else {
      console.log('✅ year_semester_config column already exists in course_branches');
    }

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   - Added year_semester_config column to courses table');
    console.log('   - Added year_semester_config column to course_branches table');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - Run: node scripts/update_diploma_course_semesters.js');
    console.log('   - Restart your backend server');
    
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

