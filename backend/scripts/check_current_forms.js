const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCurrentForms() {
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

    console.log('🔍 Checking Current Forms in Database');
    console.log('====================================');

    // Check all forms in the database
    const [forms] = await connection.execute(`
      SELECT form_id, form_name, form_description, is_active,
             LENGTH(form_fields) as fields_length
      FROM forms
      ORDER BY created_at DESC
    `);

    console.log(`Found ${forms.length} forms in database:`);

    for (const form of forms) {
      console.log(`\n📋 Form Details:`);
      console.log(`   - Form ID: ${form.form_id}`);
      console.log(`   - Form Name: ${form.form_name}`);
      console.log(`   - Description: ${form.form_description}`);
      console.log(`   - Active: ${form.is_active}`);
      console.log(`   - Fields Size: ${form.fields_length} characters`);

      // Parse and examine form fields
      const [formDetails] = await connection.execute(
        'SELECT form_fields FROM forms WHERE form_id = ?',
        [form.form_id]
      );

      if (formDetails.length > 0) {
        try {
          const formFields = typeof formDetails[0].form_fields === 'string'
            ? JSON.parse(formDetails[0].form_fields)
            : formDetails[0].form_fields;

          console.log(`   - Number of Fields: ${formFields.length}`);

          // Categorize fields
          const visibleFields = formFields.filter(field => field.isEnabled !== false);
          const hiddenFields = formFields.filter(field => field.isEnabled === false);
          const fieldsWithoutIsEnabled = formFields.filter(field => field.isEnabled === undefined);

          console.log(`   - Visible Fields: ${visibleFields.length}`);
          console.log(`   - Hidden Fields: ${hiddenFields.length}`);
          console.log(`   - Fields without isEnabled: ${fieldsWithoutIsEnabled.length}`);

          // Check for roll number field
          const rollNumberField = formFields.find(field =>
            field.key && field.key.toLowerCase().includes('roll') ||
            field.label && field.label.toLowerCase().includes('roll')
          );

          if (rollNumberField) {
            console.log(`   ❌ ROLL NUMBER FIELD FOUND:`);
            console.log(`      - Key: ${rollNumberField.key}`);
            console.log(`      - Label: ${rollNumberField.label}`);
            console.log(`      - Type: ${rollNumberField.type}`);
            console.log(`      - isEnabled: ${rollNumberField.isEnabled}`);
            console.log(`      - Required: ${rollNumberField.required}`);
          } else {
            console.log(`   ✅ No roll number field found`);
          }

          // Show hidden fields
          if (hiddenFields.length > 0) {
            console.log(`   📋 Hidden Fields:`);
            hiddenFields.forEach(field => {
              console.log(`      - ${field.key}: ${field.label} (${field.type})`);
            });
          }

          // Show all field keys for reference
          console.log(`   📋 All Field Keys:`);
          formFields.forEach(field => {
            console.log(`      - ${field.key}: ${field.label} (enabled: ${field.isEnabled !== false})`);
          });

        } catch (error) {
          console.log(`   ❌ Error parsing form fields:`, error.message);
        }
      }
    }

    console.log('\n🎉 Form check completed!');

  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the check
checkCurrentForms();