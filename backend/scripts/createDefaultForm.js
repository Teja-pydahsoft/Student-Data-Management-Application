const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const createDefaultForm = async () => {
  try {
    // Check if the default student form already exists
    const { data: forms, error: e0 } = await supabase
      .from('forms')
      .select('form_id')
      .eq('form_name', 'Default Student Registration Form')
      .limit(1);
    if (e0) throw e0;
    if (forms && forms.length > 0) {
      console.log('Default student form already exists. Skipping creation.');
      return;
    }

    console.log('Creating default student form...');

    const formId = uuidv4();
    const formName = 'Default Student Registration Form';
    const formDescription = 'This is a default form for student registration, created automatically on deployment.';
    const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${formId}`;
    const qrCodeData = await QRCode.toDataURL(formUrl);

    // Define the fields for the default form
    const defaultFormFields = [
        { key: 'pin_no', label: 'Pin No', type: 'text', required: false, isEnabled: true },
        { key: 'batch', label: 'Batch', type: 'text', required: false, isEnabled: true },
        { key: 'branch', label: 'Branch', type: 'text', required: false, isEnabled: true },
        { key: 'stud_type', label: 'StudType', type: 'text', required: false, isEnabled: true },
        { key: 'student_name', label: 'Student Name', type: 'text', required: true, isEnabled: true },
        { key: 'student_status', label: 'Student Status', type: 'text', required: false, isEnabled: true },
        { key: 'scholar_status', label: 'Scholar Status', type: 'text', required: false, isEnabled: true },
        { key: 'student_mobile', label: 'Student Mobile Number', type: 'tel', required: false, isEnabled: true },
        { key: 'parent_mobile1', label: 'Parent Mobile Number 1', type: 'tel', required: false, isEnabled: true },
        { key: 'parent_mobile2', label: 'Parent Mobile Number 2', type: 'tel', required: false, isEnabled: true },
        { key: 'caste', label: 'Caste', type: 'text', required: false, isEnabled: true },
        { key: 'gender', label: 'M/F', type: 'select', options: ['M', 'F', 'Other'], required: false, isEnabled: true },
        { key: 'father_name', label: 'Father Name', type: 'text', required: false, isEnabled: true },
        { key: 'dob', label: 'DOB (Date of Birth - DD-MM-YYYY)', type: 'date', required: false, isEnabled: true },
        { key: 'adhar_no', label: 'ADHAR No', type: 'text', required: false, isEnabled: true },
        { key: 'admission_date', label: 'Admission Date', type: 'date', required: false, isEnabled: true },
        { key: 'roll_number', label: 'Roll Number', type: 'text', required: false, isEnabled: true },
        { key: 'student_address', label: 'Student Address (D.no, Str name, Village, Mandal, Dist)', type: 'textarea', required: false, isEnabled: true },
        { key: 'city_village', label: 'City/Village', type: 'text', required: false, isEnabled: true },
        { key: 'mandal_name', label: 'Mandal Name', type: 'text', required: false, isEnabled: true },
        { key: 'district', label: 'District', type: 'text', required: false, isEnabled: true },
        { key: 'previous_college', label: 'Previous College Name', type: 'text', required: false, isEnabled: true },
        { key: 'certificates_status', label: 'Certificate Status', type: 'text', required: false, isEnabled: true },
        { key: 'student_photo', label: 'Student Photo', type: 'text', required: false, isEnabled: false }, // Hidden by default
        { key: 'remarks', label: 'Remarks', type: 'textarea', required: false, isEnabled: true },
    ];

    // Assuming there's at least one admin, or created_by can be null/default
    const { data: admins, error: e1 } = await supabase
      .from('admins')
      .select('id')
      .limit(1);
    if (e1) throw e1;
    const adminId = admins && admins.length > 0 ? admins[0].id : null;

    const { error: e2 } = await supabase
      .from('forms')
      .insert({
        form_id: formId,
        form_name: formName,
        form_description: formDescription,
        form_fields: defaultFormFields,
        qr_code_data: qrCodeData,
        created_by: adminId,
        is_active: true
      });
    if (e2) throw e2;

    console.log('✅ Default student form created successfully with ID:', formId);
    console.log('📱 QR Code URL:', formUrl);

  } catch (error) {
    console.error('Error creating default form:', error);
  }
};

module.exports = { createDefaultForm };
