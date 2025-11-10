const { masterPool, stagingPool } = require('../config/database');
const { supabase } = require('../config/supabase');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const {
  getNextStage,
  normalizeStage
} = require('../services/academicProgression');

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

const YEAR_KEYS = [
  'current_year',
  'Current Year',
  'Current Academic Year',
  'year',
  'Year',
  'currentYear'
];

const SEMESTER_KEYS = [
  'current_semester',
  'Current Semester',
  'semester',
  'Semester',
  'currentSemester'
];

const resolveStageFromData = (data, fallbackStage = { year: 1, semester: 1 }) => {
  if (!data || typeof data !== 'object') {
    return fallbackStage;
  }

  const yearValue = YEAR_KEYS.map(key => data[key])
    .find(value => value !== undefined && value !== null && value !== '');
  const semesterValue = SEMESTER_KEYS.map(key => data[key])
    .find(value => value !== undefined && value !== null && value !== '');

  if (yearValue !== undefined && semesterValue !== undefined) {
    try {
      return normalizeStage(yearValue, semesterValue);
    } catch (error) {
      if (error.message === 'INVALID_STAGE') {
        return fallbackStage;
      }
      throw error;
    }
  }

  return fallbackStage;
};

const applyStageToPayload = (payload, stage) => {
  if (!stage) {
    return;
  }

  payload.current_year = stage.year;
  payload.current_semester = stage.semester;
  payload['Current Academic Year'] = stage.year;
  payload['Current Semester'] = stage.semester;
};

const FIELD_MAPPING = {
  // Student form fields
  'Student Name': 'student_name',
  'Student Mobile Number': 'student_mobile',
  'Father Name': 'father_name',
  'DOB (Date of Birth - DD-MM-YYYY)': 'dob',
  'ADHAR No': 'adhar_no',
  'Admission Date': 'admission_date',
  'Admission No': 'admission_no',
  'Batch': 'batch',
  'Branch': 'branch',
  'StudType': 'stud_type',
  'Current Academic Year': 'current_year',
  'Current Year': 'current_year',
  current_year: 'current_year',
  currentYear: 'current_year',
  Course: 'course',
  course: 'course',
  'Current Semester': 'current_semester',
  current_semester: 'current_semester',
  currentSemester: 'current_semester',
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
  pin_no: 'pin_no',
  previous_college: 'previous_college',
  certificates_status: 'certificates_status',
  student_photo: 'student_photo',
  student_name: 'student_name',
  student_mobile: 'student_mobile',
  father_name: 'father_name',
  dob: 'dob',
  adhar_no: 'adhar_no',
  admission_date: 'admission_date',
  admission_no: 'admission_no',
  batch: 'batch',
  branch: 'branch',
  stud_type: 'stud_type',
  parent_mobile1: 'parent_mobile1',
  parent_mobile2: 'parent_mobile2',
  student_address: 'student_address',
  city_village: 'city_village',
  mandal_name: 'mandal_name',
  district: 'district',
  caste: 'caste',
  gender: 'gender',
  student_status: 'student_status',
  scholar_status: 'scholar_status',
  remarks: 'remarks',
  current_year: 'current_year',
  current_semester: 'current_semester'
};

const updateStagingStudentStage = async (admissionNumber, stage, studentData) => {
  if (!stagingPool || !stage || !admissionNumber) {
    return;
  }

  try {
    await stagingPool.query(
      `UPDATE students
       SET current_year = ?, current_semester = ?, student_data = ?
       WHERE admission_number = ? OR admission_no = ?`,
      [
        stage.year,
        stage.semester,
        studentData,
        admissionNumber,
        admissionNumber
      ]
    );
  } catch (error) {
    console.warn('Unable to update staging student stage:', error.message);
  }
};

