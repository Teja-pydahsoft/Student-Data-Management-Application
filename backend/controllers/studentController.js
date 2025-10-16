const { masterPool } = require('../config/database');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Export multer middleware at the top level
exports.uploadMiddleware = upload.single('file');

// Upload student photo
exports.uploadStudentPhoto = async (req, res) => {
  try {
    console.log('Photo upload request received');
    console.log('File:', req.file);
    console.log('Body:', req.body);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const { admissionNumber } = req.body;
    if (!admissionNumber) {
      return res.status(400).json({
        success: false,
        message: 'Admission number is required'
      });
    }

    // Generate unique filename
    const fileExtension = req.file.originalname.split('.').pop();
    const uniqueFilename = `student_${admissionNumber}_${Date.now()}.${fileExtension}`;

    // Move file to uploads folder with new name
    const fs = require('fs');
    const oldPath = req.file.path;
    const newPath = `uploads/${uniqueFilename}`;

    console.log('Moving file from:', oldPath, 'to:', newPath);

    fs.renameSync(oldPath, newPath);

    // Update student record with photo filename
    const [result] = await masterPool.query(
      'UPDATE students SET student_photo = ? WHERE admission_number = ?',
      [uniqueFilename, admissionNumber]
    );

    console.log('Database update result:', result);
    console.log('Updated photo filename to:', uniqueFilename);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        filename: uniqueFilename,
        path: newPath
      }
    });

  } catch (error) {
    console.error('Upload student photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading photo'
    });
  }
};

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
      query += ' AND (admission_number LIKE ? OR admission_no LIKE ? OR roll_number LIKE ? OR student_data LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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

    const [students] = await masterPool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (admission_number LIKE ? OR admission_no LIKE ? OR roll_number LIKE ? OR student_data LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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

    const [countResult] = await masterPool.query(countQuery, countParams);

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

    console.log('Update request for admission:', admissionNumber);
    console.log('Received studentData:', JSON.stringify(studentData, null, 2));

    if (!studentData || typeof studentData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Student data is required'
      });
    }

    // First, get the current student data to preserve existing individual columns
    const [existingStudents] = await masterPool.query(
      'SELECT * FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    if (existingStudents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const existingStudent = existingStudents[0];
    console.log('Existing student data:', JSON.stringify(existingStudent, null, 2));

    // Map form field names to database columns
    const fieldMapping = {
      // Student form fields
      'Student Name': 'student_name',
      'Student Mobile Number': 'student_mobile',
      'Father Name': 'father_name',
      'DOB (Date of Birth - DD-MM-YYYY)': 'dob',
      'ADHAR No': 'adhar_no',
      'Admission Date': 'admission_date',
      'Batch': 'batch',
      'Branch': 'branch',
      'StudType': 'stud_type',
      'Parent Mobile Number 1': 'parent_mobile1',
      'Parent Mobile Number 2': 'parent_mobile2',
      'Student Address (D.No, Str name, Village, Mandal, Dist)': 'student_address',
      'City/Village': 'city_village',
      'Mandal Name': 'mandal_name',
      'District': 'district',
      'Caste': 'caste',
      'M/F': 'gender',
      'Student Status': 'student_status',
      'Scholar Status': 'scholar_status',
      'Remarks': 'remarks',

      // Admin-only fields
      'pin_no': 'pin_no',
      'previous_college': 'previous_college',
      'certificates_status': 'certificates_status',
      'student_photo': 'student_photo'
    };

    // Build update query for individual columns
    const updateFields = [];
    const updateValues = [];

    // Update individual columns based on the field mapping
    Object.entries(studentData).forEach(([key, value]) => {
      const columnName = fieldMapping[key];
      if (columnName && value !== undefined && value !== '' && value !== '{}' && value !== null) {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value);
      }
    });

    // Always update the JSON data field
    updateFields.push('student_data = ?');
    updateValues.push(JSON.stringify(studentData));
    updateValues.push(admissionNumber);

    // Execute the update query
    const [result] = await masterPool.query(
      `UPDATE students SET ${updateFields.join(', ')} WHERE admission_number = ?`,
      updateValues
    );

    console.log('Update result:', result);
    console.log('Affected rows:', result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Verify the update by fetching the updated data
    const [updatedStudents] = await masterPool.query(
      'SELECT * FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    console.log('Updated student data:', JSON.stringify(updatedStudents[0], null, 2));

    // Log action
    await masterPool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE', 'STUDENT', admissionNumber, req.admin.id, JSON.stringify(studentData)]
    );

    console.log('Update completed successfully');

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
    const [existing] = await masterPool.query(
      'SELECT admission_number FROM students WHERE roll_number = ? AND admission_number != ?',
      [rollNumber.trim(), admissionNumber]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Roll number '${rollNumber}' is already assigned to another student`
      });
    }

    const [result] = await masterPool.query(
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
    await masterPool.query(
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

    const [result] = await masterPool.query(
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
    await masterPool.query(
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
    const [studentCount] = await masterPool.query('SELECT COUNT(*) as total FROM students');

    // Get total forms
    const [formCount] = await masterPool.query('SELECT COUNT(*) as total FROM forms');

    // Get pending submissions
    const { supabase } = require('../config/supabase');
    const { count: pendingTotal, error: pErr } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get approved submissions today
    const start = new Date();
    start.setHours(0,0,0,0);
    const { count: approvedTodayTotal, error: aErr } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('reviewed_at', start.toISOString());

    // Get recent submissions
    const { data: recentSubmissions, error: rErr } = await supabase
      .from('form_submissions')
      .select('submission_id, admission_number, status, created_at, form_id')
      .order('created_at', { ascending: false })
      .limit(10);

    // Attach form_name via a separate query
    let recentWithNames = recentSubmissions || [];
    const formIds = Array.from(new Set((recentSubmissions || []).map(r => r.form_id))).filter(Boolean);
    if (formIds.length > 0) {
      const { data: formsRows, error: fErr } = await supabase
        .from('forms')
        .select('form_id, form_name')
        .in('form_id', formIds);
      if (!fErr && formsRows) {
        const idToName = new Map(formsRows.map(f => [f.form_id, f.form_name]));
        recentWithNames = recentWithNames.map(r => ({ ...r, form_name: idToName.get(r.form_id) || null }));
      }
    }

    // Calculate completed profiles and average completion
    let completedProfiles = 0;
    let totalCompletion = 0;

    if (studentCount[0].total > 0) {
      // Get all students to calculate completion percentages
      const [students] = await masterPool.query('SELECT admission_number FROM students');

      for (const student of students) {
        try {
          // Get completion status for each student
          const { data: completionData, error: compErr } = await supabase
            .from('form_submissions')
            .select('submission_id, form_id, submission_data')
            .eq('admission_number', student.admission_number)
            .limit(1);

          if (!compErr && completionData && completionData.length > 0) {
            const submission = completionData[0];
            const submissionData = parseJSON(submission.submission_data);

            // Get form fields to determine total fields
            const { data: forms, error: formErr } = await supabase
              .from('forms')
              .select('form_fields')
              .eq('form_id', submission.form_id)
              .limit(1);

            if (!formErr && forms && forms.length > 0) {
              const formFields = parseJSON(forms[0].form_fields);
              const allFields = formFields.filter(field => field.key);

              const completedFields = allFields.filter(field => {
                const value = submissionData[field.key];
                return value !== undefined && value !== null && value !== '';
              }).length;

              const completionPercentage = allFields.length > 0 ? Math.round((completedFields / allFields.length) * 100) : 0;
              totalCompletion += completionPercentage;

              if (completionPercentage >= 80) {
                completedProfiles++;
              }
            }
          }
        } catch (error) {
          console.error(`Error calculating completion for student ${student.admission_number}:`, error);
        }
      }
    }

    const averageCompletion = studentCount[0].total > 0 ? Math.round(totalCompletion / studentCount[0].total) : 0;

    res.json({
      success: true,
      data: {
        totalStudents: studentCount[0].total,
        totalForms: formCount[0].total,
        pendingSubmissions: pendingTotal || 0,
        approvedToday: approvedTodayTotal || 0,
        recentSubmissions: recentWithNames,
        completedProfiles,
        averageCompletion
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

// Create student (manual entry)
exports.createStudent = async (req, res) => {
  try {
    const { admissionNumber, studentData } = req.body;

    if (!admissionNumber || !studentData || typeof studentData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Admission number and student data are required'
      });
    }

    // Check if student already exists
    const [existing] = await masterPool.query(
      'SELECT admission_number FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Student with this admission number already exists'
      });
    }

    // Insert new student
    await masterPool.query(
      'INSERT INTO students (admission_number, student_data) VALUES (?, ?)',
      [admissionNumber, JSON.stringify(studentData)]
    );

    // Log action
    await masterPool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['CREATE', 'STUDENT', admissionNumber, req.admin.id, JSON.stringify(studentData)]
    );

    res.status(201).json({
      success: true,
      message: 'Student created successfully'
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating student'
    });
  }
};

// Bulk update roll numbers
exports.bulkUpdateRollNumbers = async (req, res) => {
  const connection = await masterPool.getConnection();

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
    await masterPool.query(
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
