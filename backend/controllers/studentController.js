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
  // Exact field names from Excel template
  'Pin Number': 'pin_no',
  'Batch': 'batch',
  'College': 'college',
  'Branch': 'branch',
  'StudType': 'stud_type',
  'Student Name': 'student_name',
  'Student Status': 'student_status',
  'Student Mobile number': 'student_mobile',
  'Parent Mobile Number 1': 'parent_mobile1',
  'Parent Mobile Number 2': 'parent_mobile2',
  'Caste': 'caste',
  'M/F': 'gender',
  'Father Name': 'father_name',
  'DOB (Date-Month-Year) Ex: 09-Sep-2003)': 'dob',
  'DOB (Date of Birth - DD-MM-YYYY)': 'dob',
  'ADHAR No': 'adhar_no',
  'Admission No': 'admission_no',
  'Admission Number': 'admission_number',
  'Student Address (D.no,Street name,village,mandal,Dist)': 'student_address',
  'Student Address (D.No, Str name, Village, Mandal, Dist)': 'student_address',
  'City/Village Name': 'city_village',
  'City/Village': 'city_village',
  'Mandal Name': 'mandal_name',
  'District': 'district',
  'Previous College Name': 'previous_college',
  'Certificates Status': 'certificates_status',
  'Student Photo': 'student_photo',
  'Remarks': 'remarks',
  'Course': 'course',
  'Year': 'current_year',
  'Semister': 'current_semester',
  'Semester': 'current_semester',
  
  // Alternative field names (for backward compatibility)
  'Student Mobile Number': 'student_mobile',
  'Admission Date': 'admission_date',
  'Branch Name': 'branch',
  branch_name: 'branch',
  'Branch Code': 'branch_code',
  'Current Academic Year': 'current_year',
  'Current Year': 'current_year',
  current_year: 'current_year',
  currentYear: 'current_year',
  'Course Name': 'course',
  course: 'course',
  course_name: 'course',
  'Course Code': 'course_code',
  course_code: 'course_code',
  'Current Semester': 'current_semester',
  current_semester: 'current_semester',
  currentSemester: 'current_semester',
  'Scholar Status': 'scholar_status',

  // Database field names (direct mapping)
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
  college: 'college',
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
  remarks: 'remarks'
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

// Enhanced normalization that handles more variations
const normalizeHeaderKeyForLookup = (header) => {
  if (header === undefined || header === null) {
    return '';
  }
  return header
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .replace(/\s+/g, ''); // Remove all spaces
};

