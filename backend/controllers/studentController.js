const { pool } = require('../config/database');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

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

// Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const { search, limit = 50, offset = 0, filter_dateFrom, filter_dateTo, filter_rollNumberStatus, ...otherFilters } = req.query;

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (admission_number LIKE ? OR roll_number LIKE ? OR student_data LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Date range filter
    if (filter_dateFrom) {
      query += ' AND DATE(created_at) >= ?';
      params.push(filter_dateFrom);
    }

    if (filter_dateTo) {
      query += ' AND DATE(created_at) <= ?';
      params.push(filter_dateTo);
    }

    // Roll number status filter
    if (filter_rollNumberStatus === 'assigned') {
      query += ' AND roll_number IS NOT NULL';
    } else if (filter_rollNumberStatus === 'unassigned') {
      query += ' AND roll_number IS NULL';
    }

    // Dynamic field filters (e.g., filter_field_Admission category)
    Object.entries(otherFilters).forEach(([key, value]) => {
      if (key.startsWith('filter_field_') && value) {
        const fieldName = key.replace('filter_field_', '');
        // Escape field name for JSON path (handle spaces and special chars)
        const escapedFieldName = fieldName.replace(/"/g, '\\"');
        query += ` AND JSON_UNQUOTE(JSON_EXTRACT(student_data, '$."${escapedFieldName}"')) = ?`;
        params.push(value);
      }
    });

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [students] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (admission_number LIKE ? OR roll_number LIKE ? OR student_data LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Apply same filters to count query
    if (filter_dateFrom) {
      countQuery += ' AND DATE(created_at) >= ?';
      countParams.push(filter_dateFrom);
    }

    if (filter_dateTo) {
      countQuery += ' AND DATE(created_at) <= ?';
      countParams.push(filter_dateTo);
    }

    if (filter_rollNumberStatus === 'assigned') {
      countQuery += ' AND roll_number IS NOT NULL';
    } else if (filter_rollNumberStatus === 'unassigned') {
      countQuery += ' AND roll_number IS NULL';
    }

    // Apply dynamic field filters to count query
    Object.entries(otherFilters).forEach(([key, value]) => {
      if (key.startsWith('filter_field_') && value) {
        const fieldName = key.replace('filter_field_', '');
        // Escape field name for JSON path (handle spaces and special chars)
        const escapedFieldName = fieldName.replace(/"/g, '\\"');
        countQuery += ` AND JSON_UNQUOTE(JSON_EXTRACT(student_data, '$."${escapedFieldName}"')) = ?`;
        countParams.push(value);
      }
    });

    const [countResult] = await pool.query(countQuery, countParams);

    // Parse JSON fields
    const parsedStudents = students.map(student => ({
      ...student,
      student_data: parseJSON(student.student_data)
    }));

    res.json({
      success: true,
      data: parsedStudents,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching students' 
    });
  }
};

// Get student by admission number
exports.getStudentByAdmission = async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    const [students] = await pool.query(
      'SELECT * FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    const student = {
      ...students[0],
      student_data: parseJSON(students[0].student_data)
    };

    res.json({
      success: true,
      data: student
    });

  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching student' 
    });
  }
};

// Update student data
exports.updateStudent = async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { studentData } = req.body;

    if (!studentData || typeof studentData !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Student data is required' 
      });
    }

    const [result] = await pool.query(
      'UPDATE students SET student_data = ? WHERE admission_number = ?',
      [JSON.stringify(studentData), admissionNumber]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE', 'STUDENT', admissionNumber, req.admin.id, JSON.stringify(studentData)]
    );

    res.json({
      success: true,
      message: 'Student data updated successfully'
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating student' 
    });
  }
};

