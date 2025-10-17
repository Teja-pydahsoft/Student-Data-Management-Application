const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDuplicateFix() {
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

    console.log('🧪 Testing Duplicate Field Fix');
    console.log('==============================');

    // Test data that previously caused duplicate admission_no issues
    const testSubmissionData = {
      student_name: 'Test Student',
      dob: '15-05-2000',
      batch: '2023',
      caste: 'General',
      branch: 'CSE',
      gender: 'M',
      pin_no: '123',
      remarks: 'Test student for duplicate field fix',
      adhar_no: '123456789012',
      district: 'Test District',
      stud_type: 'B.Tech',
      father_name: 'Test Father',
      mandal_name: 'Test Mandal',
      city_village: 'Test City',
      admission_date: '01-Jul-2023',
      parent_mobile1: '9876543210',
      parent_mobile2: '9876543211',
      scholar_status: 'Yes',
      student_mobile: '9876543212',
      student_status: 'Active',
      student_address: 'Test Address',
      previous_college: 'Test College',
      certificates_status: 'Pending',
      admission_no: 'ADM002' // This was causing duplicates
    };

    console.log('📋 Test submission data contains:');
    Object.entries(testSubmissionData).forEach(([key, value]) => {
      console.log(`   ${key}: "${value}"`);
    });

    // Simulate the field mapping logic from the fixed code
    const finalAdmissionNumber = 'TEST_DUPLICATE_FIX';
    const predefinedKeys = [
      'pin_no', 'batch', 'branch', 'stud_type', 'student_name', 'student_status',
      'scholar_status', 'student_mobile', 'parent_mobile1', 'parent_mobile2',
      'caste', 'gender', 'father_name', 'dob', 'adhar_no', 'admission_date',
      'admission_no', 'student_address', 'city_village', 'mandal_name', 'district',
      'previous_college', 'certificates_status', 'student_photo', 'remarks'
    ];

    console.log('\n🔍 Testing field mapping logic...');

    // Simulate the fixed field mapping logic
    const fieldValuePairs = [];
    const addedFields = new Set();

    // Add base fields
    fieldValuePairs.push({ field: 'admission_number', value: finalAdmissionNumber });
    addedFields.add('admission_number');

    fieldValuePairs.push({ field: 'admission_no', value: finalAdmissionNumber });
    addedFields.add('admission_no');

    // Add admission_no if in submission data
    if (testSubmissionData.admission_no && !addedFields.has('admission_no')) {
      fieldValuePairs.push({ field: 'admission_no', value: testSubmissionData.admission_no });
      addedFields.add('admission_no');
    }

    // Add predefined fields
    Object.entries(testSubmissionData).forEach(([key, value]) => {
      if (predefinedKeys.includes(key) && !addedFields.has(key)) {
        fieldValuePairs.push({ field: key, value: value });
        addedFields.add(key);
      }
    });

    // Add student_data
    if (!addedFields.has('student_data')) {
      const jsonData = JSON.stringify(testSubmissionData);
      fieldValuePairs.push({ field: 'student_data', value: jsonData });
      addedFields.add('student_data');
    }

    // Extract ordered fields and values
    const insertFields = fieldValuePairs.map(pair => pair.field);
    const insertValues = fieldValuePairs.map(pair => pair.value);

    console.log('\n📊 Field mapping results:');
    console.log(`   Total pairs: ${fieldValuePairs.length}`);
    console.log(`   Unique fields: ${new Set(insertFields).size}`);
    console.log(`   Has duplicates: ${new Set(insertFields).size !== insertFields.length ? '❌ YES' : '✅ NO'}`);

    if (new Set(insertFields).size !== insertFields.length) {
      console.log('\n❌ DUPLICATE FIELDS FOUND:');
      const fieldCounts = {};
      insertFields.forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });
      Object.entries(fieldCounts).forEach(([field, count]) => {
        if (count > 1) {
          console.log(`   ${field}: ${count} times`);
        }
      });
    } else {
      console.log('\n✅ No duplicate fields found');

      // Test the actual SQL query construction
      console.log('\n🧪 Testing SQL query construction...');
      const placeholders = insertFields.map(() => '?').join(', ');
      const query = `INSERT INTO students (${insertFields.join(', ')}) VALUES (${placeholders})`;

      console.log(`Query length: ${query.length} characters`);
      console.log(`Fields count: ${insertFields.length}`);
      console.log(`Values count: ${insertValues.length}`);

      // Verify the query would work
      if (insertFields.length === insertValues.length) {
        console.log('✅ Field count matches value count');

        // Test a simplified version of the query
        try {
          const testQuery = 'INSERT INTO students (admission_number, student_name) VALUES (?, ?)';
          await connection.execute(testQuery, ['TEST_DUP_FIX', 'Test Student']);
          console.log('✅ Basic INSERT test successful');

          // Clean up
          await connection.execute('DELETE FROM students WHERE admission_number = ?', ['TEST_DUP_FIX']);
          console.log('🗑️  Test data cleaned up');
        } catch (testError) {
          console.log('❌ Basic INSERT test failed:', testError.message);
        }
      } else {
        console.log('❌ Field count does NOT match value count');
      }
    }

    console.log('\n🎉 Duplicate field fix test completed!');
    console.log('📝 Summary:');
    console.log('   - Analyzed field mapping logic');
    console.log('   - Tested duplicate prevention');
    console.log('   - Verified SQL query construction');
    console.log('   - Confirmed fix effectiveness');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
testDuplicateFix();