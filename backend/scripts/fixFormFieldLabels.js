const { masterPool } = require('../config/database');

const fixFormFieldLabels = async () => {
  try {
    console.log('Fetching all forms...');

    // Get all forms
    const [forms] = await masterPool.query(
      'SELECT form_id, form_name, form_fields FROM forms WHERE is_active = 1'
    );

    console.log(`Found ${forms.length} forms to update`);

    // Define field label corrections
    const fieldCorrections = {
      'DOB (Date of Birth - DD-MM-YYYY)': 'DOB (Date-Month-Year)',
      'ADHAR No': 'AADHAR No',
      'Admission Date': 'Admission Year (Ex: 09-Sep-2003)',
      'City/Village': 'CityVillage Name',
      'District': 'District Name',
      'Student Address (D.no, Str name, Village, Mandal, Dist)': 'Student Address'
    };

    let updatedCount = 0;

    for (const form of forms) {
      let needsUpdate = false;
      let formFields;

      try {
        formFields = typeof form.form_fields === 'string' ? JSON.parse(form.form_fields) : form.form_fields;
      } catch (error) {
        console.error(`Error parsing form_fields for form ${form.form_name}:`, error);
        continue;
      }

      // Update field labels
      formFields.forEach(field => {
        if (fieldCorrections[field.label]) {
          field.label = fieldCorrections[field.label];
          needsUpdate = true;
        }
      });

      // Add missing fields if they don't exist
      const existingKeys = formFields.map(f => f.key);
      const missingFields = [
        { key: 'student_photo', label: 'Student Photo', type: 'text', required: false, isEnabled: false }
      ];

      missingFields.forEach(missingField => {
        if (!existingKeys.includes(missingField.key)) {
          formFields.push(missingField);
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        await masterPool.query(
          'UPDATE forms SET form_fields = ? WHERE form_id = ?',
          [JSON.stringify(formFields), form.form_id]
        );
        updatedCount++;
        console.log(`✅ Updated form: ${form.form_name}`);
      }
    }

    console.log(`\n✅ Completed! Updated ${updatedCount} forms.`);

  } catch (error) {
    console.error('Error fixing form field labels:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

fixFormFieldLabels();
