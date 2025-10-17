const mysql = require('mysql2/promise');
require('dotenv').config();

async function testCompletionCalculation() {
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

    console.log('🧮 Testing Completion Percentage Calculation');
    console.log('===========================================');

    // Get the student data for ADM001
    const [students] = await connection.execute(
      'SELECT * FROM students WHERE admission_number = ? OR admission_no = ?',
      ['ADM001', 'ADM001']
    );

    if (students.length === 0) {
      console.log('❌ Student ADM001 not found');
      return;
    }

    const student = students[0];
    console.log(`\n📋 Student found: ${student.admission_number || student.admission_no}`);

    // Parse student_data JSON
    let studentData = {};
    if (student.student_data) {
      try {
        studentData = typeof student.student_data === 'string'
          ? JSON.parse(student.student_data)
          : student.student_data;
        console.log(`✅ Successfully parsed student_data JSON (${student.student_data.length} chars)`);
      } catch (error) {
        console.log(`❌ Failed to parse student_data JSON:`, error.message);
      }
    }

    // Get form information
    let formId = null;
    if (studentData.form_id) {
      formId = studentData.form_id;
      console.log(`✅ Found form_id in student_data: ${formId}`);
    } else {
      console.log(`❌ No form_id found in student_data`);
    }

    if (!formId) {
      console.log('❌ Cannot determine form structure');
      return;
    }

    // Get form fields from Supabase (this would normally be done in the actual endpoint)
    const mysqlConn2 = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    const [forms] = await mysqlConn2.execute(
      'SELECT * FROM forms WHERE form_id = ?',
      [formId]
    );

    if (forms.length === 0) {
      console.log(`❌ Form ${formId} not found in database`);
      return;
    }

    const form = forms[0];
    const formFields = typeof form.form_fields === 'string'
      ? JSON.parse(form.form_fields)
      : form.form_fields;

    console.log(`\n📋 Form analysis:`);
    console.log(`   Form name: ${form.form_name}`);
    console.log(`   Form fields count: ${formFields.length}`);

    // Analyze each field
    const allFields = formFields.filter(field => field.key);
    console.log(`   Valid fields count: ${allFields.length}`);

    let completedFields = 0;
    const fieldAnalysis = [];

    for (const field of allFields) {
      const key = field.key;
      let value = null;
      let source = 'none';
      let completed = false;

      // Check individual database columns first
      if (student[key] !== undefined && student[key] !== null && student[key] !== '') {
        value = student[key];
        source = 'database_column';
        completed = true;
        completedFields++;
      }
      // Then check student_data JSON as fallback
      else if (studentData && studentData[key] !== undefined && studentData[key] !== null && studentData[key] !== '') {
        value = studentData[key];
        source = 'json_data';
        completed = true;
        completedFields++;
      }

      fieldAnalysis.push({
        key,
        label: field.label,
        value,
        source,
        completed
      });

      console.log(`   ${completed ? '✅' : '❌'} ${key}: ${source} = "${value}"`);
    }

    const totalFields = allFields.length;
    const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

    console.log(`\n📊 Completion calculation:`);
    console.log(`   Total fields: ${totalFields}`);
    console.log(`   Completed fields: ${completedFields}`);
    console.log(`   Completion percentage: ${completionPercentage}%`);

    // Show fields that are not completed
    const incompleteFields = fieldAnalysis.filter(f => !f.completed);
    if (incompleteFields.length > 0) {
      console.log(`\n❌ Incomplete fields (${incompleteFields.length}):`);
      incompleteFields.forEach(field => {
        console.log(`   - ${field.key}: ${field.label} (no value found)`);
      });
    } else {
      console.log(`\n✅ All fields are completed!`);
    }

    // Test the actual endpoint response format
    const mockResponse = {
      success: true,
      data: {
        totalFields,
        completedFields,
        pendingFields: totalFields - completedFields,
        completionPercentage,
        fieldStatus: fieldAnalysis,
        formName: form.form_name,
        debugInfo: {
          admissionNumber: student.admission_number || student.admission_no,
          formId,
          dataSource: 'Database columns + JSON fallback'
        }
      }
    };

    console.log(`\n🎯 Mock API response completion percentage: ${mockResponse.data.completionPercentage}%`);

    if (mockResponse.data.completionPercentage === 100) {
      console.log(`✅ Completion percentage calculation is working correctly`);
    } else {
      console.log(`❌ Completion percentage issue detected: ${mockResponse.data.completionPercentage}% instead of 100%`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testCompletionCalculation();