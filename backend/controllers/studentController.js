const { masterPool, stagingPool } = require('../config/database');
const { supabase } = require('../config/supabase');
const { studentsCache } = require('../services/cache');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const {
  getNextStage,
  normalizeStage
} = require('../services/academicProgression');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Export multer middleware at the top level
exports.uploadMiddleware = upload.single('file');

const clearStudentsCache = () => {
  if (studentsCache && typeof studentsCache.clear === 'function') {
    studentsCache.clear();
  }
};

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

    clearStudentsCache();

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
  'Admission Number': 'admission_number',
  'Batch': 'batch',
  'Branch': 'branch',
  'Branch Name': 'branch',
  branch_name: 'branch',
  'Branch Code': 'branch_code',
  'StudType': 'stud_type',
  'Current Academic Year': 'current_year',
  'Current Year': 'current_year',
  current_year: 'current_year',
  currentYear: 'current_year',
  Course: 'course',
  'Course Name': 'course',
  course: 'course',
  course_name: 'course',
  'Course Code': 'course_code',
  course_code: 'course_code',
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
  admission_number: 'admission_number',
  batch: 'batch',
  branch: 'branch',
  branch_code: 'branch_code',
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

const normalizeIdentifier = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const normalizeHeaderKeyForLookup = (header) => {
  if (header === undefined || header === null) {
    return '';
  }
  return header
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '_');
};

const FIELD_LOOKUP = Object.entries(FIELD_MAPPING).reduce((acc, [header, key]) => {
  const normalized = normalizeHeaderKeyForLookup(header);
  if (normalized && !acc[normalized]) {
    acc[normalized] = key;
  }
  return acc;
}, {});

const buildNormalizedSet = (...values) => {
  const set = new Set();
  values
    .filter((value) => value !== undefined && value !== null && value !== '')
    .forEach((value) => {
      const normalized = normalizeIdentifier(value);
      if (normalized) {
        set.add(normalized);
      }
    });
  return set;
};

const sanitizeCellValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toString();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value.toString().trim();
};

const normalizeAdmissionNumber = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return value.toString().trim().toUpperCase();
};

const getFirstNonEmpty = (...values) =>
  values.find((value) => value !== undefined && value !== null && `${value}`.trim() !== '');

const mapRowToStudentRecord = (row, rowNumber) => {
  const raw = {};
  const sanitized = {};

  Object.entries(row || {}).forEach(([header, rawValue]) => {
    if (!header || header.toString().trim() === '') {
      return;
    }
    const cleanedValue = sanitizeCellValue(rawValue);
    raw[header] = cleanedValue;

    const normalizedHeader = normalizeHeaderKeyForLookup(header);
    const mappedKey = FIELD_LOOKUP[normalizedHeader];
    if (mappedKey && cleanedValue !== '') {
      sanitized[mappedKey] = cleanedValue;
    }
  });

  if (sanitized.admission_no && !sanitized.admission_number) {
    sanitized.admission_number = sanitized.admission_no;
  }
  if (!sanitized.admission_no && sanitized.admission_number) {
    sanitized.admission_no = sanitized.admission_number;
  }

  Object.keys(sanitized).forEach((key) => {
    const value = sanitized[key];
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
      if (sanitized[key] === '') {
        delete sanitized[key];
      }
    }
  });

  return {
    rowNumber,
    raw,
    sanitized
  };
};

const fetchExistingAdmissionNumbers = async (admissionNumbers = []) => {
  const normalized = Array.from(
    new Set(
      admissionNumbers
        .map((value) => normalizeAdmissionNumber(value))
        .filter((value) => value !== '')
    )
  );

  if (normalized.length === 0) {
    return new Set();
  }

  const existingSet = new Set();
  const chunkSize = 100;
  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize);
    if (chunk.length === 0) {
      continue;
    }
    const placeholders = chunk.map(() => '?').join(', ');
    const [rows] = await masterPool.query(
      `SELECT admission_number FROM students WHERE UPPER(admission_number) IN (${placeholders})`,
      chunk
    );
    rows.forEach((row) => {
      if (row && row.admission_number) {
        existingSet.add(normalizeAdmissionNumber(row.admission_number));
      }
    });
  }

  return existingSet;
};

