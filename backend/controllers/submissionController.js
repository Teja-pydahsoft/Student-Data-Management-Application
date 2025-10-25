const { masterPool } = require('../config/database');
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
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

// Comprehensive logging utility for bulk upload operations
const logBulkUploadEvent = (level, event, data, timestamp = new Date().toISOString()) => {
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    event,
    ...data
  };

  const formattedLog = JSON.stringify(logEntry, null, 2);
  console.log(`[${level.toUpperCase()}] ${event}: ${formattedLog}`);
  return logEntry;
};

// Detailed row data logging utility
const logRowData = (rowNumber, rowData, fieldMapping) => {
  const extractedData = {};
  const missingFields = [];
  const presentFields = [];

  // Check each expected field
  Object.entries(fieldMapping).forEach(([csvHeader, fieldKey]) => {
    const value = rowData[csvHeader];
    if (value !== undefined && value !== null && value !== '') {
      extractedData[fieldKey] = value;
      presentFields.push(fieldKey);
    } else {
      missingFields.push(fieldKey);
    }
  });

  const logData = {
    rowNumber,
    totalFields: Object.keys(fieldMapping).length,
    presentFields: presentFields.length,
    missingFields: missingFields.length,
    presentFieldsList: presentFields,
    missingFieldsList: missingFields,
    extractedData,
    rawRowData: rowData
  };

  logBulkUploadEvent('info', 'ROW_DATA_EXTRACTED', logData);
  return logData;
};

// Error logging utility with context
const logBulkUploadError = (rowNumber, errorType, errorMessage, contextData = {}) => {
  const errorData = {
    rowNumber,
    errorType,
    errorMessage,
    context: contextData,
    stackTrace: new Error().stack
  };

  logBulkUploadEvent('error', 'BULK_UPLOAD_ERROR', errorData);
  return errorData;
};

// Performance logging utility
const logPerformanceMetrics = (operation, startTime, endTime, additionalMetrics = {}) => {
  const duration = endTime - startTime;
  const metricsData = {
    operation,
    startTime,
    endTime,
    duration: `${duration}ms`,
    durationSeconds: (duration / 1000).toFixed(2),
    ...additionalMetrics
  };

  logBulkUploadEvent('info', 'PERFORMANCE_METRICS', metricsData);
  return metricsData;
};

