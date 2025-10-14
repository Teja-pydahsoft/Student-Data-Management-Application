const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const createDefaultForm = async () => {
  try {
    // Check if a form already exists
    const [forms] = await pool.query('SELECT form_id FROM forms LIMIT 1');
    if (forms.length > 0) {
      console.log('A form already exists. Skipping default form creation.');
      return;
    }

    console.log('No forms found. Creating a default form...');

    const formId = uuidv4();
    const formName = 'Default Student Registration Form';
    const formDescription = 'This is a default form for student registration, created automatically on deployment.';
    const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${formId}`;
    const qrCodeData = await QRCode.toDataURL(formUrl);

    // Define the fields for the default form
    const defaultFormFields = [
        { key: 'pin_no', label: 'Pin No', type: 'text', required: false },
        { key: 'batch', label: 'Batch', type: 'text', required: false },
        { key: 'branch', label: 'Branch', type: 'text', required: false },
        { key: 'stud_type', label: 'StudType', type: 'text', required: false },
        { key: 'student_name', label: 'Student Name', type: 'text', required: true },
        { key: 'student_status', label: 'Student Status', type: 'text', required: false },
        { key: 'scholar_status', label: 'Scholar Status', type: 'text', required: false },
        { key: 'student_mobile', label: 'Student Mobile Number', type: 'tel', required: false },
        { key: 'parent_mobile1', label: 'Parent Mobile Number 1', type: 'tel', required: false },
        { key: 'parent_mobile2', label: 'Parent Mobile Number 2', type: 'tel', required: false },
        { key: 'caste', label: 'Caste', type: 'text', required: false },
        { key: 'gender', label: 'M/F', type: 'select', options: ['M', 'F', 'Other'], required: false },
        { key: 'father_name', label: 'Father Name', type: 'text', required: false },
        { key: 'dob', label: 'DOB (Date of Birth - DD-MM-YYYY)', type: 'date', required: false },
        { key: 'adhar_no', label: 'ADHAR No', type: 'text', required: false },
        { key: 'admission_date', label: 'Admission Date', type: 'date', required: false },
        { key: 'roll_number', label: 'Roll Number', type: 'text', required: false },
        { key: 'student_address', label: 'Student Address (D.no, Str name, Village, Mandal, Dist)', type: 'textarea', required: false },
        { key: 'city_village', label: 'City/Village', type: 'text', required: false },
        { key: 'mandal_name', label: 'Mandal Name', type: 'text', required: false },
        { key: 'district', label: 'District', type: 'text', required: false },
        { key: 'previous_college', label: 'Previous College Name', type: 'text', required: false },
        { key: 'certificates_status', label: 'Certificate Status', type: 'text', required: false },
        { key: 'student_photo', label: 'Student Photo', type: 'text', required: false },
        { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
    ];

    // Assuming there's at least one admin, or created_by can be null/default
    const [admins] = await pool.query('SELECT id FROM admins LIMIT 1');
    const adminId = admins.length > 0 ? admins[0].id : null;

    await pool.query(
      `INSERT INTO forms (form_id, form_name, form_description, form_fields, qr_code_data, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [formId, formName, formDescription, JSON.stringify(defaultFormFields), qrCodeData, adminId, true]
    );

    console.log('Default form created successfully.');

  } catch (error) {
    console.error('Error creating default form:', error);
  }
};

module.exports = { createDefaultForm };
