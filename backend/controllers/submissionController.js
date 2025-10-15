const { masterPool } = require('../config/database');
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

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
  const masterConn = await masterPool.getConnection();

  try {
    await masterConn.beginTransaction();

    const { submissionId } = req.params;
    const { admissionNumber } = req.body; // Get admission number from request body

    console.log('Approve submission request:', { submissionId, admissionNumber });
    console.log('Request body:', req.body);

    // Get submission
    const { data: submissions, error: subErr } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .eq('status', 'pending')
      .limit(1);
    if (subErr) throw subErr;

    if (submissions.length === 0) {
      await masterConn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pending submission not found'
      });
    }

    const submission = submissions[0];
    const submissionData = parseJSON(submission.submission_data);

    // Use the admission number from the request body (admin input) if provided
    // Otherwise fall back to the existing logic
    const finalAdmissionNumber = admissionNumber || submission.admission_number || submissionData.admission_number || submissionData.admission_no || null;

    console.log('Final admission number:', finalAdmissionNumber);

    // Separate predefined and custom fields
    const predefinedFields = {};
    const predefinedKeys = [
      'pin_no', 'batch', 'branch', 'stud_type', 'student_name', 'student_status',
      'scholar_status', 'student_mobile', 'parent_mobile1', 'parent_mobile2',
      'caste', 'gender', 'father_name', 'dob', 'adhar_no', 'admission_date',
      'roll_number', 'student_address', 'city_village', 'mandal_name', 'district',
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

    // Only proceed if we have a valid admission number
    if (!finalAdmissionNumber) {
      console.log('No admission number provided, skipping student database operations');
      // Update submission status only
      const { error: updErr } = await supabase
        .from('form_submissions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: req.admin.id, admission_number: finalAdmissionNumber })
        .eq('submission_id', submissionId);
      if (updErr) throw updErr;

      await masterConn.commit();
      return res.json({
        success: true,
        message: 'Submission approved but no admission number provided for student creation'
      });
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

      // Update both individual columns and JSON data
      const updateFields = [];
      const updateValues = [];

      // Update individual columns for predefined fields
      Object.entries(submissionData).forEach(([key, value]) => {
        if (predefinedKeys.includes(key) && value !== undefined && value !== '') {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });

      // Always update the JSON data
      updateFields.push('student_data = ?');
      updateValues.push(JSON.stringify(mergedData));
      updateValues.push(finalAdmissionNumber);

      await masterConn.query(
        `UPDATE students SET ${updateFields.join(', ')} WHERE admission_number = ? OR admission_no = ?`,
        [...updateValues, finalAdmissionNumber, finalAdmissionNumber]
      );
    } else {
      // Create new student with proper database column mapping
      const studentData = {};
      const insertFields = ['admission_number', 'admission_no'];
      const insertValues = [finalAdmissionNumber, finalAdmissionNumber];

      // Map submission data to database columns based on form field keys
      Object.entries(submissionData).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          studentData[key] = value;

          // Add to individual columns if it's a predefined field
          if (predefinedKeys.includes(key)) {
            insertFields.push(key);
            insertValues.push(value);
          }
        }
      });

      // Always include JSON data
      insertFields.push('student_data');
      insertValues.push(JSON.stringify(studentData));

      await masterConn.query(
        `INSERT INTO students (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
        insertValues
      );
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
    await masterPool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['REJECT', 'SUBMISSION', submissionId, req.admin.id, JSON.stringify({ reason })]
    );

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
    await masterPool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id) 
       VALUES (?, ?, ?, ?)`,
      ['DELETE', 'SUBMISSION', submissionId, req.admin.id]
    );

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

// Bulk upload submissions (admin only)
exports.bulkUploadSubmissions = async (req, res) => {
  // Supabase path doesn't require connection
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const { formId } = req.body;
    
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

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          results.push({ row: rowNumber, data });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // No transaction needed on Supabase client for bulk insert

    let successCount = 0;
    let failedCount = 0;

    for (const result of results) {
      try {
        const { row, data } = result;
        const admissionNumber = data.admission_number;
        
        if (!admissionNumber) {
          errors.push({ row, message: 'Missing admission_number' });
          failedCount++;
          continue;
        }

        // Build submission data from CSV row, mapping to database columns
        const submissionData = {};
        formFields.forEach(field => {
          if (data[field.label] !== undefined && data[field.label] !== '') {
            // Map to database column name
            submissionData[field.key] = data[field.label];
          }
        });

        const submissionId = uuidv4();

        // Insert submission with admin tracking
        await supabase
          .from('form_submissions')
          .insert({
            submission_id: submissionId,
            form_id: formId,
            admission_number: admissionNumber,
            submission_data: submissionData,
            status: 'pending',
            submitted_by: 'admin',
            submitted_by_admin: req.admin.id
          });

        successCount++;
      } catch (error) {
        errors.push({ row: result.row, message: error.message });
        failedCount++;
      }
    }

    // no-op

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Log action
    await masterPool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['BULK_UPLOAD', 'SUBMISSION', formId, req.admin.id,
       JSON.stringify({ successCount, failedCount, totalRows: results.length })]
    );

    res.json({
      success: true,
      message: `Bulk upload completed. ${successCount} submissions created, ${failedCount} failed.`,
      successCount,
      failedCount,
      errors: errors.slice(0, 20) // Limit errors to first 20
    });

  } catch (error) {
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk upload'
    });
  } finally {
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
    const studentData = parseJSON(student.student_data);

    // We need to find which form this student came from
    // Check if student data contains form_id or look it up from submissions
    let formId = studentData.form_id;

    if (!formId) {
      // Try to find the form_id from submissions
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
      .select('form_fields')
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

    // Include both visible and hidden fields for completion calculation
    const allFields = formFields.filter(field => field.key);

    // Calculate completion status considering all fields from the original form
    const totalFields = allFields.length;
    const completedFields = allFields.filter(field => {
      const value = studentData[field.key];
      return value !== undefined && value !== null && value !== '';
    }).length;

    const fieldStatus = allFields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type || 'text',
      completed: studentData[field.key] !== undefined && studentData[field.key] !== null && studentData[field.key] !== '',
      value: studentData[field.key] || null,
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
        fieldStatus,
        formName: forms[0].form_name
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