const buildCourseBranchIndex = async () => {
  const [courses] = await masterPool.query(
    'SELECT id, name, code FROM courses WHERE is_active = 1'
  );

  const baseIndex = {
    courses: [],
    courseLookup: new Map()
  };

  if (!courses || courses.length === 0) {
    return {
      ...baseIndex,
      findCourse: () => null,
      findBranch: () => null
    };
  }

  const courseMap = new Map();

  courses.forEach((course) => {
    const entry = {
      id: course.id,
      name: course.name,
      code: course.code,
      normalizedKeys: buildNormalizedSet(course.name, course.code),
      branchLookup: new Map(),
      branches: []
    };

    courseMap.set(course.id, entry);
    baseIndex.courses.push(entry);

    entry.normalizedKeys.forEach((key) => {
      if (key) {
        baseIndex.courseLookup.set(key, entry);
      }
    });
  });

  const courseIds = courses.map((course) => course.id);
  let branchRows = [];
  if (courseIds.length > 0) {
    const [branches] = await masterPool.query(
      'SELECT id, course_id, name, code FROM course_branches WHERE is_active = 1 AND course_id IN (?)',
      [courseIds]
    );
    branchRows = branches || [];
  }

  branchRows.forEach((branch) => {
    const courseEntry = courseMap.get(branch.course_id);
    if (!courseEntry) {
      return;
    }

    const branchEntry = {
      id: branch.id,
      courseId: branch.course_id,
      name: branch.name,
      code: branch.code,
      normalizedKeys: buildNormalizedSet(branch.name, branch.code)
    };

    courseEntry.branches.push(branchEntry);

    branchEntry.normalizedKeys.forEach((key) => {
      if (key) {
        courseEntry.branchLookup.set(key, branchEntry);
      }
    });
  });

  return {
    ...baseIndex,
    findCourse: (value) => {
      const normalized = normalizeIdentifier(value);
      if (!normalized) {
        return null;
      }
      return baseIndex.courseLookup.get(normalized) || null;
    },
    findBranch: (courseEntry, value) => {
      if (!courseEntry) {
        return null;
      }
      const normalized = normalizeIdentifier(value);
      if (!normalized) {
        return null;
      }
      return courseEntry.branchLookup.get(normalized) || null;
    }
  };
};

const validateCourseBranch = (payload, courseIndex) => {
  const issues = [];

  if (!payload || typeof payload !== 'object') {
    return {
      issues: ['Invalid student payload'],
      course: null,
      branch: null
    };
  }

  const courseIdentifier = getFirstNonEmpty(
    payload.course,
    payload.course_name,
    payload.course_code
  );
  const branchIdentifier = getFirstNonEmpty(
    payload.branch,
    payload.branch_name,
    payload.branch_code
  );

  let resolvedCourse = null;
  if (!courseIdentifier) {
    issues.push('Course is required');
  } else {
    resolvedCourse =
      courseIndex.findCourse(courseIdentifier) ||
      courseIndex.findCourse(payload.course_code);
    if (!resolvedCourse) {
      issues.push(
        `Course "${courseIdentifier}" does not match any active course`
      );
    }
  }

  let resolvedBranch = null;
  if (!branchIdentifier) {
    issues.push('Branch is required');
  } else if (resolvedCourse) {
    resolvedBranch =
      courseIndex.findBranch(resolvedCourse, branchIdentifier) ||
      courseIndex.findBranch(resolvedCourse, payload.branch_code);
    if (!resolvedBranch) {
      issues.push(
        `Branch "${branchIdentifier}" is not configured for course "${resolvedCourse.name}"`
      );
    }
  } else if (branchIdentifier) {
    issues.push('Branch could not be validated because course is invalid');
  }

  if (resolvedCourse) {
    payload.course = resolvedCourse.name;
    if (resolvedCourse.code) {
      payload.course_code = resolvedCourse.code;
    }
  }

  if (resolvedBranch) {
    payload.branch = resolvedBranch.name;
    if (resolvedBranch.code) {
      payload.branch_code = resolvedBranch.code;
    }
  }

  return {
    issues,
    course: resolvedCourse,
    branch: resolvedBranch
  };
};

const sanitizeStudentPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const sanitized = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '') {
        sanitized[key] = trimmed;
      }
      return;
    }
    if (value instanceof Date) {
      sanitized[key] = value.toISOString().split('T')[0];
      return;
    }
    sanitized[key] = value;
  });

  if (sanitized.admission_no && !sanitized.admission_number) {
    sanitized.admission_number = sanitized.admission_no;
  }
  if (!sanitized.admission_no && sanitized.admission_number) {
    sanitized.admission_no = sanitized.admission_number;
  }

  return sanitized;
};

let stagingSyncDisabled = false;
let stagingSyncWarningLogged = false;

const updateStagingStudentStage = async (admissionNumber, stage, studentData) => {
  if (!stagingPool || !stage || !admissionNumber || stagingSyncDisabled) {
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
    const databaseMissing =
      error?.code === 'ER_BAD_DB_ERROR' ||
      error?.code === 'ER_NO_DB_ERROR' ||
      /unknown database/i.test(error?.message || '');

    if (databaseMissing) {
      stagingSyncDisabled = true;
      if (!stagingSyncWarningLogged) {
        stagingSyncWarningLogged = true;
        console.warn(
          'Staging database not available. Student staging updates will be skipped for this session.'
        );
      }
      return;
    }

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

exports.previewBulkUploadStudents = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel or CSV file is required'
      });
    }

    filePath = req.file.path;

    const workbook = xlsx.readFile(filePath, { cellDates: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No sheets found in the uploaded file'
      });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });

    if (!rows || rows.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'No student rows found in the uploaded file'
      });
    }

    const headerRow = rows[0] || [];
    const headers = headerRow
      .map((header) => sanitizeCellValue(header))
      .filter((header) => header && header !== '__EMPTY');

    if (headers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file does not contain recognizable headers'
      });
    }

    const processedRows = [];
    for (let i = 1; i < rows.length; i++) {
      const rowValues = rows[i];
      if (!Array.isArray(rowValues)) {
        continue;
      }
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = rowValues[index];
      });
      const hasData = Object.values(rowData).some(
        (value) => sanitizeCellValue(value) !== ''
      );
      if (!hasData) {
        continue;
      }
      processedRows.push(mapRowToStudentRecord(rowData, i + 1));
    }

    if (processedRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file does not contain any student data rows'
      });
    }

    const uniqueAdmissionsForLookup = Array.from(
      new Set(
        processedRows
          .map((record) => normalizeAdmissionNumber(record.sanitized.admission_number))
          .filter((value) => value)
      )
    );

    const existingAdmissions = await fetchExistingAdmissionNumbers(uniqueAdmissionsForLookup);
    const courseIndex = await buildCourseBranchIndex();

    const seenAdmissions = new Map();
    const duplicateAdmissions = new Map();

    processedRows.forEach((record) => {
      const normalizedAdmission = normalizeAdmissionNumber(record.sanitized.admission_number);
      if (!normalizedAdmission) {
        return;
      }
      if (!seenAdmissions.has(normalizedAdmission)) {
        seenAdmissions.set(normalizedAdmission, record.rowNumber);
        return;
      }
      const duplicateSet =
        duplicateAdmissions.get(normalizedAdmission) ||
        new Set([seenAdmissions.get(normalizedAdmission)]);
      duplicateSet.add(record.rowNumber);
      duplicateAdmissions.set(normalizedAdmission, duplicateSet);
    });

    const duplicateAdmissionMap = new Map();
    duplicateAdmissions.forEach((set, admission) => {
      duplicateAdmissionMap.set(
        admission,
        Array.from(set).sort((a, b) => a - b)
      );
    });

    const validRecords = [];
    const invalidRecords = [];

    processedRows.forEach((record) => {
      const sanitized = { ...record.sanitized };
      Object.keys(sanitized).forEach((key) => {
        if (typeof sanitized[key] === 'string') {
          sanitized[key] = sanitized[key].trim();
        }
      });

      const issues = [];
      const normalizedAdmission = normalizeAdmissionNumber(sanitized.admission_number);

      if (!sanitized.admission_number) {
        issues.push('Admission number is required');
      }

      if (normalizedAdmission && duplicateAdmissionMap.has(normalizedAdmission)) {
        const rowsWithDuplicate = duplicateAdmissionMap.get(normalizedAdmission);
        issues.push(
          `Admission number appears multiple times in upload (rows: ${rowsWithDuplicate.join(', ')})`
        );
      }

      if (normalizedAdmission && existingAdmissions.has(normalizedAdmission)) {
        issues.push('Admission number already exists in the master database');
      }

      if (!sanitized.student_name) {
        issues.push('Student name is required');
      }

      const courseValidation = validateCourseBranch(sanitized, courseIndex);
      if (courseValidation.issues.length > 0) {
        issues.push(...courseValidation.issues);
      }

      const resultBase = {
        rowNumber: record.rowNumber,
        rawData: record.raw,
        sanitizedData: sanitized
      };

      if (issues.length === 0) {
        validRecords.push({
          ...resultBase,
          course: courseValidation.course
            ? {
                id: courseValidation.course.id,
                name: courseValidation.course.name,
                code: courseValidation.course.code || null
              }
            : null,
          branch: courseValidation.branch
            ? {
                id: courseValidation.branch.id,
                name: courseValidation.branch.name,
                code: courseValidation.branch.code || null
              }
            : null
        });
      } else {
        invalidRecords.push({
          ...resultBase,
          issues
        });
      }
    });

    const summary = {
      totalRows: processedRows.length,
      validCount: validRecords.length,
      invalidCount: invalidRecords.length,
      existingAdmissionCount: existingAdmissions.size,
      duplicateAdmissionCount: duplicateAdmissionMap.size
    };

    res.json({
      success: true,
      data: {
        summary,
        headers,
        validRecords,
        invalidRecords
      }
    });
  } catch (error) {
    console.error('Bulk student upload preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview bulk upload data',
      error: error.message
    });
  } finally {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn('Unable to remove uploaded file after preview:', unlinkError.message);
      }
    }
  }
};

