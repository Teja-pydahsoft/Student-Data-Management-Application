const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixStudentFormId() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('🔧 Fixing Student Form ID for Completion Calculation');
    console.log('===================================================');

    // First, find the form_id for student ADM001 from form_submissions
    console.log('\n🔍 Finding form_id for student ADM001...');

    const [submissions] = await connection.execute(`
      SELECT form_id, submission_data FROM form_submissions
      WHERE admission_number = 'ADM001' AND status = 'approved'
      LIMIT 1
    `);

    if (submissions.length === 0) {
      console.log('❌ No approved submission found for ADM001');
      return;
    }

    const submission = submissions[0];
    const formId = submission.form_id;
    console.log(`✅ Found form_id: ${formId}`);

    // Get current student data
    const [students] = await connection.execute(
      'SELECT student_data FROM students WHERE admission_number = ? OR admission_no = ?',
      ['ADM001', 'ADM001']
    );

    if (students.length === 0) {
      console.log('❌ Student ADM001 not found');
      return;
    }

    const student = students[0];
    let studentData = {};

    if (student.student_data) {
      try {
        studentData = typeof student.student_data === 'string'
          ? JSON.parse(student.student_data)
          : student.student_data;
        console.log(`✅ Successfully parsed existing student_data`);
      } catch (error) {
        console.log(`❌ Failed to parse student_data:`, error.message);
        return;
      }
    }

    console.log(`📋 Current student_data keys:`, Object.keys(studentData));

    // Check if form_id already exists
    if (studentData.form_id) {
      console.log(`✅ form_id already exists: ${studentData.form_id}`);
      if (studentData.form_id === formId) {
        console.log(`✅ form_id is correct`);
        return;
      } else {
        console.log(`❌ form_id mismatch: expected ${formId}, got ${studentData.form_id}`);
      }
    } else {
      console.log(`❌ form_id missing from student_data`);
    }

    // Add form_id to student_data
    studentData.form_id = formId;
    console.log(`📋 Added form_id: ${formId}`);

    // Update the student record
    const updatedJsonData = JSON.stringify(studentData);

    await connection.execute(
      'UPDATE students SET student_data = ? WHERE admission_number = ? OR admission_no = ?',
      [updatedJsonData, 'ADM001', 'ADM001']
    );

    console.log(`✅ Successfully updated student ADM001 with form_id`);

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');

    const [verifyStudents] = await connection.execute(
      'SELECT student_data FROM students WHERE admission_number = ? OR admission_no = ?',
      ['ADM001', 'ADM001']
    );

    if (verifyStudents.length > 0) {
      try {
        const verifyData = JSON.parse(verifyStudents[0].student_data);
        if (verifyData.form_id === formId) {
          console.log(`✅ Verification successful: form_id correctly set to ${formId}`);
        } else {
          console.log(`❌ Verification failed: form_id is ${verifyData.form_id}, expected ${formId}`);
        }
      } catch (error) {
        console.log(`❌ Verification failed: Could not parse updated JSON`);
      }
    }

    console.log('\n🎉 Student form_id fix completed!');
    console.log('📝 Summary:');
    console.log('   - Found correct form_id from submission');
    console.log('   - Updated student_data JSON with form_id');
    console.log('   - Completion percentage calculation should now work');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the fix
fixStudentFormId();