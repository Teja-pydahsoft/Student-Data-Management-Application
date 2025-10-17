const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function addPhotoFieldToForm() {
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

    console.log('📸 Adding Photo Field to Default Form');
    console.log('===================================');

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

    // Check if photo field already exists
    const existingPhotoField = formFields.find(field =>
      field.key && field.key.toLowerCase().includes('photo')
    );

    if (existingPhotoField) {
      console.log(`✅ Photo field already exists:`);
      console.log(`   - Key: ${existingPhotoField.key}`);
      console.log(`   - Label: "${existingPhotoField.label}"`);
      console.log(`   - isEnabled: ${existingPhotoField.isEnabled}`);

      // Update it to be visible if it's hidden
      if (existingPhotoField.isEnabled === false) {
        console.log(`🔄 Making photo field visible...`);
        existingPhotoField.isEnabled = true;

        await connection.execute(
          'UPDATE forms SET form_fields = ? WHERE form_id = ?',
          [JSON.stringify(formFields), 'default_student_form']
        );

        console.log(`✅ Photo field is now visible in student form`);
      } else {
        console.log(`✅ Photo field is already visible`);
      }
    } else {
      console.log(`❌ No photo field found, adding one...`);

      // Add photo field to form
      const photoField = {
        key: 'student_photo',
        label: 'Student Photo',
        type: 'file',
        required: false,
        isEnabled: true,
        accept: 'image/*'
      };

      formFields.push(photoField);
      console.log(`✅ Added photo field to form`);

      // Update the form
      await connection.execute(
        'UPDATE forms SET form_fields = ? WHERE form_id = ?',
        [JSON.stringify(formFields), 'default_student_form']
      );

      console.log(`✅ Successfully updated form with photo field`);
    }

    // Create uploads folder if it doesn't exist
    const uploadsDir = 'backend/uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`📁 Created uploads folder: ${uploadsDir}`);
    } else {
      console.log(`📁 Uploads folder already exists: ${uploadsDir}`);
    }

    // Set proper permissions on uploads folder
    try {
      fs.chmodSync(uploadsDir, 0o755);
      console.log(`🔐 Set proper permissions on uploads folder`);
    } catch (error) {
      console.log(`⚠️ Could not set permissions on uploads folder:`, error.message);
    }

    // Verify the form was updated correctly
    console.log('\n🔍 Verifying form update...');

    const [verifyForms] = await connection.execute(
      'SELECT form_fields FROM forms WHERE form_id = ?',
      ['default_student_form']
    );

    if (verifyForms.length > 0) {
      try {
        const verifyFields = typeof verifyForms[0].form_fields === 'string'
          ? JSON.parse(verifyForms[0].form_fields)
          : verifyForms[0].form_fields;

        const verifyPhotoField = verifyFields.find(field =>
          field.key && field.key.toLowerCase().includes('photo')
        );

        if (verifyPhotoField) {
          console.log(`✅ Photo field verified in form:`);
          console.log(`   - Key: ${verifyPhotoField.key}`);
          console.log(`   - Label: "${verifyPhotoField.label}"`);
          console.log(`   - Type: ${verifyPhotoField.type}`);
          console.log(`   - isEnabled: ${verifyPhotoField.isEnabled}`);

          if (verifyPhotoField.isEnabled === true) {
            console.log(`✅ Photo field is visible in student form`);
          } else {
            console.log(`⚠️ Photo field is hidden from student form`);
          }
        } else {
          console.log(`❌ Photo field not found in updated form`);
        }

        console.log(`📊 Updated form now has ${verifyFields.length} fields`);

      } catch (error) {
        console.log(`❌ Error verifying form fields:`, error.message);
      }
    }

    console.log('\n🎉 Photo field addition completed!');
    console.log('📝 Summary:');
    console.log('   - Added/updated photo field in default form');
    console.log('   - Ensured uploads folder exists');
    console.log('   - Set proper folder permissions');
    console.log('   - Photo upload should now be available in student form');

  } catch (error) {
    console.error('❌ Addition failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the addition
addPhotoFieldToForm();