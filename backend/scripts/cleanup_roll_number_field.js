const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanupRollNumberField() {
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

    console.log('🧹 Cleaning Up Roll Number Field Issue');
    console.log('=====================================');

    // Get current form
    const [forms] = await connection.execute(
      'SELECT form_id, form_name, form_fields FROM forms WHERE form_id = ?',
      ['default_student_form']
    );

    if (forms.length === 0) {
      console.log('❌ Default form not found');
      return;
    }

    const form = forms[0];
    console.log(`📋 Found form: ${form.form_name}`);

    let formFields = [];
    if (form.form_fields) {
      try {
        formFields = typeof form.form_fields === 'string'
          ? JSON.parse(form.form_fields)
          : form.form_fields;
      } catch (error) {
        console.log(`❌ Error parsing form fields:`, error.message);
        return;
      }
    }

    console.log(`📋 Original form has ${formFields.length} fields`);

    // Check for any roll number related fields
    const rollNumberFields = formFields.filter(field =>
      field.key && (
        field.key.toLowerCase().includes('roll') ||
        field.label && field.label.toLowerCase().includes('roll')
      )
    );

    if (rollNumberFields.length > 0) {
      console.log(`❌ Found ${rollNumberFields.length} roll number related fields:`);
      rollNumberFields.forEach(field => {
        console.log(`   - Key: ${field.key}, Label: ${field.label}, isEnabled: ${field.isEnabled}`);
      });

      // Remove roll number fields
      const cleanedFields = formFields.filter(field =>
        !field.key || !field.key.toLowerCase().includes('roll')
      );

      console.log(`✅ Removed ${rollNumberFields.length} roll number fields`);
      console.log(`📋 Cleaned form now has ${cleanedFields.length} fields`);

      // Update the form
      await connection.execute(
        'UPDATE forms SET form_fields = ? WHERE form_id = ?',
        [JSON.stringify(cleanedFields), 'default_student_form']
      );

      console.log(`✅ Successfully updated form, removed roll number fields`);
    } else {
      console.log(`✅ No roll number fields found in form`);
    }

    // Also check if there are any forms with roll number fields
    console.log('\n🔍 Checking all forms for roll number fields...');

    const [allForms] = await connection.execute(
      'SELECT form_id, form_name, form_fields FROM forms'
    );

    for (const checkForm of allForms) {
      if (checkForm.form_fields) {
        try {
          const checkFields = typeof checkForm.form_fields === 'string'
            ? JSON.parse(checkForm.form_fields)
            : checkForm.form_fields;

          const checkRollFields = checkFields.filter(field =>
            field.key && field.key.toLowerCase().includes('roll')
          );

          if (checkRollFields.length > 0) {
            console.log(`❌ Form ${checkForm.form_id} (${checkForm.form_name}) has roll number fields:`);
            checkRollFields.forEach(field => {
              console.log(`   - ${field.key}: ${field.label}`);
            });
          }
        } catch (error) {
          console.log(`❌ Error checking form ${checkForm.form_id}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Roll number field cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the cleanup
cleanupRollNumberField();