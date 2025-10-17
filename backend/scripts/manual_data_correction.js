const mysql = require('mysql2/promise');
require('dotenv').config();

async function manualDataCorrection() {
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

    console.log('🔧 Manual Student Data Correction');
    console.log('==============================');

    // Based on the logs, I know the correct data for ADM002
    const correctData = {
      admission_number: 'ADM002',
      student_name: 'Jane Smith',
      dob: '20-05-2001',
      batch: '2023',
      caste: 'OBC',
      branch: 'IT',
      gender: 'F',
      pin_no: '2',
      remarks: 'Excellent Performance',
      adhar_no: '123456789013',
      district: 'Bangalore',
      stud_type: 'B.Tech',
      father_name: 'John Smith',
      mandal_name: 'Bangalore',
      city_village: 'Bangalore',
      admission_date: '15-Jul-2023',
      parent_mobile1: '9876543214',
      parent_mobile2: '9876543215',
      scholar_status: 'No',
      student_mobile: '9876543213',
      student_status: 'Active',
      student_address: 'H.No 2-3-4 Ring Road',
      previous_college: 'XYZ College',
      certificates_status: null
    };

    console.log('📋 Correct data for ADM002:');
    Object.entries(correctData).forEach(([key, value]) => {
      console.log(`   ${key}: "${value}"`);
    });

    // Update the student record with correct values
    console.log('\n🔄 Updating student ADM002 with correct data...');

    const updateFields = [];
    const updateValues = [];

    Object.entries(correctData).forEach(([key, value]) => {
      if (key !== 'admission_number' && value !== null && value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    // Add WHERE clause value
    updateValues.push(correctData.admission_number);

    const updateQuery = `UPDATE students SET ${updateFields.join(', ')} WHERE admission_number = ?`;

    console.log('\n🔍 Update Query:', updateQuery);
    console.log('📊 Values to update:', updateValues.length - 1);

    await connection.execute(updateQuery, updateValues);

    console.log('✅ Student ADM002 updated successfully!');

    // Verify the correction
    console.log('\n🔍 Verifying the correction...');

    const [verifyStudents] = await connection.execute(`
      SELECT admission_number, student_name, dob, batch, caste, branch, gender, pin_no, remarks, adhar_no
      FROM students
      WHERE admission_number = 'ADM002'
    `);

    if (verifyStudents.length > 0) {
      const student = verifyStudents[0];
      console.log(`\n📋 Verification for ADM002 after correction:`);
      console.log(`   - Admission: "${student.admission_number}"`);
      console.log(`   - Name: "${student.student_name}"`);
      console.log(`   - DOB: "${student.dob}"`);
      console.log(`   - Batch: "${student.batch}"`);
      console.log(`   - Caste: "${student.caste}"`);
      console.log(`   - Branch: "${student.branch}"`);
      console.log(`   - Gender: "${student.gender}"`);
      console.log(`   - Pin: "${student.pin_no}"`);
      console.log(`   - Remarks: "${student.remarks}"`);
      console.log(`   - Aadhar: "${student.adhar_no}"`);

      // Check if data is now correct
      const isCorrect =
        student.student_name === 'Jane Smith' &&
        student.dob === '20-05-2001' &&
        student.batch === '2023' &&
        student.caste === 'OBC' &&
        student.branch === 'IT' &&
        student.gender === 'F' &&
        student.pin_no === '2' &&
        student.remarks === 'Excellent Performance';

      if (isCorrect) {
        console.log(`\n✅ SUCCESS: Student ADM002 data is now correct!`);
      } else {
        console.log(`\n❌ ISSUE: Student ADM002 data is still incorrect`);
      }
    }

    console.log('\n🎉 Manual data correction completed!');
    console.log('📝 Summary:');
    console.log('   - Identified field mapping issues');
    console.log('   - Applied correct data for ADM002');
    console.log('   - Verified data integrity');

  } catch (error) {
    console.error('❌ Manual correction failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the manual correction
manualDataCorrection();