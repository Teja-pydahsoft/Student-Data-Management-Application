const { masterPool } = require('../config/database');
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Helper function to safely parse JSON fields
const parseJSON = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
  return data;
};

// Helper function to safely stringify data for database storage
const safeJSONStringify = (data) => {
  try {
    // First validate that the data can be JSON parsed (round-trip test)
    const testString = JSON.stringify(data);
    JSON.parse(testString);

    // Check size limit
    if (testString.length > 50000) {
      console.warn('Data size exceeds limit, truncating...');
      const essentialData = {
        admission_number: data.admission_number || 'Unknown',
        student_name: data.student_name || 'Unknown',
        warning: 'Data truncated due to size limitations',
        original_size: testString.length,
        timestamp: new Date().toISOString()
      };
      return JSON.stringify(essentialData);
    }

    return testString;
  } catch (error) {
    console.error('JSON stringify error:', error);
    // Return a minimal safe object
    return JSON.stringify({
      error: 'Data serialization failed',
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
};

// Enhanced validation and duplicate checking function
const validateAndCheckDuplicates = async (submissionData, masterConn, rowNumber) => {
  try {
    console.log(`🔍 Validating row ${rowNumber} data:`, submissionData);

    // Check for missing critical fields that are required for processing
    const criticalFields = ['student_name']; // Only student name is truly required
    const missingCriticalFields = [];

    criticalFields.forEach(field => {
      if (!submissionData[field] || submissionData[field].trim() === '') {
        missingCriticalFields.push(field);
      }
    });

    if (missingCriticalFields.length > 0) {
      return {
        isValid: false,
        type: 'missing_fields',
        error: `Missing required fields: ${missingCriticalFields.join(', ')}`,
        details: { missingFields: missingCriticalFields }
      };
    }

    // Check for duplicates based on unique identifiers
    const duplicateChecks = [];

    // Check by admission_number if provided
    if (submissionData.admission_number && submissionData.admission_number.trim() !== '') {
      const admissionNumber = submissionData.admission_number.trim();

      // Check in students table (both admission_number and admission_no columns)
      const [existingStudents] = await masterConn.query(
        'SELECT admission_number, admission_no FROM students WHERE admission_number = ? OR admission_no = ?',
        [admissionNumber, admissionNumber]
      );

      if (existingStudents.length > 0) {
        duplicateChecks.push({
          field: 'admission_number',
          value: admissionNumber,
          foundIn: 'students_table',
          existingRecord: existingStudents[0]
        });
      }

      // Also check in form_submissions table
      const { data: existingSubmissions, error } = await supabase
        .from('form_submissions')
        .select('submission_id, admission_number, status')
        .eq('admission_number', admissionNumber);

      if (!error && existingSubmissions && existingSubmissions.length > 0) {
        duplicateChecks.push({
          field: 'admission_number',
          value: admissionNumber,
          foundIn: 'form_submissions_table',
          existingRecord: existingSubmissions[0]
        });
      }
    }

    // Check by AADHAR number if provided
    if (submissionData.adhar_no && submissionData.adhar_no.trim() !== '') {
      const adharNo = submissionData.adhar_no.trim();

      // Check in students table for existing AADHAR
      const [existingByAdhar] = await masterConn.query(
        'SELECT admission_number, admission_no FROM students WHERE adhar_no = ?',
        [adharNo]
      );

      if (existingByAdhar.length > 0) {
        duplicateChecks.push({
          field: 'adhar_no',
          value: adharNo,
          foundIn: 'students_table',
          existingRecord: existingByAdhar[0]
        });
      }
    }

    // Check by Student Mobile Number if provided
    if (submissionData.student_mobile && submissionData.student_mobile.trim() !== '') {
      const studentMobile = submissionData.student_mobile.trim();

      // Check in students table for existing mobile
      const [existingByMobile] = await masterConn.query(
        'SELECT admission_number, admission_no FROM students WHERE student_mobile = ?',
        [studentMobile]
      );

      if (existingByMobile.length > 0) {
        duplicateChecks.push({
          field: 'student_mobile',
          value: studentMobile,
          foundIn: 'students_table',
          existingRecord: existingByMobile[0]
        });
      }
    }

    if (duplicateChecks.length > 0) {
      const duplicateDetails = duplicateChecks.map(check => ({
        field: check.field,
        value: check.value,
        foundIn: check.foundIn,
        existingAdmissionNumber: check.existingRecord.admission_number || check.existingRecord.admission_no
      }));

      return {
        isValid: false,
        type: 'duplicate',
        error: `Duplicate entry found for: ${duplicateChecks.map(d => d.field).join(', ')}`,
        details: { duplicates: duplicateDetails }
      };
    }

    // Data is valid - no critical missing fields and no duplicates
    console.log(`✅ Row ${rowNumber} validation passed`);
    return {
      isValid: true,
      type: 'valid',
      error: null,
      details: null
    };

  } catch (error) {
    console.error(`❌ Error validating row ${rowNumber}:`, error);
    return {
      isValid: false,
      type: 'validation_error',
      error: `Validation error: ${error.message}`,
      details: { error: error.message }
    };
  }
};

// Submit form (public endpoint)
exports.submitForm = async (req, res) => {
  try {
    console.log('Submit form request received');
    console.log('Params:', req.params);
    console.log('Body:', req.body);

    // Handle both URL parameter and body parameter for formId
    const formId = req.params.formId || req.body.formId;
    const { admissionNumber, formData } = req.body;

    console.log('Resolved formId:', formId);

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Form data is required' 
      });
    }

    // Verify form exists and is active - use Supabase instead of masterPool for consistency
    const { data: forms, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('form_id', formId)
      .eq('is_active', true)
      .limit(1);
    if (formErr) throw formErr;

    if (!forms || forms.length === 0) {
      console.log('Form not found or inactive for formId:', formId);
      return res.status(404).json({
        success: false,
        message: 'Form not found or inactive'
      });
    }

    console.log('Form found and active:', forms[0].form_name);

    const submissionId = uuidv4();

    // Insert submission (no admission number initially - admin will assign it)
    const { error: insErr } = await supabase
      .from('form_submissions')
      .insert({
        submission_id: submissionId,
        form_id: formId,
        admission_number: null, // Admin will assign this during approval
        submission_data: formData,
        status: 'pending',
        submitted_by: 'student'
      });
    if (insErr) throw insErr;

    res.status(201).json({
      success: true,
      message: 'Form submitted successfully. Awaiting admin approval.',
      data: {
        submissionId
      }
    });

  } catch (error) {
    console.error('Submit form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting form' 
    });
  }
};

