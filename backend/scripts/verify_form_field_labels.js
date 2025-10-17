const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyFormFieldLabels() {
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

    console.log('🔍 Verifying Form Field Labels and Configuration');
    console.log('===============================================');

    // Get all forms and examine their field configurations
    const [forms] = await connection.execute(`
      SELECT form_id, form_name, form_fields FROM forms
    `);

    console.log(`Found ${forms.length} forms to verify:`);

    for (const form of forms) {
      console.log(`\n📋 Form: ${form.form_name} (${form.form_id})`);

      if (form.form_fields) {
        try {
          const formFields = typeof form.form_fields === 'string'
            ? JSON.parse(form.form_fields)
            : form.form_fields;

          console.log(`   Total Fields: ${formFields.length}`);

          // Check for any field that might be confused with roll number
          const rollNumberLikeFields = formFields.filter(field =>
            field.key && (
              field.key.toLowerCase().includes('roll') ||
              field.key.toLowerCase().includes('pin') ||
              field.label && (
                field.label.toLowerCase().includes('roll') ||
                field.label.toLowerCase().includes('pin')
              )
            )
          );

          if (rollNumberLikeFields.length > 0) {
            console.log(`   ⚠️ Found ${rollNumberLikeFields.length} roll/PIN related fields:`);
            rollNumberLikeFields.forEach(field => {
              console.log(`      - Key: ${field.key}, Label: "${field.label}", Enabled: ${field.isEnabled}`);
            });
          }

          // Check field visibility configuration
          const visibleFields = formFields.filter(field => field.isEnabled !== false);
          const hiddenFields = formFields.filter(field => field.isEnabled === false);

          console.log(`   👁️ Visible Fields: ${visibleFields.length}`);
          console.log(`   🙈 Hidden Fields: ${hiddenFields.length}`);

          if (hiddenFields.length > 0) {
            console.log(`   📋 Hidden Field Labels:`);
            hiddenFields.forEach(field => {
              console.log(`      - "${field.label}" (${field.key})`);
            });
          }

        } catch (error) {
          console.log(`   ❌ Error parsing form fields:`, error.message);
        }
      }
    }

    // Check if PIN number field exists and is properly configured
    console.log('\n🔍 Checking PIN number field configuration...');

    const [pinCheck] = await connection.execute(`
      SELECT form_id, form_name FROM forms WHERE form_id = 'default_student_form'
    `);

    if (pinCheck.length > 0) {
      const [formDetails] = await connection.execute(
        'SELECT form_fields FROM forms WHERE form_id = ?',
        ['default_student_form']
      );

      if (formDetails.length > 0) {
        const formFields = JSON.parse(formDetails[0].form_fields);
        const pinField = formFields.find(field => field.key === 'pin_no');

        if (pinField) {
          console.log(`✅ PIN number field found:`);
          console.log(`   - Key: ${pinField.key}`);
          console.log(`   - Label: "${pinField.label}"`);
          console.log(`   - Type: ${pinField.type}`);
          console.log(`   - Required: ${pinField.required}`);
          console.log(`   - isEnabled: ${pinField.isEnabled}`);

          if (pinField.isEnabled === false) {
            console.log(`⚠️ PIN number field is hidden - this might be causing confusion`);
          } else {
            console.log(`✅ PIN number field is visible`);
          }
        } else {
          console.log(`❌ PIN number field not found in form`);
        }
      }
    }

    console.log('\n🎉 Form field verification completed!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the verification
verifyFormFieldLabels();