const performPromotion = async ({ connection, admissionNumber, targetStage, adminId }) => {
  const [students] = await connection.query(
    `SELECT * FROM students WHERE admission_number = ? OR admission_no = ? FOR UPDATE`,
    [admissionNumber, admissionNumber]
  );

  if (students.length === 0) {
    return { status: 'NOT_FOUND' };
  }

  const student = students[0];
  const parsedStudentData = parseJSON(student.student_data) || {};

  const currentStage = resolveStageFromData(parsedStudentData, {
    year: student.current_year || 1,
    semester: student.current_semester || 1
  });

  let nextStage = targetStage;

  if (!nextStage) {
    nextStage = getNextStage(currentStage.year, currentStage.semester);

    if (!nextStage) {
      return { status: 'MAX_STAGE', student, currentStage };
    }
  }

  applyStageToPayload(parsedStudentData, nextStage);
  const serializedStudentData = JSON.stringify(parsedStudentData);

  await connection.query(
    `UPDATE students
     SET current_year = ?, current_semester = ?, student_data = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextStage.year, nextStage.semester, serializedStudentData, student.id]
  );

  await connection.query(
    `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'PROMOTE',
      'STUDENT',
      student.admission_number || admissionNumber,
      adminId,
      JSON.stringify({
        from: currentStage,
        to: nextStage
      })
    ]
  );

  return {
    status: 'SUCCESS',
    student,
    currentStage,
    nextStage,
    serializedStudentData,
    parsedStudentData
  };
};

// Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const {
      search,
      limit,
      offset = 0,
      filter_dateFrom,
      filter_dateTo,
      filter_pinNumberStatus,
      filter_year,
      filter_semester,
      ...otherFilters
    } = req.query;

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];
    const fetchAll = !limit || limit === 'all';
    const pageSize = !fetchAll ? parseInt(limit, 10) : null;
    const pageOffset = fetchAll ? 0 : parseInt(offset, 10);

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

    const parsedFilterYear = filter_year !== undefined ? parseInt(filter_year, 10) : null;
    const parsedFilterSemester = filter_semester !== undefined ? parseInt(filter_semester, 10) : null;

    if (parsedFilterYear && !isNaN(parsedFilterYear)) {
      query += ' AND current_year = ?';
      params.push(parsedFilterYear);
    }

    if (parsedFilterSemester && !isNaN(parsedFilterSemester)) {
      query += ' AND current_semester = ?';
      params.push(parsedFilterSemester);
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

    query += ' ORDER BY created_at DESC';
    if (!fetchAll) {
      query += ' LIMIT ? OFFSET ?';
      params.push(pageSize, pageOffset);
    }

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

    if (parsedFilterYear && !isNaN(parsedFilterYear)) {
      countQuery += ' AND current_year = ?';
      countParams.push(parsedFilterYear);
    }

    if (parsedFilterSemester && !isNaN(parsedFilterSemester)) {
      countQuery += ' AND current_semester = ?';
      countParams.push(parsedFilterSemester);
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
    const parsedStudents = students.map(student => {
      const parsedData = parseJSON(student.student_data) || {};
      const stage = resolveStageFromData(parsedData, {
        year: student.current_year || 1,
        semester: student.current_semester || 1
      });

      applyStageToPayload(parsedData, stage);

      return {
        ...student,
        current_year: stage.year,
        current_semester: stage.semester,
        student_data: parsedData
      };
    });

    res.json({
      success: true,
      data: parsedStudents,
      pagination: {
        total: countResult[0].total,
        limit: fetchAll ? null : pageSize,
        offset: fetchAll ? 0 : pageOffset
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

    const parsedData = parseJSON(students[0].student_data) || {};
    const stage = resolveStageFromData(parsedData, {
      year: students[0].current_year || 1,
      semester: students[0].current_semester || 1
    });

    applyStageToPayload(parsedData, stage);

    const student = {
      ...students[0],
      current_year: stage.year,
      current_semester: stage.semester,
      student_data: parsedData
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
    // Build update query for individual columns
    const updateFields = [];
    const updateValues = [];

    // Update individual columns based on the field mapping
    const mutableStudentData = { ...studentData };

    let resolvedStage;
    try {
      resolvedStage = resolveStageFromData(mutableStudentData, {
        year: existingStudent.current_year || 1,
        semester: existingStudent.current_semester || 1
      });
    } catch (error) {
      if (error.message === 'INVALID_STAGE') {
        return res.status(400).json({
          success: false,
          message: 'Invalid academic stage provided. Year must be 1-4 and semester must be 1-2.'
        });
      }
      throw error;
    }

    applyStageToPayload(mutableStudentData, resolvedStage);

    const updatedColumns = new Set();

    Object.entries(mutableStudentData).forEach(([key, value]) => {
      const columnName = FIELD_MAPPING[key];
      if (
        columnName &&
        !updatedColumns.has(columnName) &&
        value !== undefined &&
        value !== '' &&
        value !== '{}' &&
        value !== null
      ) {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value);
        updatedColumns.add(columnName);
      }
    });

    // Always update the JSON data field
    const serializedStudentData = JSON.stringify(mutableStudentData);
    updateFields.push('student_data = ?');
    updateValues.push(serializedStudentData);
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
      ['UPDATE', 'STUDENT', admissionNumber, req.admin.id, serializedStudentData]
    );

    await updateStagingStudentStage(admissionNumber, resolvedStage, serializedStudentData);

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

// Bulk delete students
exports.bulkDeleteStudents = async (req, res) => {
  try {
    const { admissionNumbers } = req.body || {};

    if (!Array.isArray(admissionNumbers) || admissionNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'admissionNumbers array is required'
      });
    }

    const normalized = Array.from(
      new Set(
        admissionNumbers
          .map((value) => (value !== undefined && value !== null ? String(value).trim() : ''))
          .filter((value) => value.length > 0)
      )
    );

    if (normalized.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid admission numbers provided'
      });
    }

    const placeholders = normalized.map(() => '?').join(',');
    const [existingRows] = await masterPool.query(
      `SELECT admission_number FROM students WHERE admission_number IN (${placeholders})`,
      normalized
    );

    const existingNumbers = existingRows.map((row) => row.admission_number);
    const existingSet = new Set(existingNumbers);
    const notFound = normalized.filter((value) => !existingSet.has(value));

    if (existingNumbers.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        notFound
      });
    }

    const deletePlaceholders = existingNumbers.map(() => '?').join(',');
    const [deleteResult] = await masterPool.query(
      `DELETE FROM students WHERE admission_number IN (${deletePlaceholders})`,
      existingNumbers
    );

    const deletedCount = deleteResult.affectedRows || 0;

    if (deletedCount > 0) {
      await masterPool.query(
        `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          'BULK_DELETE',
          'STUDENT',
          'bulk',
          req.admin?.id || null,
          JSON.stringify({ admissionNumbers: existingNumbers })
        ]
      );
    }

    return res.json({
      success: true,
      deletedCount,
      notFound,
      deletedAdmissionNumbers: existingNumbers
    });
  } catch (error) {
    console.error('Bulk delete students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk delete'
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
exports.getDashboardStats = async (_req, res) => {
  const safeSupabaseCount = async (promise, label) => {
    try {
      const { count, error } = await promise;
      if (error) {
        console.warn(`Dashboard stats: unable to fetch ${label}`, error.message || error);
        return 0;
      }
      return count || 0;
    } catch (error) {
      console.warn(`Dashboard stats: unexpected error while fetching ${label}`, error.message || error);
      return 0;
    }
  };

  try {
    let totalStudents = 0;
    let masterDbConnected = true;

    try {
      const [studentCount] = await masterPool.query('SELECT COUNT(*) as total FROM students');
      totalStudents = studentCount?.[0]?.total || 0;
    } catch (dbError) {
      masterDbConnected = false;
      console.warn('Dashboard stats: master database unavailable, returning fallback totals', dbError.message || dbError);
    }

    const totalForms = await safeSupabaseCount(
      supabase.from('forms').select('*', { count: 'exact', head: true }),
      'forms count'
    );

    const pendingSubmissions = await safeSupabaseCount(
      supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      'pending submissions count'
    );

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const approvedToday = await safeSupabaseCount(
      supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('reviewed_at', start.toISOString()),
      'approved submissions count'
    );

    let recentWithNames = [];
    try {
      const { data: recentSubmissions, error: recentError } = await supabase
        .from('form_submissions')
        .select('submission_id, admission_number, status, created_at as submitted_at, form_id')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) {
        console.warn('Dashboard stats: unable to fetch recent submissions', recentError.message || recentError);
      } else if (recentSubmissions) {
        recentWithNames = [...recentSubmissions];
        const formIds = Array.from(new Set(recentSubmissions.map((r) => r.form_id))).filter(Boolean);

        if (formIds.length > 0) {
          const { data: formsRows, error: formsError } = await supabase
            .from('forms')
            .select('form_id, form_name')
            .in('form_id', formIds);

          if (formsError) {
            console.warn('Dashboard stats: unable to attach form names', formsError.message || formsError);
          } else if (formsRows) {
            const idToName = new Map(formsRows.map((f) => [f.form_id, f.form_name]));
            recentWithNames = recentWithNames.map((r) => ({
              ...r,
              form_name: idToName.get(r.form_id) || null,
              submitted_at: r.created_at
            }));
          }
        }
      }
    } catch (supabaseError) {
      console.warn('Dashboard stats: unexpected error while preparing recent submissions', supabaseError.message || supabaseError);
      recentWithNames = [];
    }

    res.json({
      success: true,
      data: {
        totalStudents,
        totalForms,
        pendingSubmissions,
        approvedToday,
        recentSubmissions: recentWithNames,
        completedProfiles: 0,
        averageCompletion: 0,
        masterDbConnected
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
    const incomingData =
      req.body.studentData && typeof req.body.studentData === 'object'
        ? { ...req.body.studentData }
        : { ...req.body };

    delete incomingData.studentData;

    const admissionNumber =
      req.body.admissionNumber ||
      req.body.admission_no ||
      incomingData.admission_number ||
      incomingData.admission_no;

    if (!admissionNumber) {
      return res.status(400).json({
        success: false,
        message: 'Admission number is required'
      });
    }

    delete incomingData.admissionNumber;

    incomingData.admission_number = admissionNumber;
    if (!incomingData.admission_no) {
      incomingData.admission_no = admissionNumber;
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

    let resolvedStage;
    try {
      resolvedStage = resolveStageFromData(incomingData, {
        year: incomingData.current_year || 1,
        semester: incomingData.current_semester || 1
      });
    } catch (error) {
      if (error.message === 'INVALID_STAGE') {
        return res.status(400).json({
          success: false,
          message: 'Invalid academic stage provided. Year must be 1-4 and semester must be 1-2.'
        });
      }
      throw error;
    }

    applyStageToPayload(incomingData, resolvedStage);

    const serializedStudentData = JSON.stringify(incomingData);

    const insertColumns = ['admission_number', 'current_year', 'current_semester', 'student_data'];
    const insertPlaceholders = ['?', '?', '?', '?'];
    const insertValues = [admissionNumber, resolvedStage.year, resolvedStage.semester, serializedStudentData];

    const updatedColumns = new Set(['admission_number', 'current_year', 'current_semester']);

    Object.entries(incomingData).forEach(([key, value]) => {
      const columnName = FIELD_MAPPING[key];
      if (
        columnName &&
        !updatedColumns.has(columnName) &&
        value !== undefined &&
        value !== '' &&
        value !== '{}' &&
        value !== null
      ) {
        insertColumns.push(columnName);
        insertPlaceholders.push('?');
        insertValues.push(value);
        updatedColumns.add(columnName);
      }
    });

    const insertQuery = `INSERT INTO students (${insertColumns.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;
    await masterPool.query(insertQuery, insertValues);

    // Fetch the created student data
    const [createdStudents] = await masterPool.query(
      'SELECT * FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    const createdStudent = {
      ...createdStudents[0],
      student_data: parseJSON(createdStudents[0].student_data)
    };

    await updateStagingStudentStage(admissionNumber, resolvedStage, serializedStudentData);

    // Log action
    await masterPool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      ['CREATE', 'STUDENT', admissionNumber, req.admin.id, serializedStudentData]
    );

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: createdStudent
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating student'
    });
  }
};

