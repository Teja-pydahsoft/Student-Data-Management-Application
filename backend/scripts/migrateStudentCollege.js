const mysql = require('mysql2/promise');
require('dotenv').config();

// College to Course mapping
const COLLEGE_COURSE_MAPPING = {
  'Pydah College of Engineering': ['B.Tech', 'Diploma'],
  'Pydah Degree College': ['Degree'],
  'Pydah College of Pharmacy': ['Pharmacy']
};

async function migrateStudentCollege() {
  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database',
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database successfully');
    console.log('📊 Database:', process.env.DB_NAME || 'student_database');
    console.log('\n📋 Starting student college migration...\n');

    // Verify college column exists
    const [colCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'students' 
        AND COLUMN_NAME = 'college'
    `, [process.env.DB_NAME || 'student_database']);

    if (colCheck[0].count === 0) {
      console.log('❌ College column does not exist. Please run migration_add_student_college.sql first.');
      process.exit(1);
    }

    // Get all students with their courses
    const [students] = await connection.execute(`
      SELECT id, admission_number, course, college
      FROM students
      WHERE course IS NOT NULL AND course != ''
      ORDER BY id
    `);

    console.log(`📊 Found ${students.length} students with course information\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];

    // Process each student
    for (const student of students) {
      const courseName = student.course?.trim();
      if (!courseName) {
        skippedCount++;
        continue;
      }

      // Skip if already has college
      if (student.college && student.college.trim()) {
        skippedCount++;
        continue;
      }

      // Find matching college
      let matchedCollege = null;
      for (const [collegeName, courseNames] of Object.entries(COLLEGE_COURSE_MAPPING)) {
        if (courseNames.includes(courseName)) {
          matchedCollege = collegeName;
          break;
        }
      }

      if (matchedCollege) {
        updates.push({
          id: student.id,
          admissionNumber: student.admission_number,
          course: courseName,
          college: matchedCollege
        });
      } else {
        skippedCount++;
        console.log(`⚠️  No college mapping found for course: "${courseName}" (Student: ${student.admission_number || student.id})`);
      }
    }

    // Perform batch updates
    if (updates.length > 0) {
      console.log(`\n🔄 Updating ${updates.length} students...\n`);

      for (const update of updates) {
        try {
          await connection.execute(
            'UPDATE students SET college = ? WHERE id = ?',
            [update.college, update.id]
          );
          updatedCount++;
          
          if (updatedCount % 100 === 0) {
            console.log(`   ✅ Updated ${updatedCount} students...`);
          }
        } catch (error) {
          console.error(`   ❌ Error updating student ${update.admissionNumber}:`, error.message);
        }
      }
    }

    // Verification
    console.log('\n🔍 Running verification...\n');

    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_students,
        COUNT(CASE WHEN college IS NOT NULL AND college != '' THEN 1 END) as students_with_college,
        COUNT(CASE WHEN college IS NULL OR college = '' THEN 1 END) as students_without_college,
        COUNT(DISTINCT college) as unique_colleges,
        COUNT(DISTINCT course) as unique_courses
      FROM students
    `);

    const [collegeBreakdown] = await connection.execute(`
      SELECT 
        college,
        COUNT(*) as student_count
      FROM students
      WHERE college IS NOT NULL AND college != ''
      GROUP BY college
      ORDER BY student_count DESC
    `);

    console.log('📊 Migration Summary:');
    console.log('   ', JSON.stringify(stats[0], null, 2));
    console.log('\n📊 College Breakdown:');
    collegeBreakdown.forEach(row => {
      console.log(`   ${row.college}: ${row.student_count} students`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('📝 Summary:');
    console.log(`   ✅ Updated: ${updatedCount} students`);
    console.log(`   ⏭️  Skipped: ${skippedCount} students (already had college or no mapping)`);
    console.log(`   📊 Total students with college: ${stats[0].students_with_college}`);
    console.log(`   📊 Total students without college: ${stats[0].students_without_college}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    console.error('💡 Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  migrateStudentCollege();
}

module.exports = { migrateStudentCollege };

