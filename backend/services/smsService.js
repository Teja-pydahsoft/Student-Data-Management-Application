const DEFAULT_TEMPLATE =
  'Dear Parent, {{studentName}} was marked absent on {{attendanceDate}}. Please contact the college for more details.';

const SMS_API_URL = process.env.SMS_API_URL || process.env.BULKSMS_ENGLISH_API_URL || 'https://www.bulksmsapps.com/api/apismsv2.aspx';
const SMS_API_KEY = process.env.SMS_API_KEY || process.env.BULKSMS_API_KEY || '7c9c967a-4ce9-4748-9dc7-d2aaef847275';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || process.env.BULKSMS_SENDER_ID || 'PYDAHK';
const SMS_TEST_MODE = String(process.env.SMS_TEST_MODE || '').toLowerCase() === 'true';

const ensureFetchAvailable = () => {
  if (typeof fetch === 'function') {
    return true;
  }

  console.warn('⚠️  Global fetch API is not available. SMS requests are skipped.');
  return false;
};

const formatDateForMessage = (dateString = '') => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const renderTemplate = (template, variables) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null
      ? String(variables[key])
      : '';
  });
};

const dispatchSms = async ({ to, message, meta = {} }) => {
  if (!to) {
    return {
      success: false,
      skipped: true,
      reason: 'missing_destination'
    };
  }

  if (SMS_TEST_MODE) {
    console.log('[SMS-TEST]', { to, message, meta });
    return {
      success: true,
      mocked: true,
      testMode: true
    };
  }

  if (!SMS_API_URL) {
    console.warn('⚠️  SMS_API_URL is not configured. SMS dispatch skipped.');
    return {
      success: false,
      skipped: true,
      reason: 'config_missing'
    };
  }

  if (!ensureFetchAvailable()) {
    return {
      success: false,
      skipped: true,
      reason: 'fetch_unavailable'
    };
  }

  try {
    const payload = new URLSearchParams({
      apikey: SMS_API_KEY,
      senderid: SMS_SENDER_ID,
      number: to,
      message
    });

    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        skipped: false,
        reason: `http_${response.status}`,
        details: errorText
      };
    }

    const text = await response.text();
    return {
      success: true,
      data: text
    };
  } catch (error) {
    console.error('❌ SMS dispatch failed:', error.message || error);
    return {
      success: false,
      skipped: false,
      reason: 'exception',
      details: error.message || String(error)
    };
  }
};

const resolveParentContact = (student) => {
  if (!student) return '';

  if (student.parent_mobile1) {
    return student.parent_mobile1;
  }

  if (student.parent_mobile2) {
    return student.parent_mobile2;
  }

  const data = student.student_data;
  if (!data || typeof data !== 'object') {
    return '';
  }

  return (
    data['Parent Mobile Number 1'] ||
    data['Parent Phone Number 1'] ||
    data['Parent Mobile Number'] ||
    data['Parent 1 Mobile'] ||
    ''
  );
};

const resolveStudentName = (student) => {
  if (!student) return '';

  if (student.student_name) {
    return student.student_name;
  }

  const data = student.student_data;
  if (!data || typeof data !== 'object') {
    return '';
  }

  return (
    data['Student Name'] ||
    data['student_name'] ||
    data['Name'] ||
    ''
  );
};

exports.sendAbsenceNotification = async ({
  student,
  attendanceDate
}) => {
  const parentMobile = resolveParentContact(student);
  const studentName = resolveStudentName(student);

  if (!parentMobile) {
    return {
      success: false,
      skipped: true,
      reason: 'missing_parent_mobile'
    };
  }

  const template = process.env.SMS_ABSENCE_TEMPLATE || DEFAULT_TEMPLATE;
  const formattedDate = formatDateForMessage(attendanceDate);

  const message = renderTemplate(template, {
    studentName: studentName || 'your ward',
    attendanceDate: formattedDate,
    batch: student.batch || '',
    currentYear: student.current_year || '',
    currentSemester: student.current_semester || ''
  });

  return dispatchSms({
    to: parentMobile,
    message,
    meta: {
      template: 'attendance_absent',
      student: {
        id: student.id,
        admissionNumber: student.admission_number
      },
      attendanceDate
    }
  });
};

module.exports = {
  sendAbsenceNotification: exports.sendAbsenceNotification
};

