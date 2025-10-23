const { masterPool } = require('../config/database');
const { supabase } = require('../config/supabase');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Export multer middleware at the top level
exports.uploadMiddleware = upload.single('file');

// Upload student photo to MySQL database
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

    // Read file and convert to base64
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Image = fileBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Create data URL for the image
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log('Image converted to base64, size:', base64Image.length);

    // Update student record with base64 image data
    const [result] = await masterPool.query(
      'UPDATE students SET student_photo = ? WHERE admission_number = ?',
      [imageDataUrl, admissionNumber]
    );

    console.log('Database update result:', result);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Log the successful upload (minimal logging to reduce clutter)
    console.log(`✅ Photo uploaded for student ${admissionNumber} (${(base64Image.length / 1024).toFixed(2)} KB)`);

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Photo uploaded successfully to MySQL database',
      data: {
        student_admission_number: admissionNumber,
        image_size: `${(base64Image.length / 1024).toFixed(2)} KB`,
        image_type: mimeType,
        storage: 'mysql'
      }
    });

  } catch (error) {
    console.error('Upload student photo error:', error);

    // Clean up temporary file if it exists
    if (req.file && req.file.path && require('fs').existsSync(req.file.path)) {
      require('fs').unlinkSync(req.file.path);
    }

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
    const { search, limit = 50, offset = 0, filter_dateFrom, filter_dateTo, filter_pinNumberStatus, ...otherFilters } = req.query;

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (admission_number LIKE ? OR admission_no LIKE ? OR pin_no LIKE ? OR student_data LIKE ?)';
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

    // PIN number status filter
    if (filter_pinNumberStatus === 'assigned') {
      query += ' AND pin_no IS NOT NULL';
    } else if (filter_pinNumberStatus === 'unassigned') {
      query += ' AND pin_no IS NULL';
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
      countQuery += ' AND (admission_number LIKE ? OR admission_no LIKE ? OR pin_no LIKE ? OR student_data LIKE ?)';
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

    if (filter_pinNumberStatus === 'assigned') {
      countQuery += ' AND pin_no IS NOT NULL';
    } else if (filter_pinNumberStatus === 'unassigned') {
      countQuery += ' AND pin_no IS NULL';
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

// Update student PIN number
exports.updatePinNumber = async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { pinNumber } = req.body;

    if (!pinNumber || typeof pinNumber !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'PIN number is required'
      });
    }

    // Check if PIN number already exists for another student
    const [existing] = await masterPool.query(
      'SELECT admission_number FROM students WHERE pin_no = ? AND admission_number != ?',
      [pinNumber.trim(), admissionNumber]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `PIN number '${pinNumber}' is already assigned to another student`
      });
    }

    const [result] = await masterPool.query(
      'UPDATE students SET pin_no = ? WHERE admission_number = ?',
      [pinNumber.trim(), admissionNumber]
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
      ['UPDATE_PIN_NUMBER', 'STUDENT', admissionNumber, req.admin.id, JSON.stringify({ pinNumber })]
    );

    res.json({
      success: true,
      message: 'PIN number updated successfully'
    });

  } catch (error) {
    console.error('Update PIN number error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating PIN number'
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

    // Get total forms from Supabase (since forms are stored in Supabase)
    const { count: formCountTotal, error: formErr } = await supabase
      .from('forms')
      .select('*', { count: 'exact', head: true });

    // Get pending submissions
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
      .select('submission_id, admission_number, status, created_at as submitted_at, form_id')
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
        recentWithNames = recentWithNames.map(r => ({ ...r, form_name: idToName.get(r.form_id) || null, submitted_at: r.created_at }));
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
        totalForms: formCountTotal || 0,
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

// Get available filter fields configuration
exports.getFilterFields = async (req, res) => {
  try {
    // First, get all unique field names from existing student data
    const [results] = await masterPool.query(
      'SELECT DISTINCT student_data FROM students WHERE student_data IS NOT NULL LIMIT 100'
    );

    // Extract all unique field names from student data
    const fieldMap = {};

    results.forEach(row => {
      try {
        const studentData = parseJSON(row.student_data);
        Object.keys(studentData).forEach(key => {
          if (!fieldMap[key]) {
            fieldMap[key] = {
              name: key,
              type: 'text',
              enabled: true,
              required: false,
              options: []
            };
          }
        });
      } catch (error) {
        console.error('Error parsing student data:', error);
      }
    });

    // Get existing filter field configurations from database
    const [existingConfigs] = await masterPool.query(
      'SELECT * FROM filter_fields'
    );

    // Merge dynamic fields with saved configurations
    const fields = Object.values(fieldMap).map(field => {
      const existingConfig = existingConfigs.find(config => config.field_name === field.name);
      if (existingConfig) {
        return {
          name: existingConfig.field_name,
          type: existingConfig.field_type,
          enabled: existingConfig.enabled,
          required: existingConfig.required,
          options: parseJSON(existingConfig.options) || []
        };
      }
      return field;
    });

    // Add any saved configurations for fields that might not exist in current data
    existingConfigs.forEach(config => {
      if (!fieldMap[config.field_name]) {
        fields.push({
          name: config.field_name,
          type: config.field_type,
          enabled: config.enabled,
          required: config.required,
          options: parseJSON(config.options) || []
        });
      }
    });

    res.json({
      success: true,
      data: fields
    });

  } catch (error) {
    console.error('Get filter fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching filter fields'
    });
  }
};

// Add or update filter field configuration
exports.updateFilterField = async (req, res) => {
  try {
    const { fieldName } = req.params;
    const { enabled, type, required, options } = req.body;

    if (!fieldName) {
      return res.status(400).json({
        success: false,
        message: 'Field name is required'
      });
    }

    // Check if configuration already exists
    const [existing] = await masterPool.query(
      'SELECT id FROM filter_fields WHERE field_name = ?',
      [fieldName]
    );

    const configData = {
      field_type: type || 'text',
      enabled: enabled !== undefined ? enabled : true,
      required: required || false,
      options: JSON.stringify(options || [])
    };

    if (existing.length > 0) {
      // Update existing configuration
      await masterPool.query(
        'UPDATE filter_fields SET field_type = ?, enabled = ?, required = ?, options = ?, updated_at = CURRENT_TIMESTAMP WHERE field_name = ?',
        [configData.field_type, configData.enabled, configData.required, configData.options, fieldName]
      );
    } else {
      // Insert new configuration
      await masterPool.query(
        'INSERT INTO filter_fields (field_name, field_type, enabled, required, options) VALUES (?, ?, ?, ?, ?)',
        [fieldName, configData.field_type, configData.enabled, configData.required, configData.options]
      );
    }

    res.json({
      success: true,
      message: 'Filter field configuration updated successfully',
      data: {
        fieldName,
        enabled: configData.enabled,
        type: configData.field_type,
        required: configData.required,
        options: options || []
      }
    });

  } catch (error) {
    console.error('Update filter field error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating filter field'
    });
  }
};

// Bulk update PIN numbers
exports.bulkUpdatePinNumbers = async (req, res) => {
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
        const pinNumber = data.pin_number?.toString().trim();

        console.log(`Processing row ${row}: admission=${admissionNumber}, pin=${pinNumber}`);

        if (!admissionNumber) {
          errors.push({ row, message: 'Missing admission_number' });
          failedCount++;
          continue;
        }

        if (!pinNumber) {
          errors.push({ row, message: 'Missing pin_number' });
          failedCount++;
          continue;
        }

        // Update student PIN number
        const [updateResult] = await connection.query(
          'UPDATE students SET pin_no = ? WHERE admission_number = ?',
          [pinNumber, admissionNumber]
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
      ['BULK_UPDATE_PIN_NUMBERS', 'STUDENT', 'bulk', req.admin.id,
       JSON.stringify({ successCount, failedCount, notFoundCount, totalRows: results.length })]
    );

    res.json({
      success: true,
      message: `Bulk update completed. ${successCount} PIN numbers updated, ${failedCount} failed.`,
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

    console.error('Bulk update PIN numbers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk update'
    });
  } finally {
    connection.release();
  }
};