// Promote single student to next academic stage (or specified stage)
exports.promoteStudent = async (req, res) => {
  const connection = await masterPool.getConnection();
  const { admissionNumber } = req.params;
  const { targetYear, targetSemester } = req.body || {};

  let targetStage = null;

  if (targetYear !== undefined || targetSemester !== undefined) {
    if (targetYear === undefined || targetSemester === undefined) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Both targetYear and targetSemester are required to set a specific academic stage'
      });
    }

    try {
      targetStage = normalizeStage(targetYear, targetSemester);
    } catch (error) {
      if (error.message === 'INVALID_STAGE') {
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Invalid academic stage provided. Year must be 1-4 and semester must be 1-2.'
        });
      }
      throw error;
    }
  }

  try {
    await connection.beginTransaction();

    const promotionResult = await performPromotion({
      connection,
      admissionNumber,
      targetStage,
      adminId: req.admin?.id || null
    });

    if (promotionResult.status === 'NOT_FOUND') {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (promotionResult.status === 'MAX_STAGE') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Student is already at the final academic stage'
      });
    }

    await connection.commit();

    await updateStagingStudentStage(
      admissionNumber,
      promotionResult.nextStage,
      promotionResult.serializedStudentData
    );

    return res.json({
      success: true,
      message: 'Student promoted successfully',
      data: {
        admissionNumber: promotionResult.student.admission_number || admissionNumber,
        currentYear: promotionResult.nextStage.year,
        currentSemester: promotionResult.nextStage.semester
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Promote student error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while promoting student'
    });
  } finally {
    connection.release();
  }
};