// Create a comprehensive field mapping with all possible variations
const createComprehensiveFieldMapping = () => {
  const mapping = {};
  
  // Define all possible field name variations for each database field
  const fieldVariations = {
    pin_no: ['pinnumber', 'pin_no', 'pin', 'pinnumber', 'pin_number', 'rollno', 'rollnumber', 'roll_no', 'pinno', 'pin_no', 'pin', 'pinnumber', 'pin_number', 'rollno', 'rollnumber', 'roll_no', 'rollnumber', 'roll_number', 'rollno', 'roll_no'],
    batch: ['batch', 'batchyear', 'batch_year', 'year', 'academicyear', 'academic_year', 'batch', 'batchyear', 'batch_year', 'year', 'academicyear', 'academic_year', 'batchyear', 'batch_year', 'academicyear', 'academic_year'],
    college: ['college', 'collegename', 'college_name', 'institution', 'institutionname', 'institution_name', 'campus', 'campusname', 'campus_name', 'college', 'collegename', 'college_name', 'institution', 'institutionname', 'institution_name', 'campus', 'campusname', 'campus_name'],
    branch: ['branch', 'branchname', 'branch_name', 'department', 'dept', 'specialization', 'branch', 'branchname', 'branch_name', 'department', 'dept', 'specialization', 'specialisation', 'stream', 'discipline'],
    stud_type: ['studtype', 'studenttype', 'student_type', 'type', 'category', 'studentcategory', 'studtype', 'studenttype', 'student_type', 'type', 'category', 'studentcategory', 'studentcategory', 'student_category'],
    student_name: ['studentname', 'name', 'student', 'fullname', 'full_name', 'studentfullname', 'student_name', 'studentname', 'nameofstudent', 'name_of_student', 'sname', 's_name'],
    student_status: ['studentstatus', 'student_status', 'status', 'currentstatus', 'current_status', 'studentstatus', 'student_status', 'status', 'currentstatus', 'current_status', 'studstatus', 'stud_status'],
    student_mobile: ['studentmobilenumber', 'studentmobile', 'mobile', 'phone', 'studentphone', 'contact', 'studentcontact', 'mobilenumber', 'phonenumber', 'student_mobile', 'studentmobile', 'studentphone', 'student_phone', 'contactnumber', 'contact_number', 'mob', 'mobile_no', 'phone_no'],
    parent_mobile1: ['parentmobilenumber1', 'parentmobile1', 'parent_mobile1', 'parentmobile', 'parentphone', 'parentcontact', 'guardianmobile', 'guardianphone', 'fathermobile', 'fatherphone', 'parentmobile1', 'parent_mobile1', 'parentmobile', 'parentphone', 'parentcontact', 'guardianmobile', 'guardianphone', 'fathermobile', 'fatherphone', 'parent1mobile', 'parent1_mobile', 'parent1phone', 'parent1_phone'],
    parent_mobile2: ['parentmobilenumber2', 'parentmobile2', 'parent_mobile2', 'parentmobile2', 'mothermobile', 'motherphone', 'alternatemobile', 'alternatephone', 'parentmobile2', 'parent_mobile2', 'parentmobile2', 'mothermobile', 'motherphone', 'alternatemobile', 'alternatephone', 'parent2mobile', 'parent2_mobile', 'parent2phone', 'parent2_phone'],
    caste: ['caste', 'category', 'socialcategory', 'social_category', 'cast', 'caste', 'category', 'socialcategory', 'social_category', 'cast', 'socialcategory', 'social_category', 'castecategory', 'caste_category'],
    gender: ['mf', 'm/f', 'gender', 'sex', 'maleorfemale', 'male_or_female', 'gender', 'sex', 'mf', 'm/f', 'maleorfemale', 'male_or_female', 'gend', 'sex', 'maleorfemale', 'male_or_female'],
    father_name: ['fathername', 'father', 'fathersname', 'fathers_name', 'parentname', 'guardianname', 'father_name', 'fathername', 'fathersname', 'fathers_name', 'fname', 'f_name', 'guardian', 'guardian_name'],
    dob: ['dobdatemonthyearex09sep2003', 'dateofbirth', 'birthdate', 'birth_date', 'dob', 'date_of_birth', 'birthday', 'bdate', 'dateofbirth', 'dob', 'birthdate', 'birth_date', 'date_of_birth', 'birthday', 'bdate', 'date', 'birth'],
    adhar_no: ['adharno', 'adharnumber', 'aadhar', 'aadharno', 'aadharnumber', 'aadhaarno', 'aadhaarnumber', 'uid', 'uidnumber', 'adhar_no', 'adharno', 'adharnumber', 'aadhar', 'aadharno', 'aadharnumber', 'aadhaar', 'aadhaarno', 'aadhaarnumber', 'uid', 'uidnumber', 'uidai'],
    admission_no: ['admissionno', 'admissionnumber', 'admission_no', 'admission_number', 'admitno', 'admitnumber', 'enrollmentno', 'enrollmentnumber', 'admissionno', 'admissionnumber', 'admission_no', 'admission_number', 'admitno', 'admitnumber', 'enrollmentno', 'enrollmentnumber', 'admno', 'adm_no', 'regno', 'reg_no'],
    admission_number: ['admissionno', 'admissionnumber', 'admission_no', 'admission_number', 'admitno', 'admitnumber', 'enrollmentno', 'enrollmentnumber', 'admissionno', 'admissionnumber', 'admission_no', 'admission_number', 'admitno', 'admitnumber', 'enrollmentno', 'enrollmentnumber', 'admno', 'adm_no', 'regno', 'reg_no'],
    student_address: ['studentaddressdnostreetnamevillagemandaldist', 'studentaddress', 'address', 'fulladdress', 'full_address', 'permanentaddress', 'permanent_address', 'residentialaddress', 'studentaddress', 'address', 'fulladdress', 'full_address', 'permanentaddress', 'permanent_address', 'residentialaddress', 'homeaddress', 'home_address', 'localaddress', 'local_address'],
    city_village: ['cityvillagename', 'cityvillage', 'city_village', 'city', 'village', 'town', 'cityortown', 'cityvillage', 'city_village', 'city', 'village', 'town', 'cityortown', 'cityvillage', 'city_or_village'],
    mandal_name: ['mandalname', 'mandal_name', 'mandal', 'taluk', 'taluka', 'block', 'mandalname', 'mandal_name', 'mandal', 'taluk', 'taluka', 'block', 'tehsil', 'tehsilname', 'tehsil_name'],
    district: ['district', 'dist', 'districtname', 'district_name', 'district', 'dist', 'districtname', 'district_name', 'districtname', 'district_name'],
    previous_college: ['previouscollegename', 'previouscollege', 'previous_college', 'lastcollege', 'last_college', 'previousinstitution', 'previouscollege', 'previous_college', 'lastcollege', 'last_college', 'previousinstitution', 'previousinstitution', 'previous_institution', 'lastinstitution', 'last_institution'],
    certificates_status: ['certificatesstatus', 'certificates_status', 'certstatus', 'cert_status', 'documentstatus', 'certificatesstatus', 'certificates_status', 'certstatus', 'cert_status', 'documentstatus', 'certstatus', 'cert_status', 'documentstatus', 'document_status'],
    student_photo: ['studentphoto', 'student_photo', 'photo', 'picture', 'image', 'profilephoto', 'studentphoto', 'student_photo', 'photo', 'picture', 'image', 'profilephoto', 'photograph', 'profilepicture', 'profile_picture'],
    remarks: ['remarks', 'remark', 'notes', 'note', 'comments', 'comment', 'remarks', 'remark', 'notes', 'note', 'comments', 'comment', 'note', 'notes'],
    course: ['course', 'coursename', 'course_name', 'program', 'programme', 'degree', 'course', 'coursename', 'course_name', 'program', 'programme', 'degree', 'programname', 'program_name', 'degreeprogram', 'degree_program'],
    current_year: ['year', 'currentyear', 'current_year', 'academicyear', 'academic_year', 'currentacademicyear', 'currentyear', 'current_year', 'year', 'academicyear', 'academic_year', 'currentacademicyear', 'academicyear', 'academic_year'],
    current_semester: ['semister', 'semester', 'currentsemester', 'current_semester', 'sem', 'currentsem', 'currentsemester', 'current_semester', 'semester', 'sem', 'currentsem', 'semester', 'sem'],
    admission_date: ['admissiondate', 'admission_date', 'admitdate', 'admit_date', 'enrollmentdate', 'enrollment_date', 'admissiondate', 'admission_date', 'admitdate', 'admit_date', 'enrollmentdate', 'enrollment_date', 'dateofadmission', 'date_of_admission'],
    branch_code: ['branchcode', 'branch_code', 'deptcode', 'dept_code', 'departmentcode', 'department_code', 'branchcode', 'branch_code', 'deptcode', 'dept_code', 'departmentcode', 'department_code'],
    course_code: ['coursecode', 'course_code', 'programcode', 'program_code', 'coursecode', 'course_code', 'programcode', 'program_code'],
    scholar_status: ['scholarstatus', 'scholar_status', 'scholarshipstatus', 'scholarship_status', 'scholarship', 'scholarstatus', 'scholar_status', 'scholarshipstatus', 'scholarship_status', 'scholarship', 'scholarshipstatus', 'scholarship_status']
  };

  // Build mapping from variations to database fields
  Object.entries(fieldVariations).forEach(([dbField, variations]) => {
    variations.forEach(variation => {
      const normalized = normalizeHeaderKeyForLookup(variation);
      if (normalized && !mapping[normalized]) {
        mapping[normalized] = dbField;
      }
    });
  });

  // Also add the original FIELD_MAPPING entries
  Object.entries(FIELD_MAPPING).forEach(([header, key]) => {
    const normalized = normalizeHeaderKeyForLookup(header);
    if (normalized && !mapping[normalized]) {
      mapping[normalized] = key;
    }
  });

  return mapping;
};

