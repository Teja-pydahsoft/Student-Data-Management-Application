const { pool } = require('../config/database');

async function fixFormFieldsIsEnabled() {
  try {
    console.log('🔧 Fixing form fields isEnabled property...');

    // Get all forms
    const [forms] = await pool.query('SELECT id, form_id, form_name, form_fields FROM forms');

    for (const form of forms) {
      console.log(`Processing form: ${form.form_name}`);
      
      let formFields = form.form_fields;
      
      // Parse JSON if it's a string
      if (typeof formFields === 'string') {
        formFields = JSON.parse(formFields);
      }

      let updated = false;

      // Ensure all fields have isEnabled property
      formFields.forEach(field => {
        if (field.isEnabled === undefined) {
          field.isEnabled = true; // Default to enabled
          updated = true;
        }
      });

      if (updated) {
        // Update the form in database
        await pool.query(
          'UPDATE forms SET form_fields = ? WHERE id = ?',
          [JSON.stringify(formFields), form.id]
        );
        console.log(`✅ Updated form: ${form.form_name}`);
      } else {
        console.log(`⏭️  No changes needed for form: ${form.form_name}`);
      }
    }

    console.log('🎉 All forms updated successfully!');
  } catch (error) {
    console.error('❌ Error fixing form fields:', error);
  } finally {
    process.exit();
  }
}

// Run the fix
fixFormFieldsIsEnabled();