exports.commitBulkUploadStudents = async (req, res) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];

  if (records.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No student records provided for upload'
    });
  }

  const preparedRecords = records
    .map((record) => ({
      rowNumber: record?.rowNumber,
      sanitizedData: sanitizeStudentPayload(
        record?.sanitizedData || record?.payload || record?.studentData || {}
      )
    }))
    .filter(
      (record) =>
        record.rowNumber !== undefined && Object.keys(record.sanitizedData).length > 0
    );

  if (preparedRecords.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid student records were provided'
    });
  }

  const admissionsForLookup = Array.from(
    new Set(
      preparedRecords
        .map((record) => normalizeAdmissionNumber(record.sanitizedData.admission_number))
        .filter((value) => value)
    )
  );

  const existingAdmissions = await fetchExistingAdmissionNumbers(admissionsForLookup);
  const courseIndex = await buildCourseBranchIndex();

  let connection;
  const successDetails = [];
  const failedDetails = [];

  let successCount = 0;
  let failedCount = 0;

  try {
    connection = await masterPool.getConnection();

    for (const record of preparedRecords) {
      const { rowNumber } = record;
      const sanitized = { ...record.sanitizedData };
      const errors = [];

      Object.keys(sanitized).forEach((key) => {
        if (typeof sanitized[key] === 'string') {
          sanitized[key] = sanitized[key].trim();
        }
      });

      if (sanitized.admission_no && !sanitized.admission_number) {
        sanitized.admission_number = sanitized.admission_no;
      }
      if (!sanitized.admission_no && sanitized.admission_number) {
        sanitized.admission_no = sanitized.admission_number;
      }

      const normalizedAdmission = normalizeAdmissionNumber(sanitized.admission_number);

      if (!sanitized.admission_number) {
        errors.push('Admission number is required');
      }

      if (normalizedAdmission && existingAdmissions.has(normalizedAdmission)) {
        errors.push('Admission number already exists in the master database');
      }

      if (!sanitized.student_name) {
        errors.push('Student name is required');
      }

      const courseValidation = validateCourseBranch(sanitized, courseIndex);
      if (courseValidation.issues.length > 0) {
        errors.push(...courseValidation.issues);
      }

      const rawYear = getFirstNonEmpty(
        sanitized.current_year,
        sanitized['Current Academic Year']
      );
      if (rawYear !== undefined && rawYear !== null && rawYear !== '') {
        const parsedYear = parseInt(rawYear, 10);
        if (Number.isNaN(parsedYear)) {
          errors.push('Current academic year must be a number');
        } else {
          sanitized.current_year = parsedYear;
          sanitized['Current Academic Year'] = parsedYear;
        }
      }

      const rawSemester = getFirstNonEmpty(
        sanitized.current_semester,
        sanitized['Current Semester']
      );
      if (rawSemester !== undefined && rawSemester !== null && rawSemester !== '') {
        const parsedSemester = parseInt(rawSemester, 10);
        if (Number.isNaN(parsedSemester)) {
          errors.push('Current semester must be a number');
        } else {
          sanitized.current_semester = parsedSemester;
          sanitized['Current Semester'] = parsedSemester;
        }
      }

      let resolvedStage = null;

      if (errors.length === 0) {
        try {
          resolvedStage = resolveStageFromData(sanitized, {
            year: sanitized.current_year || 1,
            semester: sanitized.current_semester || 1
          });
        } catch (stageError) {
          if (stageError.message === 'INVALID_STAGE') {
            errors.push(
              'Invalid academic stage provided. Year must be 1-4 and semester must be 1-2.'
            );
          } else {
            throw stageError;
          }
        }
      }

      if (errors.length > 0) {
        failedCount++;
        failedDetails.push({
          rowNumber,
          admissionNumber: sanitized.admission_number || null,
          errors
        });
        continue;
      }

      applyStageToPayload(sanitized, resolvedStage);

      const studentDataJson = JSON.stringify(sanitized);
      const insertColumns = ['admission_number', 'current_year', 'current_semester', 'student_data'];
      const insertPlaceholders = ['?', '?', '?', '?'];
      const insertValues = [
        sanitized.admission_number,
        resolvedStage.year,
        resolvedStage.semester,
        studentDataJson
      ];
      const updatedColumns = new Set(['admission_number', 'current_year', 'current_semester']);

      Object.entries(sanitized).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || value === '{}') {
          return;
        }
        const columnName = FIELD_MAPPING[key];
        if (!columnName || updatedColumns.has(columnName)) {
          return;
        }
        insertColumns.push(columnName);
        insertPlaceholders.push('?');
        insertValues.push(value);
        updatedColumns.add(columnName);
      });

      const insertQuery = `INSERT INTO students (${insertColumns.join(
        ', '
      )}) VALUES (${insertPlaceholders.join(', ')})`;

      try {
        await connection.query(insertQuery, insertValues);
      } catch (dbError) {
        if (dbError.code === 'ER_DUP_ENTRY') {
          failedCount++;
          failedDetails.push({
            rowNumber,
            admissionNumber: sanitized.admission_number,
            errors: ['Admission number already exists in the master database']
          });
          existingAdmissions.add(normalizedAdmission);
          continue;
        }
        throw dbError;
      }

      await connection.query(
        `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        ['BULK_UPLOAD', 'STUDENT', sanitized.admission_number, req.admin.id, studentDataJson]
      );

      await updateStagingStudentStage(
        sanitized.admission_number,
        resolvedStage,
        studentDataJson
      );

      successCount++;
      successDetails.push({
        rowNumber,
        admissionNumber: sanitized.admission_number
      });

      if (normalizedAdmission) {
        existingAdmissions.add(normalizedAdmission);
      }
    }

    res.json({
      success: true,
      message:
        successCount > 0
          ? `${successCount} student record${successCount === 1 ? '' : 's'} uploaded successfully${
              failedCount > 0
                ? `, ${failedCount} record${failedCount === 1 ? '' : 's'} skipped`
                : ''
            }`
          : 'No student records were uploaded',
      successCount,
      failedCount,
      skippedCount: failedCount,
      details: {
        successes: successDetails,
        failures: failedDetails
      }
    });
  } catch (error) {
    console.error('Bulk student upload commit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while saving student records',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
    if (successCount > 0) {
      clearStudentsCache();
    }
  }
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
      filter_batch,
      filter_course,
      filter_branch,
      ...otherFilters
    } = req.query;

    const fetchAll = !limit || limit === 'all';
    const pageSize = fetchAll ? null : Math.max(1, parseInt(limit, 10) || 25);
    const pageOffset = fetchAll ? 0 : Math.max(0, parseInt(offset, 10) || 0);
    const parsedFilterYear = filter_year !== undefined ? parseInt(filter_year, 10) : null;
    const parsedFilterSemester = filter_semester !== undefined ? parseInt(filter_semester, 10) : null;
    const normalizedFilterBatch =
      typeof filter_batch === 'string' && filter_batch.trim().length > 0 ? filter_batch.trim() : null;
    const normalizedFilterCourse =
      typeof filter_course === 'string' && filter_course.trim().length > 0 ? filter_course.trim() : null;
    const normalizedFilterBranch =
      typeof filter_branch === 'string' && filter_branch.trim().length > 0 ? filter_branch.trim() : null;
    const normalizedOtherFilters = Object.keys(otherFilters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = otherFilters[key];
        return acc;
      }, {});

    const cacheKey = fetchAll
      ? null
      : JSON.stringify({
          search: search || '',
          limit: pageSize,
          offset: pageOffset,
          filter_dateFrom: filter_dateFrom || null,
          filter_dateTo: filter_dateTo || null,
          filter_pinNumberStatus: filter_pinNumberStatus || null,
          filter_year: parsedFilterYear,
          filter_semester: parsedFilterSemester,
          filter_batch: normalizedFilterBatch,
          filter_course: normalizedFilterCourse,
          filter_branch: normalizedFilterBranch,
          filters: normalizedOtherFilters
        });

    if (cacheKey) {
      const cachedResponse = studentsCache.get(cacheKey);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }
    }

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

    if (parsedFilterYear && !isNaN(parsedFilterYear)) {
      query += ' AND current_year = ?';
      params.push(parsedFilterYear);
    }

    if (parsedFilterSemester && !isNaN(parsedFilterSemester)) {
      query += ' AND current_semester = ?';
      params.push(parsedFilterSemester);
    }

    if (normalizedFilterBatch) {
      query += ' AND batch = ?';
      params.push(normalizedFilterBatch);
    }

    if (normalizedFilterCourse) {
      query += ' AND course = ?';
      params.push(normalizedFilterCourse);
    }

    if (normalizedFilterBranch) {
      query += ' AND branch = ?';
      params.push(normalizedFilterBranch);
    }

    // Dynamic field filters (e.g., filter_field_Admission category)
    Object.entries(normalizedOtherFilters).forEach(([key, value]) => {
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

    if (normalizedFilterBatch) {
      countQuery += ' AND batch = ?';
      countParams.push(normalizedFilterBatch);
    }

    if (normalizedFilterCourse) {
      countQuery += ' AND course = ?';
      countParams.push(normalizedFilterCourse);
    }

    if (normalizedFilterBranch) {
      countQuery += ' AND branch = ?';
      countParams.push(normalizedFilterBranch);
    }

    // Apply dynamic field filters to count query
    Object.entries(normalizedOtherFilters).forEach(([key, value]) => {
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

    const totalCount = countResult?.[0]?.total || 0;

    const responsePayload = {
      success: true,
      data: parsedStudents,
      pagination: {
        total: totalCount,
        limit: fetchAll ? null : pageSize,
        offset: fetchAll ? 0 : pageOffset
      }
    };

    if (cacheKey) {
      studentsCache.set(cacheKey, responsePayload);
    }

    res.json(responsePayload);

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

    clearStudentsCache();

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

    clearStudentsCache();

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

      clearStudentsCache();
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

    clearStudentsCache();

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

    clearStudentsCache();

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

    clearStudentsCache();

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

    if (hasSuccess) {
      clearStudentsCache();
    }

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

    if (successCount > 0) {
      clearStudentsCache();
    }

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