const FIELD_LOOKUP = createComprehensiveFieldMapping();

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

// Data conversion functions to handle various input formats
const convertDate = (value) => {
  if (!value || value === '') return '';
  
  const str = value.toString().trim();
  if (!str) return '';

  // Handle Excel date serial numbers
  if (typeof value === 'number' && value > 25569) {
    // Excel date serial number (days since 1900-01-01)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  // Handle DD-Month-YYYY format (e.g., 09-Sep-2003)
  const monthNames = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };
  
  const ddmonyyyy = str.match(/^(\d{1,2})[-/.\s]+([a-z]+)[-/.\s]+(\d{4})$/i);
  if (ddmonyyyy) {
    const day = ddmonyyyy[1].padStart(2, '0');
    const monthName = ddmonyyyy[2].toLowerCase();
    const year = ddmonyyyy[3];
    const month = monthNames[monthName];
    if (month) {
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime()) && date.getFullYear() == year) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  // Handle YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (ISO format - highest priority)
  const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    // Validate date
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime()) && date.getFullYear() == year) {
      return `${year}-${month}-${day}`;
    }
  }

  // Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (Indian format - second priority)
  const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    // Validate date (check if day <= 31 and month <= 12)
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    if (dayNum <= 31 && monthNum <= 12) {
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime()) && date.getFullYear() == year) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  // Handle MM-DD-YYYY, MM/DD/YYYY, MM.DD.YYYY (US format - last priority)
  // Only try if DD-MM-YYYY didn't match or was invalid
  const mmddyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (mmddyyyy && !ddmmyyyy) {
    const month = mmddyyyy[1].padStart(2, '0');
    const day = mmddyyyy[2].padStart(2, '0');
    const year = mmddyyyy[3];
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime()) && date.getFullYear() == year) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try parsing as ISO date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return str; // Return as-is if can't parse
};