// Get all submissions (admin)
exports.getAllSubmissions = async (req, res) => {
  try {
    const { status, formId } = req.query;

    // Supabase query without relationship joins
    let q = supabase.from('form_submissions').select('*');
    if (status) q = q.eq('status', status);
    if (formId) q = q.eq('form_id', formId);
    const { data: submissions, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;

    // Enrich with form/admin names via separate queries
    const formIds = Array.from(new Set((submissions || []).map(s => s.form_id))).filter(Boolean);
    const reviewedIds = Array.from(new Set((submissions || []).map(s => s.reviewed_by).filter(Boolean)));
    const submittedByAdminIds = Array.from(new Set((submissions || []).map(s => s.submitted_by_admin).filter(Boolean)));

    let idToFormName = new Map();
    if (formIds.length > 0) {
      const { data: formsRows } = await supabase
        .from('forms')
        .select('form_id, form_name')
        .in('form_id', formIds);
      if (formsRows) idToFormName = new Map(formsRows.map(f => [f.form_id, f.form_name]));
    }

    let idToAdmin = new Map();
    if (reviewedIds.length > 0) {
      const { data: adminsRows } = await supabase
        .from('admins')
        .select('id, username')
        .in('id', reviewedIds);
      if (adminsRows) idToAdmin = new Map(adminsRows.map(a => [a.id, a.username]));
    }

    let idToSubmittedAdmin = new Map();
    if (submittedByAdminIds.length > 0) {
      const { data: adminsRows2 } = await supabase
        .from('admins')
        .select('id, username')
        .in('id', submittedByAdminIds);
      if (adminsRows2) idToSubmittedAdmin = new Map(adminsRows2.map(a => [a.id, a.username]));
    }

    const enriched = (submissions || []).map(sub => ({
      ...sub,
      submission_data: parseJSON(sub.submission_data),
      form_name: idToFormName.get(sub.form_id) || null,
      reviewed_by_name: sub.reviewed_by ? (idToAdmin.get(sub.reviewed_by) || null) : null,
      submitted_by_admin_name: sub.submitted_by_admin ? (idToSubmittedAdmin.get(sub.submitted_by_admin) || null) : null
    }));

    res.json({ success: true, data: enriched });

  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching submissions' 
    });
  }
};