// Enhanced validation and duplicate checking function with comprehensive logging
const validateAndCheckDuplicates = async (submissionData, masterConn, rowNumber) => {
  const validationStartTime = Date.now();

  try {
    logBulkUploadEvent('info', 'VALIDATION_STARTED', {
      rowNumber,
      submissionData: submissionData,
      fieldCount: Object.keys(submissionData).length,
      availableFields: Object.keys(submissionData)
    });

    // Check for missing critical fields that are required for processing
    const criticalFields = ['student_name']; // Only student name is truly required
    const missingCriticalFields = [];

    criticalFields.forEach(field => {
      const value = submissionData[field];
      if (!value || String(value).trim() === '') {
        missingCriticalFields.push(field);
      }
    });

    if (missingCriticalFields.length > 0) {
      const validationTime = Date.now() - validationStartTime;
      logBulkUploadEvent('warn', 'CRITICAL_FIELDS_MISSING', {
        rowNumber,
        missingFields: missingCriticalFields,
        validationTime: `${validationTime}ms`
      });

      return {
        isValid: false,
        type: 'missing_fields',
        error: `Missing required fields: ${missingCriticalFields.join(', ')}`,
        details: { missingFields: missingCriticalFields },
        validationTime: `${validationTime}ms`
      };
    }

    // Check for duplicates based on unique identifiers with detailed logging
    const duplicateChecks = [];
    const duplicateCheckStartTime = Date.now();

    logBulkUploadEvent('info', 'DUPLICATE_CHECK_STARTED', {
      rowNumber,
      checkingFields: ['admission_number', 'adhar_no', 'student_mobile'],
      submissionData: submissionData
    });

    // Check by admission_number if provided
    if (submissionData.admission_number && String(submissionData.admission_number).trim() !== '') {
      const admissionNumber = String(submissionData.admission_number).trim();
      const admissionCheckStart = Date.now();

      // Check in students table (both admission_number and admission_no columns)
      const [existingStudents] = await masterConn.query(
        'SELECT admission_number, admission_no FROM students WHERE admission_number = ? OR admission_no = ?',
        [admissionNumber, admissionNumber]
      );

      const admissionCheckTime = Date.now() - admissionCheckStart;
      logBulkUploadEvent('info', 'ADMISSION_CHECK_COMPLETED', {
        rowNumber,
        admissionNumber,
        checkTime: `${admissionCheckTime}ms`,
        foundInStudents: existingStudents.length,
        studentsTableResult: existingStudents.length > 0 ? existingStudents[0] : null
      });

      if (existingStudents.length > 0) {
        duplicateChecks.push({
          field: 'admission_number',
          value: admissionNumber,
          foundIn: 'students_table',
          existingRecord: existingStudents[0]
        });

        logBulkUploadEvent('warn', 'DUPLICATE_FOUND_STUDENTS', {
          rowNumber,
          admissionNumber,
          existingRecord: existingStudents[0]
        });
      }

      // Also check in form_submissions table
      const submissionCheckStart = Date.now();
      const { data: existingSubmissions, error } = await supabase
        .from('form_submissions')
        .select('submission_id, admission_number, status')
        .eq('admission_number', admissionNumber);

      const submissionCheckTime = Date.now() - submissionCheckStart;
      logBulkUploadEvent('info', 'SUBMISSION_CHECK_COMPLETED', {
        rowNumber,
        admissionNumber,
        checkTime: `${submissionCheckTime}ms`,
        foundInSubmissions: existingSubmissions ? existingSubmissions.length : 0,
        submissionsTableResult: existingSubmissions && existingSubmissions.length > 0 ? existingSubmissions[0] : null
      });

      if (!error && existingSubmissions && existingSubmissions.length > 0) {
        duplicateChecks.push({
          field: 'admission_number',
          value: admissionNumber,
          foundIn: 'form_submissions_table',
          existingRecord: existingSubmissions[0]
        });

        logBulkUploadEvent('warn', 'DUPLICATE_FOUND_SUBMISSIONS', {
          rowNumber,
          admissionNumber,
          existingRecord: existingSubmissions[0]
        });
      }
    }

    // Check by AADHAR number if provided
    if (submissionData.adhar_no && submissionData.adhar_no !== '') {
      // Convert to string and trim safely
      const adharNo = String(submissionData.adhar_no).trim();
      const adharCheckStart = Date.now();

      // Check in students table for existing AADHAR
      const [existingByAdhar] = await masterConn.query(
        'SELECT admission_number, admission_no FROM students WHERE adhar_no = ?',
        [adharNo]
      );

      const adharCheckTime = Date.now() - adharCheckStart;
      logBulkUploadEvent('info', 'ADHAR_CHECK_COMPLETED', {
        rowNumber,
        adharNo,
        checkTime: `${adharCheckTime}ms`,
        foundInStudents: existingByAdhar.length,
        studentsTableResult: existingByAdhar.length > 0 ? existingByAdhar[0] : null
      });

      if (existingByAdhar.length > 0) {
        duplicateChecks.push({
          field: 'adhar_no',
          value: adharNo,
          foundIn: 'students_table',
          existingRecord: existingByAdhar[0]
        });

        logBulkUploadEvent('warn', 'DUPLICATE_FOUND_ADHAR', {
          rowNumber,
          adharNo,
          existingRecord: existingByAdhar[0]
        });
      }
    }

    // Check by Student Mobile Number if provided
    if (submissionData.student_mobile && String(submissionData.student_mobile).trim() !== '') {
      const studentMobile = String(submissionData.student_mobile).trim();
      const mobileCheckStart = Date.now();

      // Check in students table for existing mobile
      const [existingByMobile] = await masterConn.query(
        'SELECT admission_number, admission_no FROM students WHERE student_mobile = ?',
        [studentMobile]
      );

      const mobileCheckTime = Date.now() - mobileCheckStart;
      logBulkUploadEvent('info', 'MOBILE_CHECK_COMPLETED', {
        rowNumber,
        studentMobile,
        checkTime: `${mobileCheckTime}ms`,
        foundInStudents: existingByMobile.length,
        studentsTableResult: existingByMobile.length > 0 ? existingByMobile[0] : null
      });

      if (existingByMobile.length > 0) {
        duplicateChecks.push({
          field: 'student_mobile',
          value: studentMobile,
          foundIn: 'students_table',
          existingRecord: existingByMobile[0]
        });

        logBulkUploadEvent('warn', 'DUPLICATE_FOUND_MOBILE', {
          rowNumber,
          studentMobile,
          existingRecord: existingByMobile[0]
        });
      }
    }

    const duplicateCheckTime = Date.now() - duplicateCheckStartTime;
    logBulkUploadEvent('info', 'DUPLICATE_CHECK_COMPLETED', {
      rowNumber,
      totalDuplicateChecks: duplicateChecks.length,
      duplicateCheckTime: `${duplicateCheckTime}ms`,
      checkedFields: ['admission_number', 'adhar_no', 'student_mobile']
    });

    if (duplicateChecks.length > 0) {
      const duplicateDetails = duplicateChecks.map(check => ({
        field: check.field,
        value: check.value,
        foundIn: check.foundIn,
        existingAdmissionNumber: check.existingRecord.admission_number || check.existingRecord.admission_no
      }));

      logBulkUploadEvent('error', 'VALIDATION_FAILED_DUPLICATES', {
        rowNumber,
        duplicateCount: duplicateChecks.length,
        duplicates: duplicateDetails,
        validationTime: `${Date.now() - validationStartTime}ms`
      });

      return {
        isValid: false,
        type: 'duplicate',
        error: `Duplicate entry found for: ${duplicateChecks.map(d => d.field).join(', ')}`,
        details: { duplicates: duplicateDetails },
        validationTime: `${Date.now() - validationStartTime}ms`
      };
    }

    // Data is valid - no critical missing fields and no duplicates
    const totalValidationTime = Date.now() - validationStartTime;
    logBulkUploadEvent('info', 'VALIDATION_PASSED', {
      rowNumber,
      totalValidationTime: `${totalValidationTime}ms`,
      validationBreakdown: {
        criticalFieldsCheck: 'passed',
        duplicateChecks: 'passed',
        totalChecks: 1 + duplicateChecks.length
      }
    });

    console.log(`✅ Row ${rowNumber} validation passed in ${totalValidationTime}ms`);
    return {
      isValid: true,
      type: 'valid',
      error: null,
      details: null,
      validationTime: `${totalValidationTime}ms`
    };

  } catch (error) {
    const totalValidationTime = Date.now() - validationStartTime;

    logBulkUploadError(rowNumber, 'VALIDATION_EXCEPTION', error.message, {
      errorStack: error.stack,
      validationTime: `${totalValidationTime}ms`,
      submissionData: submissionData
    });

    console.error(`❌ Error validating row ${rowNumber} after ${totalValidationTime}ms:`, error);
    return {
      isValid: false,
      type: 'validation_error',
      error: `Validation error: ${error.message}`,
      details: { error: error.message, stack: error.stack },
      validationTime: `${totalValidationTime}ms`
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
    const formData = req.body.formData || req.body;

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        let base64;
        if (file.buffer) {
          base64 = file.buffer.toString('base64');
        } else if (file.path) {
          base64 = fs.readFileSync(file.path, 'base64');
          fs.unlinkSync(file.path); // Clean up temp file
        }
        if (base64) {
          formData[file.fieldname] = `data:${file.mimetype};base64,${base64}`;
        }
      });
    }

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

    // Check if auto-assign is enabled
    let generatedAdmissionNumber = null;
    try {
      const { data: setting, error: setErr } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'auto_assign_series')
        .single();

      if (!setErr && setting && setting.value === 'true') {
        // Generate next sequential number
        // Get current prefix from settings
        const { data: prefixSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'admission_prefix')
          .single();

        const prefix = prefixSetting ? prefixSetting.value : 'PYDAH2025';
        const { data: submissions, error: subErr } = await supabase
          .from('form_submissions')
          .select('admission_number')
          .like('admission_number', `${prefix}_%`);

        if (subErr) throw subErr;

        // Query students from MySQL
        const masterConn2 = await masterPool.getConnection();
        const [studentRows2] = await masterConn2.query(
          'SELECT admission_number FROM students WHERE admission_number LIKE ?',
          [`${prefix}_%`]
        );
        masterConn2.release();

        const allNumbers = [...(submissions || []).map(s => s.admission_number), ...studentRows2.map(s => s.admission_number)].filter(Boolean);

        let maxNum = 0;
        allNumbers.forEach(num => {
          const match = num.match(new RegExp(`^${prefix}_(\\d+)$`));
          if (match) {
            const numPart = parseInt(match[1], 10);
            if (numPart > maxNum) maxNum = numPart;
          }
        });

        const nextNum = (maxNum + 1).toString().padStart(3, '0');
        generatedAdmissionNumber = `${prefix}_${nextNum}`;
      }
    } catch (error) {
      console.error('Error checking auto-assign setting:', error);
      // Continue without assigning
    }

    // Insert submission
    const { error: insErr } = await supabase
      .from('form_submissions')
      .insert({
        submission_id: submissionId,
        form_id: formId,
        admission_number: generatedAdmissionNumber,
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
      submitted_by_admin_name: sub.submitted_by_admin ? (idToSubmittedAdmin.get(sub.submitted_by_admin) || null) : null,
      submitted_at: sub.created_at
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
      form_fields: formFields,
      submitted_at: base.created_at
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

// Enhanced bulk upload submissions (admin only) with comprehensive logging
exports.bulkUploadSubmissions = async (req, res) => {
  let masterConn = null;
  const uploadStartTime = Date.now();

  try {
    // Initial request logging
    logBulkUploadEvent('info', 'BULK_UPLOAD_STARTED', {
      adminId: req.admin?.id,
      fileInfo: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        sizeMB: (req.file.size / (1024 * 1024)).toFixed(2)
      } : null,
      requestBody: req.body,
      timestamp: new Date().toISOString()
    });

    if (!req.file) {
      logBulkUploadError(null, 'MISSING_FILE', 'No file received from client');
      return res.status(400).json({
        success: false,
        message: 'CSV or Excel file is required - file was not received by server'
      });
    }

    const formId = req.body.formId;
    logBulkUploadEvent('info', 'FORM_VALIDATION', {
      formId,
      hasFormId: !!formId
    });

    if (!formId) {
      logBulkUploadError(null, 'MISSING_FORM_ID', 'Form ID not provided in request');
      return res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
    }

    // Verify form exists
    const formFetchStart = Date.now();
    const { data: forms, error } = await supabase
      .from('forms')
      .select('*')
      .eq('form_id', formId)
      .limit(1);
    if (error) throw error;

    const formFetchTime = Date.now() - formFetchStart;
    logPerformanceMetrics('FORM_FETCH', formFetchStart, Date.now(), {
      formFetchTime: `${formFetchTime}ms`,
      formsFound: forms.length
    });

    if (forms.length === 0) {
      logBulkUploadError(null, 'FORM_NOT_FOUND', `Form with ID ${formId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    const form = forms[0];
    const formFields = parseJSON(form.form_fields);

    // Create field mapping between CSV headers and form field keys
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
      'Student Address': 'student_address',
      'CityVillage Name': 'city_village',
      'Mandal Name': 'mandal_name',
      'District Name': 'district',
      'Previous College Name': 'previous_college',
      'Certificate Status': 'certificates_status',
      'Remarks': 'remarks'
    };

    logBulkUploadEvent('info', 'FORM_LOADED', {
      formId: form.form_id,
      formName: form.form_name,
      formFieldsCount: formFields.length,
      isActive: form.is_active,
      fieldMapping: fieldMapping
    });

    // Parse file (CSV or Excel) with comprehensive logging
    const results = [];
    const errors = [];
    let rowNumber = 0;
    const parsingStartTime = Date.now();

    logBulkUploadEvent('info', 'FILE_PARSING_STARTED', {
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    // Determine file type and parse accordingly
    const isExcel = req.file.mimetype.includes('excel') || req.file.mimetype.includes('spreadsheet') ||
                   req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls');

    logBulkUploadEvent('info', 'FILE_TYPE_DETERMINED', {
      isExcel,
      detectionMethod: isExcel ? 'MIME type or extension check' : 'Default to CSV',
      mimeType: req.file.mimetype,
      fileExtension: req.file.originalname.split('.').pop()
    });

    if (isExcel) {
      // Parse Excel file with detailed logging
      logBulkUploadEvent('info', 'EXCEL_PARSING_INITIATED', {
        library: 'xlsx',
        filePath: req.file.path
      });

      try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];

        logBulkUploadEvent('info', 'EXCEL_WORKBOOK_LOADED', {
          sheetNames: workbook.SheetNames,
          selectedSheet: sheetName,
          totalSheets: workbook.SheetNames.length
        });

        // Convert to JSON with header row
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        logBulkUploadEvent('info', 'EXCEL_DATA_CONVERTED', {
          totalRows: jsonData.length,
          headerRow: jsonData[0],
          dataRows: jsonData.length - 1
        });

        // Process rows (skip header row)
        for (let i = 1; i < jsonData.length; i++) {
          rowNumber++;
          const row = jsonData[i];

          if (row && row.length > 0) {
            // Convert array to object using headers
            const headers = jsonData[0];
            const data = {};
            headers.forEach((header, index) => {
              if (header && row[index] !== undefined) {
                data[header] = row[index];
              }
            });

            // Log detailed row data extraction
            const rowLogData = logRowData(rowNumber, data, fieldMapping);
            results.push({ row: rowNumber, data, logData: rowLogData });
          } else {
            logBulkUploadError(rowNumber, 'EMPTY_ROW', 'Row is empty or contains no data', { rowData: row });
          }
        }

        const parsingTime = Date.now() - parsingStartTime;
        logPerformanceMetrics('EXCEL_PARSING', parsingStartTime, Date.now(), {
          rowsParsed: results.length,
          parsingTime: `${parsingTime}ms`,
          averageTimePerRow: results.length > 0 ? `${(parsingTime / results.length).toFixed(2)}ms` : 'N/A'
        });

        logBulkUploadEvent('info', 'EXCEL_PARSING_COMPLETED', {
          totalRowsParsed: results.length,
          parsingTime: `${parsingTime}ms`
        });

      } catch (error) {
        logBulkUploadError(null, 'EXCEL_PARSING_FAILED', error.message, {
          filePath: req.file.path,
          errorStack: error.stack
        });
        throw error;
      }
    } else {
      // Parse CSV file with detailed logging
      logBulkUploadEvent('info', 'CSV_PARSING_INITIATED', {
        library: 'csv-parser',
        filePath: req.file.path
      });

      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (data) => {
            rowNumber++;
            // Log detailed row data extraction for CSV
            const rowLogData = logRowData(rowNumber, data, fieldMapping);
            results.push({ row: rowNumber, data, logData: rowLogData });
          })
          .on('end', () => {
            const parsingTime = Date.now() - parsingStartTime;
            logPerformanceMetrics('CSV_PARSING', parsingStartTime, Date.now(), {
              rowsParsed: results.length,
              parsingTime: `${parsingTime}ms`,
              averageTimePerRow: results.length > 0 ? `${(parsingTime / results.length).toFixed(2)}ms` : 'N/A'
            });

            logBulkUploadEvent('info', 'CSV_PARSING_COMPLETED', {
              totalRowsParsed: results.length,
              parsingTime: `${parsingTime}ms`
            });
            resolve();
          })
          .on('error', (error) => {
            logBulkUploadError(null, 'CSV_PARSING_FAILED', error.message, {
              filePath: req.file.path,
              errorStack: error.stack
            });
            reject(error);
          });
      });
    }

    // Initialize counters for enhanced tracking with logging
    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    let missingFieldCount = 0;
    const processedRows = [];
    const duplicateDetails = [];
    const rowProcessingStartTime = Date.now();

    logBulkUploadEvent('info', 'ROW_PROCESSING_STARTED', {
      totalRowsToProcess: results.length,
      fieldMapping: Object.keys(fieldMapping),
      expectedFields: Object.values(fieldMapping)
    });

    // Get database connection for duplicate checking
    masterConn = await masterPool.getConnection();
    logBulkUploadEvent('info', 'DATABASE_CONNECTION_ESTABLISHED', {
      connectionType: 'masterPool',
      databaseName: 'student_database'
    });

    for (const result of results) {
      const rowProcessingTime = Date.now();
      try {
        const { row, data } = result;

        logBulkUploadEvent('info', 'ROW_PROCESSING_INITIATED', {
          rowNumber: row,
          availableFields: Object.keys(data),
          fieldCount: Object.keys(data).length
        });

        // Build submission data from row, mapping field names to form field keys
        const submissionData = {};

        // Map data using the field mapping - handle missing fields gracefully
        Object.entries(fieldMapping).forEach(([csvHeader, fieldKey]) => {
          if (data[csvHeader] !== undefined && data[csvHeader] !== null) {
            // Convert Excel data to string and trim safely
            submissionData[fieldKey] = String(data[csvHeader]).trim();
          }
        });

        // Log the final submission data for this row
        logBulkUploadEvent('info', 'SUBMISSION_DATA_MAPPED', {
          rowNumber: row,
          mappedFields: Object.keys(submissionData),
          fieldCount: Object.keys(submissionData).length,
          submissionData: submissionData
        });

        // Enhanced validation and duplicate checking with detailed logging
        const validationStartTime = Date.now();
        const validationResult = await validateAndCheckDuplicates(submissionData, masterConn, row);
        const validationTime = Date.now() - validationStartTime;

        logBulkUploadEvent('info', 'VALIDATION_COMPLETED', {
          rowNumber: row,
          validationTime: `${validationTime}ms`,
          isValid: validationResult.isValid,
          validationType: validationResult.type,
          errorMessage: validationResult.error
        });

        if (!validationResult.isValid) {
          const errorDetails = {
            row,
            message: validationResult.error,
            type: validationResult.type,
            details: validationResult.details,
            validationTime: `${validationTime}ms`
          };

          errors.push(errorDetails);

          if (validationResult.type === 'duplicate') {
            duplicateCount++;
            logBulkUploadEvent('warn', 'DUPLICATE_DETECTED', {
              rowNumber: row,
              duplicates: validationResult.details.duplicates,
              validationTime: `${validationTime}ms`
            });
          } else if (validationResult.type === 'missing_fields') {
            missingFieldCount++;
            logBulkUploadEvent('warn', 'MISSING_FIELDS_DETECTED', {
              rowNumber: row,
              missingFields: validationResult.details.missingFields,
              validationTime: `${validationTime}ms`
            });
          }

          failedCount++;
          processedRows.push({
            row,
            status: 'failed',
            reason: validationResult.error,
            type: validationResult.type,
            validationTime: `${validationTime}ms`
          });

          logBulkUploadError(row, validationResult.type, validationResult.error, {
            validationTime: `${validationTime}ms`,
            details: validationResult.details
          });
          continue;
        }

        const submissionId = uuidv4();

        // Insert submission with admin tracking
        const insertionStartTime = Date.now();
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
        const insertionTime = Date.now() - insertionStartTime;

        logBulkUploadEvent('info', 'SUBMISSION_INSERTED', {
          rowNumber: row,
          submissionId,
          admissionNumber: submissionData.admission_number,
          insertionTime: `${insertionTime}ms`
        });

        successCount++;
        const totalRowTime = Date.now() - rowProcessingTime;
        processedRows.push({
          row,
          status: 'success',
          submissionId,
          admissionNumber: submissionData.admission_number,
          processingTime: `${totalRowTime}ms`
        });

        logBulkUploadEvent('info', 'ROW_PROCESSING_COMPLETED', {
          rowNumber: row,
          status: 'success',
          processingTime: `${totalRowTime}ms`,
          insertionTime: `${insertionTime}ms`
        });

      } catch (error) {
        const totalRowTime = Date.now() - rowProcessingTime;
        logBulkUploadError(result.row, 'PROCESSING_ERROR', error.message, {
          processingTime: `${totalRowTime}ms`,
          errorStack: error.stack,
          rowData: result.data
        });

        errors.push({
          row: result.row,
          message: error.message,
          type: 'processing_error',
          processingTime: `${totalRowTime}ms`
        });
        failedCount++;
        processedRows.push({
          row: result.row,
          status: 'failed',
          reason: error.message,
          type: 'processing_error',
          processingTime: `${totalRowTime}ms`
        });
      }
    }

    const totalProcessingTime = Date.now() - rowProcessingStartTime;

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    logBulkUploadEvent('info', 'FILE_CLEANUP_COMPLETED', {
      filePath: req.file.path,
      fileName: req.file.originalname
    });

    // Data integrity verification
    const integrityStartTime = Date.now();
    let dataIntegrityIssues = 0;

    // Verify submissions were actually inserted
    const { data: insertedSubmissions, error: verifyError } = await supabase
      .from('form_submissions')
      .select('submission_id, admission_number, status')
      .eq('form_id', formId)
      .eq('submitted_by_admin', req.admin.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(successCount + 10); // Get a few extra to check for duplicates

    if (verifyError) {
      logBulkUploadError(null, 'INTEGRITY_VERIFICATION_FAILED', verifyError.message);
      dataIntegrityIssues++;
    } else {
      const actualInsertedCount = insertedSubmissions ? insertedSubmissions.length : 0;
      logBulkUploadEvent('info', 'INTEGRITY_VERIFICATION_COMPLETED', {
        expectedCount: successCount,
        actualCount: actualInsertedCount,
        difference: actualInsertedCount - successCount,
        integrityIssues: actualInsertedCount !== successCount ? 1 : 0
      });

      if (actualInsertedCount !== successCount) {
        dataIntegrityIssues++;
        logBulkUploadError(null, 'DATA_INTEGRITY_MISMATCH',
          `Expected ${successCount} submissions but found ${actualInsertedCount}`,
          { expectedCount: successCount, actualCount: actualInsertedCount });
      }
    }

    const integrityTime = Date.now() - integrityStartTime;

    // Enhanced logging with detailed statistics and performance metrics
    const totalUploadTime = Date.now() - uploadStartTime;
    const masterConn4 = await masterPool.getConnection();

    const auditDetails = {
      successCount,
      failedCount,
      duplicateCount,
      missingFieldCount,
      totalRows: results.length,
      processedRows: processedRows.length,
      totalUploadTime: `${totalUploadTime}ms`,
      averageTimePerRow: results.length > 0 ? `${(totalUploadTime / results.length).toFixed(2)}ms` : 'N/A',
      parsingTime: 'calculated',
      validationTime: 'calculated',
      insertionTime: 'calculated',
      integrityVerificationTime: `${integrityTime}ms`,
      dataIntegrityIssues,
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      formInfo: {
        formId,
        formName: form.form_name
      },
      errors: errors.slice(0, 20), // Limit for audit log
      processedRows: processedRows.slice(0, 20) // Limit for audit log
    };

    await masterConn4.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['ENHANCED_BULK_UPLOAD', 'SUBMISSION', formId, req.admin.id, JSON.stringify(auditDetails)]
    );
    masterConn4.release();

    // Comprehensive final summary logging
    logPerformanceMetrics('TOTAL_BULK_UPLOAD', uploadStartTime, Date.now(), {
      totalRows: results.length,
      successCount,
      failedCount,
      duplicateCount,
      missingFieldCount,
      dataIntegrityIssues,
      averageTimePerRow: results.length > 0 ? `${(totalUploadTime / results.length).toFixed(2)}ms` : 'N/A'
    });

    logBulkUploadEvent('info', 'BULK_UPLOAD_COMPLETED', {
      summary: {
        totalRowsProcessed: results.length,
        successfulUploads: successCount,
        failedUploads: failedCount,
        duplicateEntries: duplicateCount,
        missingFields: missingFieldCount,
        dataIntegrityIssues,
        totalProcessingTime: `${totalUploadTime}ms`
      },
      performance: {
        averageTimePerRow: results.length > 0 ? `${(totalUploadTime / results.length).toFixed(2)}ms` : 'N/A',
        parsingTime: 'calculated',
        validationTime: 'calculated',
        insertionTime: 'calculated',
        integrityVerificationTime: `${integrityTime}ms`
      },
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Enhanced bulk upload completed: ${successCount} success, ${failedCount} failed, ${duplicateCount} duplicates, ${missingFieldCount} missing fields, ${dataIntegrityIssues} integrity issues`);

    res.json({
      success: true,
      message: `Enhanced bulk upload completed. ${successCount} submissions created, ${failedCount} failed.`,
      successCount,
      failedCount,
      duplicateCount,
      missingFieldCount,
      totalRows: results.length,
      dataIntegrityIssues,
      totalProcessingTime: `${totalUploadTime}ms`,
      errors: errors.slice(0, 50), // Increased error limit for better debugging
      processedRows: processedRows.slice(0, 100) // Include processing details
    });

  } catch (error) {
    const totalUploadTime = Date.now() - uploadStartTime;

    // Comprehensive error logging
    logBulkUploadError(null, 'BULK_UPLOAD_FAILED', error.message, {
      errorStack: error.stack,
      totalUploadTime: `${totalUploadTime}ms`,
      fileInfo: req.file ? {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      } : null,
      formId: req.body.formId,
      adminId: req.admin?.id
    });

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      logBulkUploadEvent('info', 'ERROR_CLEANUP_COMPLETED', {
        filePath: req.file.path,
        cleanupReason: 'Error occurred during processing'
      });
    }

    // Log performance metrics even for failed uploads
    logPerformanceMetrics('FAILED_BULK_UPLOAD', uploadStartTime, Date.now(), {
      errorType: error.name,
      errorMessage: error.message,
      totalUploadTime: `${totalUploadTime}ms`
    });

    res.status(500).json({
      success: false,
      message: 'Server error during enhanced bulk upload',
      error: error.message,
      totalUploadTime: `${totalUploadTime}ms`,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (masterConn) {
      masterConn.release();
      logBulkUploadEvent('info', 'DATABASE_CONNECTION_RELEASED', {
        connectionType: 'masterPool',
        releaseReason: 'Upload process completed or failed'
      });
    }
  }
};

// Generate admission number series
exports.generateAdmissionSeries = async (req, res) => {
  try {
    // Get current prefix from settings
    const { data: prefixSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admission_prefix')
      .single();

    const currentPrefix = prefixSetting ? prefixSetting.value : 'PYDAH2025';
    const prefix = req.body.prefix || currentPrefix;

    const { autoAssign = false } = req.body;
    const count = 1; // Always generate one number

    if (!prefix || typeof prefix !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Prefix is required'
      });
    }

    // Validate prefix format (alphanumeric, underscores, hyphens only)
    if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) {
      return res.status(400).json({
        success: false,
        message: 'Prefix can only contain letters, numbers, underscores, and hyphens'
      });
    }

    // Find the next sequential number
    const { data: submissions, error: subErr } = await supabase
      .from('form_submissions')
      .select('admission_number')
      .like('admission_number', `${prefix}_%`);

    if (subErr) throw subErr;

    // Query students from MySQL
    const masterConn = await masterPool.getConnection();
    const [studentRows] = await masterConn.query(
      'SELECT admission_number FROM students WHERE admission_number LIKE ?',
      [`${prefix}_%`]
    );
    masterConn.release();

    const allNumbers = [...(submissions || []).map(s => s.admission_number), ...studentRows.map(s => s.admission_number)].filter(Boolean);

    let maxNum = 0;
    allNumbers.forEach(num => {
      const match = num.match(new RegExp(`^${prefix}_(\\d+)$`));
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (numPart > maxNum) maxNum = numPart;
      }
    });

    const admissionNumbers = [];
    for (let i = 1; i <= count; i++) {
      const num = (maxNum + i).toString().padStart(3, '0');
      admissionNumbers.push(`${prefix}_${num}`);
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

    // Always save the prefix to settings since the admin explicitly requested this prefix
    await supabase
      .from('settings')
      .upsert({ key: 'admission_prefix', value: prefix });

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
      // Return default completion status if form is not found
      return res.json({
        success: true,
        data: {
          totalFields: 0,
          completedFields: 0,
          pendingFields: 0,
          completionPercentage: 0,
          fieldStatus: [],
          formName: 'Unknown',
          missingFields: [],
          note: 'Form not found for this student'
        }
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
      // Return default completion status if form_id is not available
      return res.json({
        success: true,
        data: {
          totalFields: 0,
          completedFields: 0,
          pendingFields: 0,
          completionPercentage: 0,
          fieldStatus: [],
          formName: 'Unknown',
          missingFields: [],
          note: 'Form structure not available for this student'
        }
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
    // Exclude PIN number fields as they are optional administrative fields
    const allFields = formFields.filter(field => field.key);
    const completionFields = allFields.filter(field =>
      !field.key.toLowerCase().includes('pin') &&
      field.key !== 'pin_no'
    );

    console.log(`\n🔍 STUDENT COMPLETION ANALYSIS: ${admissionNumber}`);
    console.log(`   📊 Form fields: ${allFields.length} total, ${completionFields.length} for completion (${allFields.length - completionFields.length} PIN fields excluded)`);

    // Calculate completion status considering all fields except PIN numbers
    const totalFields = completionFields.length;
    let completedFields = 0;

    const fieldStatus = allFields.map(field => {
      const key = field.key;
      const isPinField = key.toLowerCase().includes('pin') || key === 'pin_no';

      // Check if the field exists in the student record (individual columns take precedence)
      let value = null;
      let completed = false;
      let source = 'none';

      // First check individual database columns
      if (student[key] !== undefined && student[key] !== null && student[key] !== '') {
        value = student[key];
        source = 'database_column';
        // Only count non-PIN fields towards completion
        if (!isPinField) {
          completed = true;
          completedFields++;
        }
      }
      // Then check student_data JSON as fallback
      else if (student.student_data) {
        try {
          const studentData = parseJSON(student.student_data);
          if (studentData && studentData[key] !== undefined && studentData[key] !== null && studentData[key] !== '') {
            value = studentData[key];
            source = 'json_data';
            // Only count non-PIN fields towards completion
            if (!isPinField) {
              completed = true;
              completedFields++;
            }
          } else {
            source = 'json_empty';
          }
        } catch (error) {
          source = 'json_error';
        }
      } else {
        source = 'no_data';
      }

      // Enhanced logging for all fields
      const status = completed ? '✅' : (isPinField ? '🔄' : '❌');
      const fieldType = isPinField ? 'PIN' : 'REG';
      const sourceInfo = source !== 'none' ? `(${source})` : '';
      const valuePreview = value ? `"${value.substring ? value.substring(0, 30) + (value.length > 30 ? '...' : '') : value}"` : '""';

      console.log(`   ${status} ${fieldType} ${key.padEnd(25)} ${valuePreview.padEnd(35)} ${sourceInfo}`);

      return {
        key: field.key,
        label: field.label,
        type: field.type || 'text',
        completed: completed,
        value: value,
        required: field.required || false,
        isHidden: field.isHidden || false,
        isPinField: isPinField,
        source: source
      };
    });

    // Summary section
    const missingFields = fieldStatus.filter(field => !field.isPinField && !field.completed);
    const pinFields = fieldStatus.filter(field => field.isPinField);

    console.log(`\n📊 COMPLETION SUMMARY for ${admissionNumber}:`);
    console.log(`   ✅ Completed: ${completedFields}/${totalFields} fields (${Math.round((completedFields / totalFields) * 100)}%)`);

    if (missingFields.length > 0) {
      console.log(`   ❌ Missing ${missingFields.length} fields:`);
      missingFields.forEach(field => {
        console.log(`      • ${field.key}: ${field.source} - "${field.value || 'empty'}"`);
      });
    } else {
      console.log(`   🎉 All required fields completed!`);
    }

    if (pinFields.length > 0) {
      console.log(`   🔄 PIN fields (${pinFields.length}):`);
      pinFields.forEach(field => {
        console.log(`      • ${field.key}: ${field.source} - "${field.value || 'not assigned'}"`);
      });
    }

    console.log(`   📋 Data sources: DB columns + JSON fallback`);

    const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

    console.log(`📊 Completion: ${completionPercentage}% (${completedFields}/${totalFields} fields completed)`);

    // Add summary of missing fields for easier debugging
    const missingFieldSummary = fieldStatus.filter(field => !field.isPinField && !field.completed).map(field => ({
      key: field.key,
      label: field.label,
      source: field.source,
      currentValue: field.value
    }));

    res.json({
      success: true,
      data: {
        totalFields,
        completedFields,
        pendingFields: totalFields - completedFields,
        completionPercentage,
        fieldStatus,
        formName,
        missingFields: missingFields,
        note: 'PIN number fields are excluded from completion calculation as they are optional administrative fields'
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

// Download Excel template for bulk upload
exports.downloadExcelTemplate = async (req, res) => {
  try {
    const { formId } = req.params;

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

    // Define headers in the same order as the frontend template
    const headers = [
      'admission_number',
      'Pin No',
      'Batch',
      'Branch',
      'StudType',
      'Student Name',
      'Student Status',
      'Scholar Status',
      'Student Mobile Number',
      'Parent Mobile Number 1',
      'Parent Mobile Number 2',
      'Caste',
      'M/F',
      'DOB (Date-Month-Year)',
      'Father Name',
      'Admission Year (Ex: 09-Sep-2003)',
      'AADHAR No',
      'Student Address',
      'CityVillage Name',
      'Mandal Name',
      'District Name',
      'Previous College Name',
      'Certificate Status',
      'Remarks'
    ];

    // Create Excel workbook and worksheet
    const workbook = xlsx.utils.book_new();
    const worksheetData = [headers]; // Header row

    // Add a sample data row for reference
    const sampleRow = headers.map(header => {
      switch(header) {
        case 'admission_number': return 'ADM001';
        case 'Student Name': return 'John Doe';
        case 'Student Mobile Number': return '9876543210';
        case 'M/F': return 'M';
        case 'DOB (Date-Month-Year)': return '01-Jan-2000';
        case 'Admission Year (Ex: 09-Sep-2003)': return '01-Sep-2023';
        default: return '';
      }
    });
    worksheetData.push(sampleRow);

    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    const columnWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
    worksheet['!cols'] = columnWidths;

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${form.form_name}_template.xlsx"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

    console.log(`✅ Excel template downloaded for form: ${form.form_name}`);

  } catch (error) {
    console.error('Download Excel template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating Excel template'
    });
  }
};

// Bulk approve submissions (admin only)
exports.bulkApproveSubmissions = async (req, res) => {
  let masterConn = null;
  const startTime = Date.now();

  try {
    const { submissionIds } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission IDs array is required'
      });
    }

    console.log(`🔄 Starting bulk approval for ${submissionIds.length} submissions`);

    // Get database connection
    masterConn = await masterPool.getConnection();

    let approvedCount = 0;
    let failedCount = 0;
    const results = [];
    const errors = [];

    // Process each submission
    for (const submissionId of submissionIds) {
      try {
        console.log(`📋 Processing submission: ${submissionId}`);

        // Get submission details
        const { data: submissions, error: fetchError } = await supabase
          .from('form_submissions')
          .select('*')
          .eq('submission_id', submissionId)
          .eq('status', 'pending')
          .limit(1);

        if (fetchError) {
          console.error(`❌ Error fetching submission ${submissionId}:`, fetchError);
          errors.push({
            submissionId,
            error: fetchError.message,
            type: 'fetch_error'
          });
          failedCount++;
          continue;
        }

        if (!submissions || submissions.length === 0) {
          console.error(`❌ Submission ${submissionId} not found or not pending`);
          errors.push({
            submissionId,
            error: 'Submission not found or not pending',
            type: 'not_found'
          });
          failedCount++;
          continue;
        }

        const submission = submissions[0];
        const submissionData = parseJSON(submission.submission_data);

        // Generate admission number if not present
        const admissionNumber = submissionData.admission_number || `ADM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Update submission data with admission number
        const updatedSubmissionData = {
          ...submissionData,
          admission_number: admissionNumber
        };

        // Approve the submission (same logic as single approval)
        await approveSingleSubmission(submission, updatedSubmissionData, admissionNumber, masterConn, req.admin);

        approvedCount++;
        results.push({
          submissionId,
          admissionNumber,
          status: 'approved'
        });

        console.log(`✅ Approved submission ${submissionId} with admission number: ${admissionNumber}`);

      } catch (error) {
        console.error(`❌ Error approving submission ${submissionId}:`, error);
        errors.push({
          submissionId,
          error: error.message,
          type: 'approval_error'
        });
        failedCount++;
      }
    }

    const totalTime = Date.now() - startTime;

    // Log action
    const masterConn2 = await masterPool.getConnection();
    await masterConn2.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['BULK_APPROVE', 'SUBMISSION', JSON.stringify(submissionIds), req.admin.id, JSON.stringify({
        approvedCount,
        failedCount,
        totalTime: `${totalTime}ms`
      })]
    );
    masterConn2.release();

    console.log(`✅ Bulk approval completed: ${approvedCount} approved, ${failedCount} failed in ${totalTime}ms`);

    res.json({
      success: true,
      message: `Bulk approval completed: ${approvedCount} approved, ${failedCount} failed`,
      approvedCount,
      failedCount,
      totalTime: `${totalTime}ms`,
      results,
      errors
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Bulk approval failed:', error);

    res.status(500).json({
      success: false,
      message: 'Server error during bulk approval',
      error: error.message,
      totalTime: `${totalTime}ms`
    });
  } finally {
    if (masterConn) {
      masterConn.release();
    }
  }
};

// Helper function to approve a single submission (extracted from original approveSubmission)
const approveSingleSubmission = async (submission, submissionData, admissionNumber, masterConn, admin) => {
  const finalAdmissionNumber = String(admissionNumber).trim();

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
  await masterConn.query(
    `CREATE TABLE IF NOT EXISTS ${destinationTable} (
      id INT PRIMARY KEY AUTO_INCREMENT,
      admission_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  // Ensure columns for each field key exist
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

  // Check if student exists and update/create accordingly
  const [students] = await masterConn.query(
    'SELECT * FROM students WHERE admission_number = ? OR admission_no = ?',
    [finalAdmissionNumber, finalAdmissionNumber]
  );

  if (students.length > 0) {
    // Update existing student
    const existingStudent = students[0];
    const existingData = parseJSON(existingStudent.student_data) || {};
    const mergedData = { ...existingData };

    Object.entries(submissionData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        mergedData[key] = value;
      }
    });

    mergedData.form_id = submission.form_id;

    const updateFields = [];
    const updateValues = [];
    const addedUpdateFields = new Set();

    Object.entries(submissionData).forEach(([key, value]) => {
      if (predefinedKeys.includes(key) && value !== undefined && value !== '' && !addedUpdateFields.has(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
        addedUpdateFields.add(key);
      }
    });

    if (!addedUpdateFields.has('student_data')) {
      const jsonMergedData = safeJSONStringify(mergedData);
      updateFields.push('student_data = ?');
      updateValues.push(jsonMergedData);
    }

    updateValues.push(finalAdmissionNumber);

    await masterConn.query(
      `UPDATE students SET ${updateFields.join(', ')} WHERE admission_number = ? OR admission_no = ?`,
      [...updateValues, finalAdmissionNumber, finalAdmissionNumber]
    );
  } else {
    // Create new student
    const studentData = {};
    const fieldValuePairs = [];
    const addedFields = new Set();

    fieldValuePairs.push({ field: 'admission_number', value: finalAdmissionNumber });
    addedFields.add('admission_number');

    fieldValuePairs.push({ field: 'admission_no', value: finalAdmissionNumber });
    addedFields.add('admission_no');

    Object.entries(submissionData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        let sanitizedValue = value;
        if (typeof value === 'string') {
          sanitizedValue = value.trim();
        }

        studentData[key] = sanitizedValue;

        if (predefinedKeys.includes(key) && !addedFields.has(key)) {
          fieldValuePairs.push({ field: key, value: sanitizedValue });
          addedFields.add(key);
        }
      }
    });

    studentData.form_id = submission.form_id;

    if (!addedFields.has('student_data')) {
      const jsonStudentData = safeJSONStringify(studentData);
      fieldValuePairs.push({ field: 'student_data', value: jsonStudentData });
      addedFields.add('student_data');
    }

    const insertFields = fieldValuePairs.map(pair => pair.field);
    const insertValues = fieldValuePairs.map(pair => pair.value);

    const placeholders = insertFields.map(() => '?').join(', ');
    const query = `INSERT INTO students (${insertFields.join(', ')}) VALUES (${placeholders})`;

    await masterConn.query(query, insertValues);
  }

  // Update submission status
  const { error: updErr } = await supabase
    .from('form_submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      admission_number: finalAdmissionNumber
    })
    .eq('submission_id', submission.submission_id);

  if (updErr) throw updErr;
};

// Toggle auto-assign series setting
exports.toggleAutoAssignSeries = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Enabled must be a boolean'
      });
    }

    // First, try to create the settings table if it doesn't exist
    try {
      const { error: tableCheckError } = await supabase
        .from('settings')
        .select('id')
        .limit(1);

      if (tableCheckError && tableCheckError.code === 'PGRST205') {
        console.log('Settings table does not exist, cannot toggle setting');
        return res.status(500).json({
          success: false,
          message: 'Settings table does not exist. Please create it in Supabase first.'
        });
      }
    } catch (createError) {
      console.error('Error checking settings table:', createError);
    }

    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'auto_assign_series', value: enabled.toString() }, { onConflict: 'key' });

    if (error) throw error;

    res.json({
      success: true,
      message: `Auto-assign series ${enabled ? 'enabled' : 'disabled'}`
    });

  } catch (error) {
    console.error('Toggle auto-assign series error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling auto-assign series'
    });
  }
};

// Get auto-assign series setting
exports.getAutoAssignSeries = async (req, res) => {
  try {
    // First, try to create the settings table if it doesn't exist
    try {
      // Check if table exists by trying to query it
      const { error: tableCheckError } = await supabase
        .from('settings')
        .select('id')
        .limit(1);

      if (tableCheckError && tableCheckError.code === 'PGRST205') {
        // Table doesn't exist, try to create it
        console.log('Settings table does not exist, attempting to create...');

        // Since we can't create tables directly via Supabase client,
        // we'll use a workaround by inserting with error handling
        // For now, return default value and log the issue
        console.warn('Settings table missing. Please create it manually in Supabase or run the init script.');

        // Return default value
        res.json({
          success: true,
          data: { enabled: false },
          note: 'Settings table not found, using default value'
        });
        return;
      }
    } catch (createError) {
      console.error('Error checking/creating settings table:', createError);
    }

    const { data: setting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_assign_series')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found

    const enabled = setting ? setting.value === 'true' : false;

    res.json({
      success: true,
      data: { enabled }
    });

  } catch (error) {
    console.error('Get auto-assign series error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting auto-assign series setting'
    });
  }
};

// Export multer middleware
exports.uploadMiddleware = upload.single('file');
exports.upload = upload;