const convertGender = (value) => {
  if (!value || value === '') return '';
  
  const str = value.toString().trim().toUpperCase();
  
  // Handle various gender formats
  if (str === 'M' || str === 'MALE' || str === 'BOY' || str === '1') {
    return 'M';
  }
  if (str === 'F' || str === 'FEMALE' || str === 'GIRL' || str === '2') {
    return 'F';
  }
  if (str === 'OTHER' || str === 'O' || str === '3') {
    return 'Other';
  }
  
  return str; // Return as-is if not recognized
};

const convertStudentType = (value) => {
  if (!value || value === '') return '';
  
  const str = value.toString().trim().toUpperCase();
  
  // Normalize equivalent student types
  // CQ and CONV are the same - store as CONV
  if (str === 'CQ') {
    return 'CONV';
  }
  if (str === 'CONV') {
    return 'CONV';
  }
  
  // MQ and MANG are the same - store as MANG
  if (str === 'MQ') {
    return 'MANG';
  }
  if (str === 'MANG') {
    return 'MANG';
  }
  
  // Return as-is (uppercase) for other types like LSPOT, LATER, SPOT, etc.
  return str;
};

const convertPhoneNumber = (value) => {
  if (!value || value === '') return '';
  
  const str = value.toString().trim();
  
  // Remove common phone number formatting characters
  let cleaned = str.replace(/[\s\-\(\)\.]/g, '');
  
  // Handle Excel number formatting (remove scientific notation)
  if (typeof value === 'number') {
    cleaned = value.toString().replace(/\.0+$/, ''); // Remove trailing .0
  }
  
  // Remove leading + or 0 if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0') && cleaned.length > 10) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
};

const convertAdmissionNumber = (value) => {
  if (!value || value === '') return '';
  
  const str = value.toString().trim();
  
  // Handle Excel number formatting
  if (typeof value === 'number') {
    return value.toString().replace(/\.0+$/, ''); // Remove trailing .0
  }
  
  return str.toUpperCase(); // Convert to uppercase
};

