const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

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
    const { formId } = req.params;
    const { admissionNumber, formData } = req.body;

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Form data is required' 
      });
    }

    // Verify form exists and is active
    const [forms] = await pool.query(
      'SELECT * FROM forms WHERE form_id = ? AND is_active = TRUE',
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found or inactive' 
      });
    }

    const submissionId = uuidv4();

    // Insert submission
    await pool.query(
      `INSERT INTO form_submissions (submission_id, form_id, admission_number, submission_data, status) 
       VALUES (?, ?, ?, ?, 'pending')`,
      [submissionId, formId, admissionNumber || null, JSON.stringify(formData)]
    );

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

    let query = `
      SELECT fs.*, f.form_name, a.username as reviewed_by_name
      FROM form_submissions fs
      LEFT JOIN forms f ON fs.form_id = f.form_id
      LEFT JOIN admins a ON fs.reviewed_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND fs.status = ?';
      params.push(status);
    }

    if (formId) {
      query += ' AND fs.form_id = ?';
      params.push(formId);
    }

    query += ' ORDER BY fs.submitted_at DESC';

    const [submissions] = await pool.query(query, params);

    // Parse JSON fields
    const parsedSubmissions = submissions.map(sub => ({
      ...sub,
      submission_data: parseJSON(sub.submission_data)
    }));

    res.json({
      success: true,
      data: parsedSubmissions
    });

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

    const [submissions] = await pool.query(
      `SELECT fs.*, f.form_name, f.form_fields, a.username as reviewed_by_name
       FROM form_submissions fs
       LEFT JOIN forms f ON fs.form_id = f.form_id
       LEFT JOIN admins a ON fs.reviewed_by = a.id
       WHERE fs.submission_id = ?`,
      [submissionId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }

    const submission = {
      ...submissions[0],
      submission_data: parseJSON(submissions[0].submission_data),
      form_fields: submissions[0].form_fields ? parseJSON(submissions[0].form_fields) : null
    };

    res.json({
      success: true,
      data: submission
    });

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
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { submissionId } = req.params;
    const { admissionNumber } = req.body;

    // Get submission
    const [submissions] = await connection.query(
      'SELECT * FROM form_submissions WHERE submission_id = ? AND status = "pending"',
      [submissionId]
    );

    if (submissions.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Pending submission not found' 
      });
    }

    const submission = submissions[0];
    const finalAdmissionNumber = admissionNumber || submission.admission_number;

    if (!finalAdmissionNumber) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Admission number is required' 
      });
    }

    const submissionData = parseJSON(submission.submission_data);

    // Check if student exists
    const [students] = await connection.query(
      'SELECT * FROM students WHERE admission_number = ?',
      [finalAdmissionNumber]
    );

    if (students.length > 0) {
      // Update existing student
      const existingData = parseJSON(students[0].student_data);
      const mergedData = { ...existingData, ...submissionData };

      await connection.query(
        'UPDATE students SET student_data = ? WHERE admission_number = ?',
        [JSON.stringify(mergedData), finalAdmissionNumber]
      );
    } else {
      // Create new student
      await connection.query(
        'INSERT INTO students (admission_number, student_data) VALUES (?, ?)',
        [finalAdmissionNumber, JSON.stringify(submissionData)]
      );
    }

    // Update submission status
    await connection.query(
      `UPDATE form_submissions 
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, admission_number = ?
       WHERE submission_id = ?`,
      [req.admin.id, finalAdmissionNumber, submissionId]
    );

    // Log action
    await connection.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['APPROVE', 'SUBMISSION', submissionId, req.admin.id, JSON.stringify({ admissionNumber: finalAdmissionNumber })]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Submission approved and data saved to database'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Approve submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while approving submission' 
    });
  } finally {
    connection.release();
  }
};

// Reject submission
exports.rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body;

    const [result] = await pool.query(
      `UPDATE form_submissions 
       SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?, rejection_reason = ?
       WHERE submission_id = ? AND status = 'pending'`,
      [req.admin.id, reason || 'No reason provided', submissionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pending submission not found' 
      });
    }

    // Log action
    await pool.query(
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

    const [result] = await pool.query(
      'DELETE FROM form_submissions WHERE submission_id = ?',
      [submissionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }

    // Log action
    await pool.query(
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
