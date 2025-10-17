const { supabase } = require('../config/supabase');

const fixFormFieldLabels = async () => {
  try {
    console.log('Fetching all forms...');

    // Get all forms
    const { data: forms, error } = await supabase
      .from('forms')
      .select('form_id, form_name, form_fields')
      .eq('is_active', true);

    if (error) throw error;

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
        { key: 'admission_no', label: 'Admission No', type: 'text', required: false, isEnabled: true }
      ];

      missingFields.forEach(missingField => {
        if (!existingKeys.includes(missingField.key)) {
          formFields.push(missingField);
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('forms')
          .update({ form_fields: JSON.stringify(formFields) })
          .eq('form_id', form.form_id);

        if (updateError) {
          console.error(`Error updating form ${form.form_name}:`, updateError);
        } else {
          console.log(`✅ Updated form: ${form.form_name}`);
          updatedCount++;
        }
      }
    }

    console.log(`\n✅ Fixed ${updatedCount} forms successfully!`);

  } catch (error) {
    console.error('Error fixing form field labels:', error);
  }
};

module.exports = { fixFormFieldLabels };