// Bulk promotion endpoint
exports.bulkPromoteStudents = async (req, res) => {
  const { students } = req.body || {};

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'students array is required'
    });
  }

  const connection = await masterPool.getConnection();
  const results = [];

  try {
    for (const entry of students) {
      const admissionNumber = entry?.admissionNumber || entry?.admission_no;

      if (!admissionNumber) {
        results.push({
          admissionNumber: entry?.admissionNumber || null,
          status: 'error',
          message: 'Admission number is required'
        });
        continue;
      }

      let targetStage = null;
      if (entry.targetYear !== undefined || entry.targetSemester !== undefined) {
        if (entry.targetYear === undefined || entry.targetSemester === undefined) {
          results.push({
            admissionNumber,
            status: 'error',
            message: 'Both targetYear and targetSemester are required for manual stage assignment'
          });
          continue;
        }

        try {
          targetStage = normalizeStage(entry.targetYear, entry.targetSemester);
        } catch (error) {
          if (error.message === 'INVALID_STAGE') {
            results.push({
              admissionNumber,
              status: 'error',
              message: 'Invalid academic stage provided. Year must be 1-4 and semester must be 1-2.'
            });
            continue;
          }
          throw error;
        }
      }

      try {
        await connection.beginTransaction();
        const promotionResult = await performPromotion({
          connection,
          admissionNumber,
          targetStage,
          adminId: req.admin?.id || null
        });

        if (promotionResult.status === 'NOT_FOUND') {
          await connection.rollback();
          results.push({
            admissionNumber,
            status: 'error',
            message: 'Student not found'
          });
          continue;
        }

        if (promotionResult.status === 'MAX_STAGE') {
          await connection.rollback();
          results.push({
            admissionNumber,
            status: 'skipped',
            message: 'Student already at final academic stage'
          });
          continue;
        }

        await connection.commit();

        await updateStagingStudentStage(
          admissionNumber,
          promotionResult.nextStage,
          promotionResult.serializedStudentData
        );

        results.push({
          admissionNumber: promotionResult.student.admission_number || admissionNumber,
          status: 'success',
          currentYear: promotionResult.nextStage.year,
          currentSemester: promotionResult.nextStage.semester
        });
      } catch (error) {
        await connection.rollback();
        console.error('Bulk promotion error for student', admissionNumber, error);
        results.push({
          admissionNumber,
          status: 'error',
          message: 'Server error during promotion'
        });
      }
    }

    const hasSuccess = results.some(result => result.status === 'success');

    return res.status(hasSuccess ? 200 : 400).json({
      success: hasSuccess,
      results
    });
  } finally {
    connection.release();
  }
};

// Get available filter fields configuration
exports.getFilterFields = async (_req, res) => {
  try {
    const [existingConfigs] = await masterPool.query('SELECT * FROM filter_fields');
    res.json({
      success: true,
      data: existingConfigs.map((config) => ({
        name: config.field_name,
        type: config.field_type,
        enabled: config.enabled,
        required: config.required,
        options: parseJSON(config.options) || []
      }))
    });
  } catch (dbError) {
    console.error('Get filter fields error:', dbError);
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
