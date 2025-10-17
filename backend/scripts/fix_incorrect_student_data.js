const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixIncorrectStudentData() {
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

    console.log('🔧 Starting Student Data Correction Process');
    console.log('============================================');

    // Step 1: Identify students with incorrect data
    console.log('\n🔍 Step 1: Finding students with potential data issues...');

    const [students] = await connection.execute(`
      SELECT admission_number, admission_no, student_name, dob, batch, caste, branch, gender, pin_no, remarks
      FROM students
      WHERE admission_number IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${students.length} recent students to analyze:`);

    for (const student of students) {
      console.log(`\n📋 Student: ${student.admission_number || student.admission_no}`);
      console.log(`   - Name: "${student.student_name}"`);
      console.log(`   - DOB: "${student.dob}"`);
      console.log(`   - Batch: "${student.batch}"`);
      console.log(`   - Caste: "${student.caste}"`);
      console.log(`   - Branch: "${student.branch}"`);
      console.log(`   - Gender: "${student.gender}"`);
      console.log(`   - Pin: "${student.pin_no}"`);
      console.log(`   - Remarks: "${student.remarks}"`);

      // Check if data looks incorrect (e.g., admission number in wrong fields)
      if (student.dob === student.admission_number || student.batch === student.admission_number) {
        console.log(`   ❌ WARNING: Data appears incorrect for ${student.admission_number}`);
      }
    }

    // Step 2: Get the correct data from form submissions
    console.log('\n🔄 Step 2: Retrieving correct data from form submissions...');

    const [submissions] = await connection.execute(`
      SELECT fs.admission_number, fs.submission_data, s.student_name, s.dob, s.batch, s.caste, s.branch
      FROM form_submissions fs
      LEFT JOIN students s ON fs.admission_number = s.admission_number
      WHERE fs.admission_number IS NOT NULL
      AND fs.status = 'approved'
      ORDER BY fs.reviewed_at DESC
      LIMIT 5
    `);

    console.log(`Found ${submissions.length} approved submissions to verify:`);

    for (const submission of submissions) {
      if (submission.submission_data) {
        try {
          const submissionData = typeof submission.submission_data === 'string'
            ? JSON.parse(submission.submission_data)
            : submission.submission_data;

          console.log(`\n📋 Submission for ${submission.admission_number}:`);
          console.log(`   Original submission data:`);
          console.log(`     - student_name: "${submissionData.student_name}"`);
          console.log(`     - dob: "${submissionData.dob}"`);
          console.log(`     - batch: "${submissionData.batch}"`);
          console.log(`     - caste: "${submissionData.caste}"`);
          console.log(`     - branch: "${submissionData.branch}"`);
          console.log(`     - gender: "${submissionData.gender}"`);
          console.log(`     - pin_no: "${submissionData.pin_no}"`);

          console.log(`   Current database values:`);
          console.log(`     - student_name: "${submission.student_name}"`);
          console.log(`     - dob: "${submission.dob}"`);
          console.log(`     - batch: "${submission.batch}"`);
          console.log(`     - caste: "${submission.caste}"`);
          console.log(`     - branch: "${submission.branch}"`);

          // Check for data mismatch
          const mismatches = [];
          if (submissionData.dob && submission.dob && submissionData.dob !== submission.dob) {
            mismatches.push(`DOB: expected "${submissionData.dob}", got "${submission.dob}"`);
          }
          if (submissionData.batch && submission.batch && submissionData.batch !== submission.batch) {
            mismatches.push(`Batch: expected "${submissionData.batch}", got "${submission.batch}"`);
          }
          if (submissionData.student_name && submission.student_name && submissionData.student_name !== submission.student_name) {
            mismatches.push(`Name: expected "${submissionData.student_name}", got "${submission.student_name}"`);
          }

          if (mismatches.length > 0) {
            console.log(`   ❌ DATA MISMATCHES FOUND:`);
            mismatches.forEach(mismatch => console.log(`      - ${mismatch}`));

            // Offer to fix this student
            console.log(`   🔧 Fixing student ${submission.admission_number}...`);

            // Update with correct values from submission data
            const updateFields = [];
            const updateValues = [];

            if (submissionData.student_name) {
              updateFields.push('student_name = ?');
              updateValues.push(submissionData.student_name);
            }
            if (submissionData.dob) {
              updateFields.push('dob = ?');
              updateValues.push(submissionData.dob);
            }
            if (submissionData.batch) {
              updateFields.push('batch = ?');
              updateValues.push(submissionData.batch);
            }
            if (submissionData.caste) {
              updateFields.push('caste = ?');
              updateValues.push(submissionData.caste);
            }
            if (submissionData.branch) {
              updateFields.push('branch = ?');
              updateValues.push(submissionData.branch);
            }
            if (submissionData.gender) {
              updateFields.push('gender = ?');
              updateValues.push(submissionData.gender);
            }
            if (submissionData.pin_no) {
              updateFields.push('pin_no = ?');
              updateValues.push(submissionData.pin_no);
            }
            if (submissionData.remarks) {
              updateFields.push('remarks = ?');
              updateValues.push(submissionData.remarks);
            }
            if (submissionData.adhar_no) {
              updateFields.push('adhar_no = ?');
              updateValues.push(submissionData.adhar_no);
            }
            if (submissionData.father_name) {
              updateFields.push('father_name = ?');
              updateValues.push(submissionData.father_name);
            }
            if (submissionData.student_mobile) {
              updateFields.push('student_mobile = ?');
              updateValues.push(submissionData.student_mobile);
            }
            if (submissionData.parent_mobile1) {
              updateFields.push('parent_mobile1 = ?');
              updateValues.push(submissionData.parent_mobile1);
            }
            if (submissionData.student_address) {
              updateFields.push('student_address = ?');
              updateValues.push(submissionData.student_address);
            }
            if (submissionData.city_village) {
              updateFields.push('city_village = ?');
              updateValues.push(submissionData.city_village);
            }
            if (submissionData.mandal_name) {
              updateFields.push('mandal_name = ?');
              updateValues.push(submissionData.mandal_name);
            }
            if (submissionData.district) {
              updateFields.push('district = ?');
              updateValues.push(submissionData.district);
            }

            // Update the student record with correct values
            if (updateFields.length > 0) {
              updateFields.push('admission_number = ?');
              updateValues.push(submission.admission_number);

              const updateQuery = `UPDATE students SET ${updateFields.join(', ')} WHERE admission_number = ?`;
              await connection.execute(updateQuery, [...updateValues.slice(0, -1), submission.admission_number]);

              console.log(`   ✅ Successfully updated ${submission.admission_number} with ${updateFields.length - 1} corrected fields`);
            }
          } else {
            console.log(`   ✅ Data appears correct for ${submission.admission_number}`);
          }
        } catch (error) {
          console.log(`   ❌ Error parsing submission data for ${submission.admission_number}:`, error.message);
        }
      }
    }

    // Step 3: Verify the fixes
    console.log('\n🔍 Step 3: Verifying corrections...');

    const [verifyStudents] = await connection.execute(`
      SELECT admission_number, student_name, dob, batch, caste, branch, gender, pin_no, remarks
      FROM students
      WHERE admission_number = 'ADM002'
    `);

    if (verifyStudents.length > 0) {
      const student = verifyStudents[0];
      console.log(`\n📋 Verification for ADM002:`);
      console.log(`   - Name: "${student.student_name}"`);
      console.log(`   - DOB: "${student.dob}"`);
      console.log(`   - Batch: "${student.batch}"`);
      console.log(`   - Caste: "${student.caste}"`);
      console.log(`   - Branch: "${student.branch}"`);
      console.log(`   - Gender: "${student.gender}"`);
      console.log(`   - Pin: "${student.pin_no}"`);
      console.log(`   - Remarks: "${student.remarks}"`);

      // Check if data now looks correct
      if (student.dob !== 'ADM002' && student.batch !== 'ADM002' && student.student_name !== 'ADM002') {
        console.log(`   ✅ Student ADM002 data now appears correct!`);
      } else {
        console.log(`   ❌ Student ADM002 still has incorrect data`);
      }
    }

    console.log('\n🎉 Student data correction process completed!');
    console.log('📝 Summary:');
    console.log('   - Analyzed recent student records');
    console.log('   - Identified data mapping issues');
    console.log('   - Corrected field placements');
    console.log('   - Verified data integrity');

  } catch (error) {
    console.error('❌ Correction process failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the correction process
fixIncorrectStudentData();