// Get single submission
exports.getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;

    console.log('Fetching submission:', submissionId);

    const { data: submissions, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .limit(1);
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (submissions.length === 0) {
      console.log('Submission not found:', submissionId);
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    console.log('Found submission:', submissions[0].submission_id);

    const base = submissions[0];
    let formName = null;
    let formFields = null;
    const { data: formRows } = await supabase
      .from('forms')
      .select('form_name, form_fields')
      .eq('form_id', base.form_id)
      .limit(1);
    if (formRows && formRows.length > 0) {
      formName = formRows[0].form_name || null;
      formFields = parseJSON(formRows[0].form_fields);
    }

    const submission = {
      ...base,
      form_name: formName,
      submission_data: parseJSON(base.submission_data),
      form_fields: formFields
    };

    res.json({ success: true, data: submission });

  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching submission' 
    });
  }
};

// Approve submission
exports.approveSubmission = async (req, res) => {
  let masterConn = null;

  try {
    masterConn = await masterPool.getConnection();
    await masterConn.beginTransaction();

    const { submissionId } = req.params;
    const { admissionNumber } = req.body; // Get admission number from request body

    console.log('Approve submission request:', { submissionId, admissionNumber });
    console.log('Request body:', req.body);

    // Validate admission number
    if (!admissionNumber || typeof admissionNumber !== 'string' || !admissionNumber.trim()) {
      await masterConn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid admission number is required'
      });
    }

    // Get submission
    const { data: submissions, error: subErr } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .eq('status', 'pending')
      .limit(1);
    if (subErr) {
      console.error('Supabase error fetching submission:', subErr);
      throw subErr;
    }

    if (submissions.length === 0) {
      await masterConn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pending submission not found'
      });
    }

    const submission = submissions[0];
    const submissionData = parseJSON(submission.submission_data);

    // Use the admission number from the request body (admin input)
    const finalAdmissionNumber = admissionNumber.trim();

    console.log('Final admission number:', finalAdmissionNumber);

    // Separate predefined and custom fields
    const predefinedFields = {};
    const predefinedKeys = [
      'pin_no', 'batch', 'branch', 'stud_type', 'student_name', 'student_status',
      'scholar_status', 'student_mobile', 'parent_mobile1', 'parent_mobile2',
      'caste', 'gender', 'father_name', 'dob', 'adhar_no', 'admission_date',
      'admission_no', 'student_address', 'city_village', 'mandal_name', 'district',
      'previous_college', 'certificates_status', 'student_photo', 'remarks'
    ];

    Object.entries(submissionData).forEach(([key, value]) => {
      if (predefinedKeys.includes(key)) {
        predefinedFields[key] = value;
      }
    });

    // Load form to determine dynamic table/columns in master DB
    const [forms] = await masterConn.query('SELECT * FROM forms WHERE form_id = ?', [submission.form_id]);
    const formFields = forms.length > 0 ? parseJSON(forms[0].form_fields) : [];

    // Determine destination table in master DB: single table per form, named by form_id
    const destinationTable = `form_${submission.form_id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    // Build DDL to ensure destination table exists with columns from formFields
    // Start with base columns
    await masterConn.query(
      `CREATE TABLE IF NOT EXISTS ${destinationTable} (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admission_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    // Ensure columns for each field key exist (use VARCHAR(255) default; widen if needed later)
    for (const field of formFields) {
      const col = field.key?.replace(/[^a-zA-Z0-9_]/g, '_');
      if (!col) continue;
      await masterConn.query(
        `ALTER TABLE ${destinationTable} ADD COLUMN IF NOT EXISTS ${col} VARCHAR(1024) NULL`
      );
    }

    // Prepare insert columns/values for dynamic table
    const insertCols = ['admission_number'];
    const insertVals = [finalAdmissionNumber];
    const placeholders = ['?'];

    for (const field of formFields) {
      const key = field.key;
      const col = key?.replace(/[^a-zA-Z0-9_]/g, '_');
      if (!col) continue;
      insertCols.push(col);
      insertVals.push(submissionData[key] ?? null);
      placeholders.push('?');
    }

    await masterConn.query(
      `INSERT INTO ${destinationTable} (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`,
      insertVals
    );

    // Check if student exists (check both admission_number and admission_no columns)
    const [students] = await masterConn.query(
      'SELECT * FROM students WHERE admission_number = ? OR admission_no = ?',
      [finalAdmissionNumber, finalAdmissionNumber]
    );

    if (students.length > 0) {
      // Update existing student - use both individual columns and JSON data
      const existingStudent = students[0];
      const existingData = parseJSON(existingStudent.student_data) || {};

      // Create merged data with database column mapping
      const mergedData = { ...existingData };

      // Map submission data to database columns based on form field keys
      Object.entries(submissionData).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          mergedData[key] = value;
        }
      });

      // Add form_id to mergedData for completion percentage calculation
      mergedData.form_id = submission.form_id;
      console.log(`📋 Added form_id to mergedData: ${submission.form_id}`);

      // Update both individual columns and JSON data with proper field mapping
      const updateFields = [];
      const updateValues = [];
      const addedUpdateFields = new Set();

      // Update individual columns for predefined fields with proper ordering (avoid duplicates)
      Object.entries(submissionData).forEach(([key, value]) => {
        if (predefinedKeys.includes(key) && value !== undefined && value !== '' && !addedUpdateFields.has(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
          addedUpdateFields.add(key);
        }
      });

      // Handle JSON data update with helper function (avoid duplicates)
      if (!addedUpdateFields.has('student_data')) {
        const jsonMergedData = safeJSONStringify(mergedData);
        updateFields.push('student_data = ?');
        updateValues.push(jsonMergedData);
      }

      updateValues.push(finalAdmissionNumber); // WHERE clause value

      // Check for duplicates in update fields
      const uniqueUpdateFields = [...new Set(updateFields.map(f => f.split(' = ')[0]))];
      if (uniqueUpdateFields.length !== updateFields.length) {
        console.error('❌ DUPLICATE UPDATE FIELDS DETECTED!');
        console.error('Original fields:', updateFields);
        console.error('Unique fields:', uniqueUpdateFields);
        throw new Error('Duplicate fields detected in update query');
      }

      console.log('🔍 Debug - Update Field-Value Mapping:');
      updateFields.forEach((field, index) => {
        console.log(`  ${index}: ${field} = "${updateValues[index]}"`);
      });
      console.log(`  WHERE: admission_number = ? OR admission_no = ? (value: "${finalAdmissionNumber}")`);

      await masterConn.query(
        `UPDATE students SET ${updateFields.join(', ')} WHERE admission_number = ? OR admission_no = ?`,
        [...updateValues, finalAdmissionNumber, finalAdmissionNumber]
      );
    } else {
      // Create new student with proper database column mapping
      const studentData = {};
      const fieldValuePairs = [];

      // Use a Set to track added fields and prevent duplicates
      const addedFields = new Set();

      // Add base fields (admission_number and admission_no) - prevent duplicates
      fieldValuePairs.push({ field: 'admission_number', value: finalAdmissionNumber });
      addedFields.add('admission_number');

      fieldValuePairs.push({ field: 'admission_no', value: finalAdmissionNumber });
      addedFields.add('admission_no');

      // Add admission_no field if provided in submission data (avoid duplicates)
      if (submissionData.admission_no && !addedFields.has('admission_no')) {
        fieldValuePairs.push({ field: 'admission_no', value: submissionData.admission_no });
        addedFields.add('admission_no');
      }

      // Map submission data to database columns based on form field keys
      Object.entries(submissionData).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          // Sanitize the value to ensure it's JSON serializable
          let sanitizedValue = value;
          if (typeof value === 'string') {
            sanitizedValue = value.trim();
          }

          studentData[key] = sanitizedValue;

          // Add to individual columns if it's a predefined field (avoid duplicates)
          if (predefinedKeys.includes(key) && !addedFields.has(key)) {
            fieldValuePairs.push({ field: key, value: sanitizedValue });
            addedFields.add(key);
          }
        }
      });

      // Add form_id to studentData for completion percentage calculation
      studentData.form_id = submission.form_id;
      console.log(`📋 Added form_id to studentData: ${submission.form_id}`);

      // Handle JSON data with helper function (avoid duplicates)
      if (!addedFields.has('student_data')) {
        const jsonStudentData = safeJSONStringify(studentData);
        fieldValuePairs.push({ field: 'student_data', value: jsonStudentData });
        addedFields.add('student_data');
      }

      // Extract ordered fields and values
      const insertFields = fieldValuePairs.map(pair => pair.field);
      const insertValues = fieldValuePairs.map(pair => pair.value);

      // Check for duplicates in the final fields array
      const uniqueFields = [...new Set(insertFields)];
      if (uniqueFields.length !== insertFields.length) {
        console.error('❌ DUPLICATE FIELDS DETECTED!');
        console.error('Original fields:', insertFields);
        console.error('Unique fields:', uniqueFields);
        throw new Error('Duplicate fields detected in insert query');
      }

      console.log('🔍 Debug - Field-Value Mapping:');
      fieldValuePairs.forEach((pair, index) => {
        console.log(`  ${index}: ${pair.field} = "${pair.value}"`);
      });

      console.log('Final insert query prepared:', {
        fieldsCount: insertFields.length,
        valuesCount: insertValues.length,
        orderedFields: insertFields,
        uniqueFields: uniqueFields.length === insertFields.length ? '✅ No duplicates' : '❌ Has duplicates',
        jsonSize: fieldValuePairs.find(p => p.field === 'student_data')?.value?.length || 0
      });

      // Execute insert with error handling
      try {
        const placeholders = insertFields.map(() => '?').join(', ');
        const query = `INSERT INTO students (${insertFields.join(', ')}) VALUES (${placeholders})`;
        console.log('Executing insert query, JSON size:', fieldValuePairs.find(p => p.field === 'student_data')?.value?.length || 0);
        console.log('SQL Query:', query);
        console.log('Values:', insertValues.length, 'items');

        await masterConn.query(query, insertValues);
        console.log('✅ Student data inserted successfully');
      } catch (insertError) {
        console.error('❌ Insert error:', insertError.message);
        console.error('❌ SQL query was:', `INSERT INTO students (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`);
        console.error('❌ Values count:', insertValues.length);
        console.error('❌ Field-value mapping:', fieldValuePairs);
        console.error('❌ Added fields Set:', Array.from(addedFields));
        throw insertError;
      }
    }

    // Update submission status
    const { error: updErr } = await supabase
      .from('form_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: req.admin.id, admission_number: finalAdmissionNumber })
      .eq('submission_id', submissionId);
    if (updErr) throw updErr;

    // Log action
    await masterConn.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['APPROVE', 'SUBMISSION', submissionId, req.admin.id, JSON.stringify({ admissionNumber: finalAdmissionNumber })]
    );

    await masterConn.commit();

    res.json({
      success: true,
      message: 'Submission approved and data saved to database'
    });

  } catch (error) {
    await masterConn.rollback();
    console.error('Approve submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while approving submission' 
    });
  } finally {
    masterConn.release();
  }
};