const convertText = (value, capitalize = false) => {
  if (!value || value === '') return '';
  
  const str = value.toString().trim();
  
  if (capitalize) {
    // Capitalize first letter of each word
    return str
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return str;
};

const convertNumber = (value) => {
  if (value === undefined || value === null || value === '') return '';
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  const str = value.toString().trim();
  if (str === '') return '';
  
  // Remove non-numeric characters except decimal point
  const cleaned = str.replace(/[^\d.]/g, '');
  
  // If it's a whole number, remove decimal point
  if (cleaned.includes('.') && cleaned.endsWith('.0')) {
    return cleaned.replace(/\.0+$/, '');
  }
  
  return cleaned || str;
};

// Field-specific conversion function
const convertFieldValue = (fieldName, value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const field = fieldName.toLowerCase();
  
  // Date fields
  if (field.includes('dob') || field.includes('date') || field.includes('birth')) {
    return convertDate(value);
  }
  
  // Gender field
  if (field.includes('gender') || field === 'sex' || field === 'mf' || field === 'm/f') {
    return convertGender(value);
  }
  
  // Student type field - check for stud_type field
  if (field === 'stud_type' || field.includes('stud_type') || field.includes('studtype') || field.includes('studenttype') || field === 'type' || field === 'category') {
    return convertStudentType(value);
  }
  
  // Phone number fields
  if (field.includes('mobile') || field.includes('phone') || field.includes('contact')) {
    return convertPhoneNumber(value);
  }
  
  // Admission number fields
  if (field.includes('admission') || field.includes('admit') || field.includes('enrollment')) {
    return convertAdmissionNumber(value);
  }
  
  // Name fields - capitalize
  if (field.includes('name') && !field.includes('number')) {
    return convertText(value, true);
  }
  
  // Number fields
  if (field.includes('year') || field.includes('semester') || field.includes('sem')) {
    return convertNumber(value);
  }
  
  // Aadhar number - remove spaces and convert to uppercase
  if (field.includes('adhar') || field.includes('aadhar') || field.includes('uid')) {
    return value.toString().trim().replace(/\s+/g, '').toUpperCase();
  }
  
  // Batch field - preserve exact value, especially numeric values like "2025"
  if (field === 'batch') {
    // If it's a number, convert to string to preserve it exactly
    if (typeof value === 'number') {
      return value.toString();
    }
    // If it's a string, just trim it
    return value.toString().trim();
  }
  
  // Default: trim and return
  return convertText(value);
};

// Helper function to count filled fields in a record
const countFilledFields = (sanitized) => {
  if (!sanitized || typeof sanitized !== 'object') {
    return 0;
  }
  
  let count = 0;
  Object.values(sanitized).forEach((value) => {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'string' && value.trim() !== '') {
        count++;
      } else if (typeof value !== 'string') {
        count++;
      }
    }
  });
  
  return count;
};

