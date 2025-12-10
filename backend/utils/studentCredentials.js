const { masterPool } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Generate and store student login credentials
 * Username: PIN number OR mobile number (prefer PIN)
 * Password: First 4 letters of student name + last 4 digits of mobile number
 * 
 * @param {number} studentId - Student ID from students table
 * @param {string} admissionNumber - Student admission number
 * @param {string} pinNo - Student PIN number (optional)
 * @param {string} studentName - Student name
 * @param {string} studentMobile - Student mobile number
 * @returns {Promise<{success: boolean, username?: string, error?: string}>}
 */
async function generateStudentCredentials(studentId, admissionNumber, pinNo, studentName, studentMobile) {
  try {
    // Validate required fields
    if (!studentMobile || studentMobile.trim() === '') {
      return { success: false, error: 'Mobile number is required' };
    }

    if (!studentName || studentName.trim() === '') {
      return { success: false, error: 'Student name is required' };
    }

    // Generate username: PIN number OR mobile number
    let username = '';
    if (pinNo && pinNo.trim() !== '') {
      username = pinNo.trim();
    } else if (studentMobile && studentMobile.trim() !== '') {
      // Use only digits from mobile number
      username = studentMobile.replace(/\D/g, '');
    } else {
      return { success: false, error: 'No PIN or mobile number available' };
    }

    // Generate password: first 4 letters of student name + last 4 digits of mobile
    const mobileNumber = studentMobile.replace(/\D/g, ''); // Remove non-digits
    
    if (mobileNumber.length < 4) {
      return { success: false, error: 'Mobile number too short' };
    }

    // Get first 4 letters (uppercase, remove spaces and special chars)
    const firstFourLetters = studentName
      .replace(/[^a-zA-Z]/g, '') // Remove non-letters
      .substring(0, 4)
      .toUpperCase();

    if (firstFourLetters.length < 4) {
      return { success: false, error: 'Not enough letters in student name' };
    }

    // Get last 4 digits of mobile number
    const lastFourDigits = mobileNumber.substring(mobileNumber.length - 4);

    // Combine to create password
    const plainPassword = firstFourLetters + lastFourDigits;

    // Hash password
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Insert or update credentials
    await masterPool.query(`
      INSERT INTO student_credentials (student_id, admission_number, username, password_hash)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        updated_at = CURRENT_TIMESTAMP
    `, [studentId, admissionNumber, username, passwordHash]);

    return { success: true, username };
  } catch (error) {
    console.error('Error generating student credentials:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate credentials for a student by admission number
 * Fetches student data and generates credentials
 * 
 * @param {string} admissionNumber - Student admission number
 * @returns {Promise<{success: boolean, username?: string, error?: string}>}
 */
async function generateCredentialsByAdmissionNumber(admissionNumber) {
  try {
    const [students] = await masterPool.query(`
      SELECT id, admission_number, pin_no, student_name, student_mobile
      FROM students
      WHERE admission_number = ? OR admission_no = ?
      LIMIT 1
    `, [admissionNumber, admissionNumber]);

    if (students.length === 0) {
      return { success: false, error: 'Student not found' };
    }

    const student = students[0];
    return await generateStudentCredentials(
      student.id,
      student.admission_number,
      student.pin_no,
      student.student_name,
      student.student_mobile
    );
  } catch (error) {
    console.error('Error generating credentials by admission number:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateStudentCredentials,
  generateCredentialsByAdmissionNumber
};

