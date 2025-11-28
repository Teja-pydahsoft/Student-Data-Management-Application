/**
 * Script to update Diploma course: Year 1 has 1 semester, Year 2-3 have 2 semesters each
 * 
 * Run with: node scripts/update_diploma_course_semesters.js
 * 
 * Make sure to run this from the backend directory:
 * cd backend
 * node scripts/update_diploma_course_semesters.js
 */

// Load environment variables from backend/.env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { masterPool } = require('../config/database');

async function updateDiplomaCourse() {
  console.log('🔄 Updating Diploma course semester configuration...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Check if year_semester_config column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'year_semester_config'
    `);

    if (columns.length === 0) {
      console.log('📦 Adding year_semester_config column to courses table...');
      await connection.query(`
        ALTER TABLE courses 
        ADD COLUMN year_semester_config JSON NULL 
        AFTER semesters_per_year
      `);
      console.log('✅ year_semester_config column added to courses');
    }

    // Find Diploma course
    const [diplomaCourses] = await connection.query(`
      SELECT id, name, total_years, semesters_per_year, year_semester_config
      FROM courses 
      WHERE LOWER(name) LIKE '%diploma%'
    `);

    if (diplomaCourses.length === 0) {
      console.log('⚠️  No Diploma course found. Please create it first.');
      return;
    }

    for (const course of diplomaCourses) {
      console.log(`📝 Updating course: ${course.name} (ID: ${course.id})`);
      
      // Configure: Year 1 = 1 semester, Year 2-3 = 2 semesters each
      // Assuming Diploma is 3 years, adjust if different
      const totalYears = course.total_years || 3;
      const yearSemesterConfig = [];
      
      for (let year = 1; year <= totalYears; year++) {
        if (year === 1) {
          yearSemesterConfig.push({ year: year, semesters: 1 });
        } else {
          yearSemesterConfig.push({ year: year, semesters: 2 });
        }
      }

      await connection.query(`
        UPDATE courses 
        SET year_semester_config = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(yearSemesterConfig), course.id]);

      console.log(`✅ Updated ${course.name} with configuration:`, yearSemesterConfig);
    }

    console.log('');
    console.log('🎉 Diploma course update completed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   - Year 1: 1 semester');
    console.log('   - Year 2+: 2 semesters each');
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error('   Error details:', error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

updateDiplomaCourse().catch((error) => {
  console.error('Update error:', error);
  process.exit(1);
});