const mapRowToStudentRecord = (row, rowNumber) => {
  const raw = {};
  const sanitized = {};

  Object.entries(row || {}).forEach(([header, rawValue]) => {
    if (!header || header.toString().trim() === '') {
      return;
    }
    
    // Store raw value
    const cleanedValue = sanitizeCellValue(rawValue);
    raw[header] = cleanedValue;

    // Normalize header and find matching database field
    const normalizedHeader = normalizeHeaderKeyForLookup(header);
    const mappedKey = FIELD_LOOKUP[normalizedHeader];
    
    if (mappedKey && cleanedValue !== '') {
      // Convert value based on field type
      let convertedValue = convertFieldValue(mappedKey, rawValue);
      
      // Ensure student type conversion is applied (double-check)
      if (mappedKey === 'stud_type' && convertedValue) {
        convertedValue = convertStudentType(convertedValue);
      }
      
      if (convertedValue !== '') {
        sanitized[mappedKey] = convertedValue;
      }
    }
  });

  // Handle admission number aliases
  if (sanitized.admission_no && !sanitized.admission_number) {
    sanitized.admission_number = sanitized.admission_no;
  }
  if (!sanitized.admission_no && sanitized.admission_number) {
    sanitized.admission_no = sanitized.admission_number;
  }

  // Final cleanup - remove empty values
  Object.keys(sanitized).forEach((key) => {
    const value = sanitized[key];
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
      if (sanitized[key] === '') {
        delete sanitized[key];
      }
    } else if (value === null || value === undefined) {
      delete sanitized[key];
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

const buildCourseBranchIndex = async (collegeId = null) => {
  let query = 'SELECT id, name, code, college_id FROM courses WHERE is_active = 1';
  let queryParams = [];
  
  if (collegeId !== null && collegeId !== undefined) {
    const parsedCollegeId = parseInt(collegeId, 10);
    if (!Number.isNaN(parsedCollegeId)) {
      query += ' AND college_id = ?';
      queryParams.push(parsedCollegeId);
    }
  }
  
  const [courses] = await masterPool.query(query, queryParams);

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
        `Course "${courseIdentifier}" does not match any active course in the selected college`
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
        `Branch "${branchIdentifier}" is not configured for course "${resolvedCourse.name}" in the selected college`
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
        // Apply student type conversion if this is a stud_type field
        if (key === 'stud_type' || key.toLowerCase().includes('stud_type') || key.toLowerCase().includes('studtype')) {
          sanitized[key] = convertStudentType(trimmed);
        } else {
          sanitized[key] = trimmed;
        }
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
    
    // Get collegeId from request body (for multipart/form-data) or query params
    const collegeId = req.body?.collegeId || req.query?.collegeId || null;
    const courseIndex = await buildCourseBranchIndex(collegeId);

    // Track duplicates: for each admission number, find the row with most filled fields
    const admissionGroups = new Map(); // admission -> array of {rowNumber, record, filledCount}
    const duplicateRowNumbers = new Set(); // row numbers that are duplicates (not the best one)
    const bestRowMap = new Map(); // admission -> best row number

    // Group records by admission number
    processedRows.forEach((record) => {
      const normalizedAdmission = normalizeAdmissionNumber(record.sanitized.admission_number);
      if (!normalizedAdmission) {
        return;
      }
      
      if (!admissionGroups.has(normalizedAdmission)) {
        admissionGroups.set(normalizedAdmission, []);
      }
      
      const filledCount = countFilledFields(record.sanitized);
      admissionGroups.get(normalizedAdmission).push({
        rowNumber: record.rowNumber,
        record: record,
        filledCount: filledCount
      });
    });

    // For each admission number, find the row with most filled fields
    admissionGroups.forEach((rows, normalizedAdmission) => {
      if (rows.length > 1) {
        // Multiple rows with same admission number - find the one with most filled fields
        // Sort by filled count (descending), then by row number (ascending) as tiebreaker
        rows.sort((a, b) => {
          if (b.filledCount !== a.filledCount) {
            return b.filledCount - a.filledCount;
          }
          return a.rowNumber - b.rowNumber;
        });
        
        const bestRow = rows[0];
        bestRowMap.set(normalizedAdmission, bestRow.rowNumber);
        
        // Mark all other rows as duplicates
        for (let i = 1; i < rows.length; i++) {
          duplicateRowNumbers.add(rows[i].rowNumber);
        }
      } else {
        // Only one row with this admission number - it's the best one
        bestRowMap.set(normalizedAdmission, rows[0].rowNumber);
      }
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

      // Check if this row is a duplicate (not the one with most filled fields)
      if (normalizedAdmission && duplicateRowNumbers.has(record.rowNumber)) {
        const bestRowNumber = bestRowMap.get(normalizedAdmission);
        const currentFilledCount = countFilledFields(sanitized);
        const bestRecord = processedRows.find(r => r.rowNumber === bestRowNumber);
        const bestFilledCount = bestRecord ? countFilledFields(bestRecord.sanitized) : 0;
        
        issues.push(
          `Admission number already appears in row ${bestRowNumber} (${bestFilledCount} fields filled). This row (${currentFilledCount} fields filled) will be skipped - the row with most filled fields is kept.`
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
      duplicateAdmissionCount: duplicateRowNumbers.size
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
  // Get collegeId from request body
  const collegeId = req.body?.collegeId || null;
  const courseIndex = await buildCourseBranchIndex(collegeId);

  // Track duplicates: for each admission number, find the row with most filled fields
  const admissionGroups = new Map(); // admission -> array of {rowNumber, record, filledCount}
  const duplicateRowNumbers = new Set(); // row numbers that are duplicates (not the best one)
  const bestRowMap = new Map(); // admission -> best row number

  // Group records by admission number
  preparedRecords.forEach((record) => {
    const normalizedAdmission = normalizeAdmissionNumber(record.sanitizedData.admission_number);
    if (!normalizedAdmission) {
      return;
    }
    
    if (!admissionGroups.has(normalizedAdmission)) {
      admissionGroups.set(normalizedAdmission, []);
    }
    
    const filledCount = countFilledFields(record.sanitizedData);
    admissionGroups.get(normalizedAdmission).push({
      rowNumber: record.rowNumber,
      record: record,
      filledCount: filledCount
    });
  });

  // For each admission number, find the row with most filled fields
  admissionGroups.forEach((rows, normalizedAdmission) => {
    if (rows.length > 1) {
      // Multiple rows with same admission number - find the one with most filled fields
      // Sort by filled count (descending), then by row number (ascending) as tiebreaker
      rows.sort((a, b) => {
        if (b.filledCount !== a.filledCount) {
          return b.filledCount - a.filledCount;
        }
        return a.rowNumber - b.rowNumber;
      });
      
      const bestRow = rows[0];
      bestRowMap.set(normalizedAdmission, bestRow.rowNumber);
      
      // Mark all other rows as duplicates
      for (let i = 1; i < rows.length; i++) {
        duplicateRowNumbers.add(rows[i].rowNumber);
      }
    } else {
      // Only one row with this admission number - it's the best one
      bestRowMap.set(normalizedAdmission, rows[0].rowNumber);
    }
  });

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

      // Check for duplicates within the upload batch
      if (normalizedAdmission && duplicateRowNumbers.has(rowNumber)) {
        // This row is a duplicate - skip it
        const bestRowNumber = bestRowMap.get(normalizedAdmission);
        const currentFilledCount = countFilledFields(sanitized);
        const bestRecord = preparedRecords.find(r => r.rowNumber === bestRowNumber);
        const bestFilledCount = bestRecord ? countFilledFields(bestRecord.sanitizedData) : 0;
        
        errors.push(
          `Admission number already appears in row ${bestRowNumber} (${bestFilledCount} fields filled). This row (${currentFilledCount} fields filled) will be skipped - the row with most filled fields is kept.`
        );
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
      filter_college,
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
    const normalizedFilterCollege =
      typeof filter_college === 'string' && filter_college.trim().length > 0 ? filter_college.trim() : null;
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

    // Student database field filters - defined once for reuse
    const studentFieldFilters = [
      'admission_number', 'pin_no', 'stud_type', 'student_name', 'student_status',
      'scholar_status', 'student_mobile', 'parent_mobile1', 'parent_mobile2',
      'caste', 'gender', 'father_name', 'dob', 'adhar_no', 'admission_date',
      'student_address', 'city_village', 'mandal_name', 'district',
      'previous_college', 'certificates_status', 'remarks', 'college'
    ];

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
          filter_college: normalizedFilterCollege,
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

    if (normalizedFilterCollege) {
      query += ' AND college = ?';
      params.push(normalizedFilterCollege);
    }

    if (normalizedFilterCourse) {
      query += ' AND course = ?';
      params.push(normalizedFilterCourse);
    }

    if (normalizedFilterBranch) {
      query += ' AND branch = ?';
      params.push(normalizedFilterBranch);
    }

    // Student database field filters
    studentFieldFilters.forEach(field => {
      const filterKey = `filter_${field}`;
      const filterValue = normalizedOtherFilters[filterKey];
      if (filterValue && typeof filterValue === 'string' && filterValue.trim().length > 0) {
        query += ` AND ${field} LIKE ?`;
        params.push(`%${filterValue.trim()}%`);
      }
    });

    // Created at date filter
    if (normalizedOtherFilters.filter_created_at) {
      query += ' AND DATE(created_at) = ?';
      params.push(normalizedOtherFilters.filter_created_at);
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

    if (normalizedFilterCollege) {
      countQuery += ' AND college = ?';
      countParams.push(normalizedFilterCollege);
    }

    if (normalizedFilterCourse) {
      countQuery += ' AND course = ?';
      countParams.push(normalizedFilterCourse);
    }

    if (normalizedFilterBranch) {
      countQuery += ' AND branch = ?';
      countParams.push(normalizedFilterBranch);
    }

    // Student database field filters for count query
    studentFieldFilters.forEach(field => {
      const filterKey = `filter_${field}`;
      const filterValue = normalizedOtherFilters[filterKey];
      if (filterValue && typeof filterValue === 'string' && filterValue.trim().length > 0) {
        countQuery += ` AND ${field} LIKE ?`;
        countParams.push(`%${filterValue.trim()}%`);
      }
    });

    // Created at date filter for count query
    if (normalizedOtherFilters.filter_created_at) {
      countQuery += ' AND DATE(created_at) = ?';
      countParams.push(normalizedOtherFilters.filter_created_at);
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
    const totalPages = fetchAll ? 1 : (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1);

    const responsePayload = {
      success: true,
      data: parsedStudents,
      pagination: {
        total: totalCount,
        limit: fetchAll ? null : pageSize,
        offset: fetchAll ? 0 : pageOffset,
        totalPages: totalPages,
        currentPage: fetchAll ? 1 : Math.floor(pageOffset / pageSize) + 1
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
      // Count only Regular students
      const [studentCount] = await masterPool.query(
        "SELECT COUNT(*) as total FROM students WHERE student_status = 'Regular'"
      );
      totalStudents = studentCount?.[0]?.total || 0;
    } catch (dbError) {
      masterDbConnected = false;
      console.warn('Dashboard stats: master database unavailable, returning fallback totals', dbError.message || dbError);
    }

    const pendingSubmissions = await safeSupabaseCount(
      supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      'pending submissions count'
    );

    let recentWithNames = [];
    try {
      const { data: recentSubmissions, error: recentError } = await supabase
        .from('form_submissions')
        .select('submission_id, admission_number, status, created_at, form_id')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) {
        console.warn('Dashboard stats: unable to fetch recent submissions', recentError.message || recentError);
      } else if (recentSubmissions) {
        recentWithNames = recentSubmissions.map((r) => ({
          ...r,
          submitted_at: r.created_at // Use created_at as submitted_at
        }));
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
              form_name: idToName.get(r.form_id) || null
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
        pendingSubmissions,
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

// Get all unique filter values for dropdown filters
exports.getFilterOptions = async (req, res) => {
  try {
    // Get filter parameters from query string
    const { course, branch, batch, year, semester } = req.query;
    
    // Build WHERE clause based on applied filters
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (course) {
      whereClause += ' AND course = ?';
      params.push(course);
    }
    if (branch) {
      whereClause += ' AND branch = ?';
      params.push(branch);
    }
    if (batch) {
      whereClause += ' AND batch = ?';
      params.push(batch);
    }
    if (year) {
      whereClause += ' AND current_year = ?';
      params.push(parseInt(year, 10));
    }
    if (semester) {
      whereClause += ' AND current_semester = ?';
      params.push(parseInt(semester, 10));
    }
    
    // Get unique values for all dropdown filter fields, applying cascading filters
    const [studTypeRows] = await masterPool.query(
      `SELECT DISTINCT stud_type FROM students ${whereClause} AND stud_type IS NOT NULL AND stud_type <> '' ORDER BY stud_type ASC`,
      params
    );
    const [studentStatusRows] = await masterPool.query(
      `SELECT DISTINCT student_status FROM students ${whereClause} AND student_status IS NOT NULL AND student_status <> '' ORDER BY student_status ASC`,
      params
    );
    const [scholarStatusRows] = await masterPool.query(
      `SELECT DISTINCT scholar_status FROM students ${whereClause} AND scholar_status IS NOT NULL AND scholar_status <> '' ORDER BY scholar_status ASC`,
      params
    );
    const [casteRows] = await masterPool.query(
      `SELECT DISTINCT caste FROM students ${whereClause} AND caste IS NOT NULL AND caste <> '' ORDER BY caste ASC`,
      params
    );
    const [genderRows] = await masterPool.query(
      `SELECT DISTINCT gender FROM students ${whereClause} AND gender IS NOT NULL AND gender <> '' ORDER BY gender ASC`,
      params
    );
    const [certificatesStatusRows] = await masterPool.query(
      `SELECT DISTINCT certificates_status FROM students ${whereClause} AND certificates_status IS NOT NULL AND certificates_status <> '' ORDER BY certificates_status ASC`,
      params
    );
    const [remarksRows] = await masterPool.query(
      `SELECT DISTINCT remarks FROM students ${whereClause} AND remarks IS NOT NULL AND remarks <> '' ORDER BY remarks ASC`,
      params
    );

    res.json({
      success: true,
      data: {
        stud_type: studTypeRows.map((row) => row.stud_type),
        student_status: studentStatusRows.map((row) => row.student_status),
        scholar_status: scholarStatusRows.map((row) => row.scholar_status),
        caste: casteRows.map((row) => row.caste),
        gender: genderRows.map((row) => row.gender),
        certificates_status: certificatesStatusRows.map((row) => row.certificates_status),
        remarks: remarksRows.map((row) => row.remarks)
      }
    });
  } catch (error) {
    console.error('Failed to fetch filter options:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching filter options'
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