// Update student roll number
exports.updateRollNumber = async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { rollNumber } = req.body;

    if (!rollNumber || typeof rollNumber !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Roll number is required' 
      });
    }

    // Check if roll number already exists for another student
    const [existing] = await pool.query(
      'SELECT admission_number FROM students WHERE roll_number = ? AND admission_number != ?',
      [rollNumber.trim(), admissionNumber]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Roll number '${rollNumber}' is already assigned to another student` 
      });
    }

    const [result] = await pool.query(
      'UPDATE students SET roll_number = ? WHERE admission_number = ?',
      [rollNumber.trim(), admissionNumber]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE_ROLL_NUMBER', 'STUDENT', admissionNumber, req.admin.id, JSON.stringify({ rollNumber })]
    );

    res.json({
      success: true,
      message: 'Roll number updated successfully'
    });

  } catch (error) {
    console.error('Update roll number error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating roll number' 
    });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    const [result] = await pool.query(
      'DELETE FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id) 
       VALUES (?, ?, ?, ?)`,
      ['DELETE', 'STUDENT', admissionNumber, req.admin.id]
    );

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting student' 
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total students
    const [studentCount] = await pool.query('SELECT COUNT(*) as total FROM students');
    
    // Get total forms
    const [formCount] = await pool.query('SELECT COUNT(*) as total FROM forms');
    
    // Get pending submissions
    const [pendingCount] = await pool.query(
      'SELECT COUNT(*) as total FROM form_submissions WHERE status = "pending"'
    );
    
    // Get approved submissions today
    const [approvedToday] = await pool.query(
      `SELECT COUNT(*) as total FROM form_submissions 
       WHERE status = "approved" AND DATE(reviewed_at) = CURDATE()`
    );

    // Get recent submissions
    const [recentSubmissions] = await pool.query(
      `SELECT fs.submission_id, fs.admission_number, fs.status, fs.submitted_at, f.form_name
       FROM form_submissions fs
       LEFT JOIN forms f ON fs.form_id = f.form_id
       ORDER BY fs.submitted_at DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalStudents: studentCount[0].total,
        totalForms: formCount[0].total,
        pendingSubmissions: pendingCount[0].total,
        approvedToday: approvedToday[0].total,
        recentSubmissions
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching dashboard statistics' 
    });
  }
};

// Bulk update roll numbers
exports.bulkUpdateRollNumbers = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    // Parse CSV file
    const results = [];
    const errors = [];
    let rowNumber = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          // Skip comment lines
          if (!data.admission_number || data.admission_number.startsWith('#')) {
            return;
          }
          results.push({ row: rowNumber, data });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    await connection.beginTransaction();

    let successCount = 0;
    let failedCount = 0;
    let notFoundCount = 0;

    for (const result of results) {
      try {
        const { row, data } = result;
        const admissionNumber = data.admission_number?.toString().trim();
        const rollNumber = data.roll_number?.toString().trim();
        
        console.log(`Processing row ${row}: admission=${admissionNumber}, roll=${rollNumber}`);
        
        if (!admissionNumber) {
          errors.push({ row, message: 'Missing admission_number' });
          failedCount++;
          continue;
        }

        if (!rollNumber) {
          errors.push({ row, message: 'Missing roll_number' });
          failedCount++;
          continue;
        }

        // Update student roll number
        const [updateResult] = await connection.query(
          'UPDATE students SET roll_number = ? WHERE admission_number = ?',
          [rollNumber, admissionNumber]
        );

        console.log(`Update result for ${admissionNumber}: affected rows = ${updateResult.affectedRows}`);

        if (updateResult.affectedRows === 0) {
          errors.push({ row, message: `Student with admission number '${admissionNumber}' not found in database` });
          notFoundCount++;
          failedCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing row ${result.row}:`, error);
        errors.push({ row: result.row, message: error.message });
        failedCount++;
      }
    }

    await connection.commit();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['BULK_UPDATE_ROLL_NUMBERS', 'STUDENT', 'bulk', req.admin.id, 
       JSON.stringify({ successCount, failedCount, notFoundCount, totalRows: results.length })]
    );

    res.json({
      success: true,
      message: `Bulk update completed. ${successCount} roll numbers updated, ${failedCount} failed.`,
      successCount,
      failedCount,
      notFoundCount,
      errors: errors.slice(0, 20) // Limit errors to first 20
    });

  } catch (error) {
    await connection.rollback();
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Bulk update roll numbers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk update'
    });
  } finally {
    connection.release();
  }
};

// Export multer middleware
exports.uploadMiddleware = upload.single('file');