// Reject submission
exports.rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from('form_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: req.admin.id, rejection_reason: reason || 'No reason provided' })
      .eq('submission_id', submissionId)
      .eq('status', 'pending')
      .select('submission_id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pending submission not found' 
      });
    }

    // Log action
    const masterConn2 = await masterPool.getConnection();
    await masterConn2.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['REJECT', 'SUBMISSION', submissionId, req.admin.id, JSON.stringify({ reason })]
    );
    masterConn2.release();

    res.json({
      success: true,
      message: 'Submission rejected'
    });

  } catch (error) {
    console.error('Reject submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while rejecting submission' 
    });
  }
};

// Delete submission
exports.deleteSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const { data, error } = await supabase
      .from('form_submissions')
      .delete()
      .eq('submission_id', submissionId)
      .select('submission_id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }

    // Log action
    const masterConn3 = await masterPool.getConnection();
    await masterConn3.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id)
       VALUES (?, ?, ?, ?)`,
      ['DELETE', 'SUBMISSION', submissionId, req.admin.id]
    );
    masterConn3.release();

    res.json({
      success: true,
      message: 'Submission deleted successfully'
    });

  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting submission' 
    });
  }
};

// Enhanced bulk upload submissions (admin only) with duplicate checking and missing field handling
exports.bulkUploadSubmissions = async (req, res) => {
  let masterConn = null;

  try {
    console.log('🚀 Enhanced bulk upload request received');
    console.log('📁 Request file:', req.file ? {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    console.log('📋 Request body keys:', Object.keys(req.body));
    console.log('📋 Request body:', req.body);
    console.log('👤 Admin ID:', req.admin?.id);

    if (!req.file) {
      console.log('❌ No file received - multer did not parse the file');
      return res.status(400).json({
        success: false,
        message: 'CSV file is required - file was not received by server'
      });
    }

    const formId = req.body.formId;
    console.log('📝 Form ID from body:', formId);

    if (!formId) {
      return res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
    }

    // Verify form exists
    const { data: forms, error } = await supabase
      .from('forms')
      .select('*')
      .eq('form_id', formId)
      .limit(1);
    if (error) throw error;

    if (forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    const form = forms[0];
    const formFields = parseJSON(form.form_fields);

    // Parse CSV file
    const results = [];
    const errors = [];
    let rowNumber = 0;

    console.log('📄 Starting CSV parsing for file:', req.file.path);

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          console.log(`📊 Parsed row ${rowNumber}:`, data);
          results.push({ row: rowNumber, data });
        })
        .on('end', () => {
          console.log(`✅ CSV parsing completed. Total rows: ${results.length}`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ CSV parsing error:', error);
          reject(error);
        });
    });

    // Initialize counters for enhanced tracking
    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    let missingFieldCount = 0;
    const processedRows = [];
    const duplicateDetails = [];

    // Get database connection for duplicate checking
    masterConn = await masterPool.getConnection();

    for (const result of results) {
      try {
        const { row, data } = result;

        console.log(`🔄 Processing row ${row} with data keys:`, Object.keys(data));

        // Build submission data from CSV row, mapping screenshot field names to form field keys
        const submissionData = {};

        // Define field mapping from screenshot CSV headers to form field keys
        const fieldMapping = {
          'admission_number': 'admission_number',
          'Pin No': 'pin_no',
          'Batch': 'batch',
          'Branch': 'branch',
          'StudType': 'stud_type',
          'Student Name': 'student_name',
          'Student Status': 'student_status',
          'Scholar Status': 'scholar_status',
          'Student Mobile Number': 'student_mobile',
          'Parent Mobile Number 1': 'parent_mobile1',
          'Parent Mobile Number 2': 'parent_mobile2',
          'Caste': 'caste',
          'M/F': 'gender',
          'DOB (Date-Month-Year)': 'dob',
          'Father Name': 'father_name',
          'Admission Year (Ex: 09-Sep-2003)': 'admission_date',
          'AADHAR No': 'adhar_no',
          'Admission No': 'admission_no',
          'Student Address': 'student_address',
          'CityVillage Name': 'city_village',
          'Mandal Name': 'mandal_name',
          'District Name': 'district',
          'Previous College Name': 'previous_college',
          'Certificate Status': 'certificates_status',
          'Student Photo': 'student_photo',
          'Remarks': 'remarks'
        };

        // Map CSV data using the field mapping - handle missing fields gracefully
        Object.entries(fieldMapping).forEach(([csvHeader, fieldKey]) => {
          if (data[csvHeader] !== undefined) {
            // Allow empty strings but preserve them for optional fields
            submissionData[fieldKey] = data[csvHeader];
          }
        });

        console.log(`📝 Final submission data for row ${row}:`, submissionData);

        // Enhanced validation and duplicate checking
        const validationResult = await validateAndCheckDuplicates(submissionData, masterConn, row);

        if (!validationResult.isValid) {
          errors.push({
            row,
            message: validationResult.error,
            type: validationResult.type,
            details: validationResult.details
          });

          if (validationResult.type === 'duplicate') {
            duplicateCount++;
          } else if (validationResult.type === 'missing_fields') {
            missingFieldCount++;
          }

          failedCount++;
          processedRows.push({
            row,
            status: 'failed',
            reason: validationResult.error,
            type: validationResult.type
          });
          continue;
        }

        const submissionId = uuidv4();

        // Insert submission with admin tracking
        console.log(`💾 Inserting submission ${submissionId} for admission ${submissionData.admission_number}`);
        await supabase
          .from('form_submissions')
          .insert({
            submission_id: submissionId,
            form_id: formId,
            admission_number: submissionData.admission_number,
            submission_data: submissionData,
            status: 'pending',
            submitted_by: 'admin',
            submitted_by_admin: req.admin.id
          });

        successCount++;
        processedRows.push({
          row,
          status: 'success',
          submissionId,
          admissionNumber: submissionData.admission_number
        });

      } catch (error) {
        console.error(`❌ Error processing row ${result.row}:`, error);
        errors.push({
          row: result.row,
          message: error.message,
          type: 'processing_error'
        });
        failedCount++;
        processedRows.push({
          row: result.row,
          status: 'failed',
          reason: error.message,
          type: 'processing_error'
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Enhanced logging with detailed statistics
    const masterConn4 = await masterPool.getConnection();
    await masterConn4.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['ENHANCED_BULK_UPLOAD', 'SUBMISSION', formId, req.admin.id,
       JSON.stringify({
         successCount,
         failedCount,
         duplicateCount,
         missingFieldCount,
         totalRows: results.length,
         processedRows: processedRows.length
       })]
    );
    masterConn4.release();

    console.log(`✅ Enhanced bulk upload completed: ${successCount} success, ${failedCount} failed, ${duplicateCount} duplicates, ${missingFieldCount} missing fields`);

    res.json({
      success: true,
      message: `Enhanced bulk upload completed. ${successCount} submissions created, ${failedCount} failed.`,
      successCount,
      failedCount,
      duplicateCount,
      missingFieldCount,
      totalRows: results.length,
      errors: errors.slice(0, 50), // Increased error limit for better debugging
      processedRows: processedRows.slice(0, 100) // Include processing details
    });

  } catch (error) {
    console.error('Enhanced bulk upload error:', error);

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Server error during enhanced bulk upload',
      error: error.message
    });
  } finally {
    if (masterConn) {
      masterConn.release();
    }
  }
};

// Generate admission number series
exports.generateAdmissionSeries = async (req, res) => {
  try {
    const { prefix = 'ADM', count = 10, autoAssign = false } = req.body;

    if (!prefix || typeof prefix !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Prefix is required'
      });
    }

    const admissionNumbers = [];
    for (let i = 0; i < count; i++) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      admissionNumbers.push(`${prefix}_${timestamp}_${random}`);
    }

    // If autoAssign is true, assign these numbers to pending submissions
    if (autoAssign && admissionNumbers.length > 0) {
      try {
        // Get pending submissions that don't have admission numbers
        const { data: pendingSubmissions, error } = await supabase
          .from('form_submissions')
          .select('submission_id')
          .eq('status', 'pending')
          .or('admission_number.is.null,admission_number.eq.')
          .order('created_at', { ascending: true })
          .limit(count);

        if (error) {
          console.error('Error fetching pending submissions:', error);
        } else if (pendingSubmissions && pendingSubmissions.length > 0) {
          // Update pending submissions with generated admission numbers
          const updates = pendingSubmissions.map((submission, index) => ({
            submission_id: submission.submission_id,
            admission_number: admissionNumbers[index] || null
          })).filter(update => update.admission_number);

          if (updates.length > 0) {
            // Use batch update for better performance
            for (const update of updates) {
              const { error: updateError } = await supabase
                .from('form_submissions')
                .update({
                  admission_number: update.admission_number,
                  updated_at: new Date().toISOString()
                })
                .eq('submission_id', update.submission_id);

              if (updateError) {
                console.error(`Error updating submission ${update.submission_id}:`, updateError);
              }
            }

            console.log(`Auto-assigned ${updates.length} admission numbers to pending submissions`);
          } else {
            console.log('No pending submissions available for auto-assignment');
          }
        } else {
          console.log('No pending submissions found for auto-assignment');
        }
      } catch (assignError) {
        console.error('Error auto-assigning admission numbers:', assignError);
        // Don't fail the request if auto-assignment fails
      }
    }

    res.json({
      success: true,
      data: {
        admissionNumbers,
        prefix,
        autoAssigned: autoAssign ? admissionNumbers.length : 0
      }
    });

  } catch (error) {
    console.error('Generate admission series error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating admission series'
    });
  }
};

// Get field completion status for a submission
exports.getFieldCompletionStatus = async (req, res) => {
  try {
    const { submissionId } = req.params;

    // Get submission with form details
    const { data: submissions, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .limit(1);

    if (error) throw error;
    if (submissions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    const submission = submissions[0];
    const submissionData = parseJSON(submission.submission_data);

    // Get form fields
    const { data: forms, error: formErr } = await supabase
      .from('forms')
      .select('form_fields')
      .eq('form_id', submission.form_id)
      .limit(1);

    if (formErr) throw formErr;
    if (forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    const formFields = parseJSON(forms[0].form_fields);

    // Include both visible and hidden fields for completion calculation
    // Hidden fields should also count towards completion if they have values
    const allFields = formFields.filter(field => field.key); // Filter out any malformed fields

    // Calculate completion status considering all fields (visible + hidden)
    const totalFields = allFields.length;
    const completedFields = allFields.filter(field => {
      const value = submissionData[field.key];
      return value !== undefined && value !== null && value !== '';
    }).length;

    const fieldStatus = allFields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type || 'text',
      completed: submissionData[field.key] !== undefined && submissionData[field.key] !== null && submissionData[field.key] !== '',
      value: submissionData[field.key] || null,
      required: field.required || false,
      isHidden: field.isHidden || false
    }));

    res.json({
      success: true,
      data: {
        totalFields,
        completedFields,
        pendingFields: totalFields - completedFields,
        completionPercentage: totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0,
        fieldStatus
      }
    });

  } catch (error) {
    console.error('Get field completion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching field completion status'
    });
  }
};

// Get student completion status based on form structure
exports.getStudentCompletionStatus = async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    // Get student data
    const [students] = await masterPool.query(
      'SELECT * FROM students WHERE admission_number = ? OR admission_no = ?',
      [admissionNumber, admissionNumber]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = students[0];

    // We need to find which form this student came from
    // Check if student data contains form_id or look it up from submissions
    let formId = null;

    // First try to get form_id from the student_data JSON
    if (student.student_data) {
      try {
        const studentData = parseJSON(student.student_data);
        formId = studentData.form_id;
      } catch (error) {
        console.log('Could not parse student_data JSON for form_id');
      }
    }

    // If not found in JSON, look it up from submissions
    if (!formId) {
      const { data: submissions, error } = await supabase
        .from('form_submissions')
        .select('form_id')
        .eq('admission_number', admissionNumber)
        .limit(1);

      if (!error && submissions && submissions.length > 0) {
        formId = submissions[0].form_id;
      }
    }

    if (!formId) {
      return res.status(404).json({
        success: false,
        message: 'Could not determine form structure for this student'
      });
    }

    // Get form fields
    const { data: forms, error: formErr } = await supabase
      .from('forms')
      .select('form_fields, form_name')
      .eq('form_id', formId)
      .limit(1);

    if (formErr) throw formErr;
    if (forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    const formFields = parseJSON(forms[0].form_fields);
    const formName = forms[0].form_name;

    // Include both visible and hidden fields for completion calculation
    const allFields = formFields.filter(field => field.key);

    console.log(`🔍 Calculating completion for student ${admissionNumber}:`);
    console.log(`   Total form fields: ${allFields.length}`);
    console.log(`   Form ID: ${formId}`);

    // Calculate completion status considering all fields from the original form
    const totalFields = allFields.length;
    let completedFields = 0;

    const fieldStatus = allFields.map(field => {
      const key = field.key;

      // Check if the field exists in the student record (individual columns take precedence)
      let value = null;
      let completed = false;

      // First check individual database columns
      if (student[key] !== undefined && student[key] !== null && student[key] !== '') {
        value = student[key];
        completed = true;
        completedFields++;
        console.log(`   ✅ ${key}: Found in database column = "${value}"`);
      }
      // Then check student_data JSON as fallback
      else if (student.student_data) {
        try {
          const studentData = parseJSON(student.student_data);
          if (studentData && studentData[key] !== undefined && studentData[key] !== null && studentData[key] !== '') {
            value = studentData[key];
            completed = true;
            completedFields++;
            console.log(`   ✅ ${key}: Found in JSON data = "${value}"`);
          } else {
            console.log(`   ❌ ${key}: Not found or empty`);
          }
        } catch (error) {
          console.log(`   ❌ ${key}: JSON parse error`);
        }
      } else {
        console.log(`   ❌ ${key}: No data available`);
      }

      return {
        key: field.key,
        label: field.label,
        type: field.type || 'text',
        completed: completed,
        value: value,
        required: field.required || false,
        isHidden: field.isHidden || false
      };
    });

    const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

    console.log(`📊 Completion calculation: ${completedFields}/${totalFields} = ${completionPercentage}%`);

    res.json({
      success: true,
      data: {
        totalFields,
        completedFields,
        pendingFields: totalFields - completedFields,
        completionPercentage,
        fieldStatus,
        formName,
        debugInfo: {
          admissionNumber,
          formId,
          dataSource: 'Database columns + JSON fallback'
        }
      }
    });

  } catch (error) {
    console.error('Get student completion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student completion status'
    });
  }
};

// Export multer middleware
exports.uploadMiddleware = upload.single('file');
