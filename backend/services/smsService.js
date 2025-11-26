// DLT Template: "Dear Parent, {#var#} is absent today i.e., on {#var#}Principal, PYDAH."
// Variable 1: "your ward", Variable 2: date (DD-MM-YYYY)
const DEFAULT_TEMPLATE =
  'Dear Parent, {#var#} is absent today i.e., on {#var#}Principal, PYDAH.';

// DLT Template ID and PE ID for absent SMS
const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || '1607100000000150000';
const SMS_PE_ID = process.env.SMS_PE_ID || '1102395590000010000';

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

const dispatchSms = async ({ to, message, templateId, peId, meta = {} }) => {
  if (!to) {
    return {
      success: false,
      skipped: true,
      reason: 'missing_destination'
    };
  }

  if (SMS_TEST_MODE) {
    console.log('[SMS-TEST]', { to, message, templateId, peId, meta });
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
      message,
      templateid: templateId || SMS_TEMPLATE_ID,
      peid: peId || SMS_PE_ID
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

/**
 * Build message by replacing {#var#} placeholders with actual values
 * DLT Template: "Dear Parent, {#var#} is absent today i.e., on {#var#}Principal, PYDAH."
 * Variables: [0] = "your ward", [1] = date (DD-MM-YYYY)
 */
const buildAbsenceMessage = (template, variables) => {
  let message = template;
  let varIndex = 0;
  
  // Replace each {#var#} placeholder with the corresponding variable value
  message = message.replace(/\{#var#\}/g, () => {
    const value = variables[varIndex] || '';
    varIndex++;
    return value;
  });
  
  return message;
};

exports.sendAbsenceNotification = async ({
  student,
  attendanceDate
}) => {
  const parentMobile = resolveParentContact(student);

  if (!parentMobile) {
    return {
      success: false,
      skipped: true,
      reason: 'missing_parent_mobile'
    };
  }

  const template = process.env.SMS_ABSENCE_TEMPLATE || DEFAULT_TEMPLATE;
  const formattedDate = formatDateForMessage(attendanceDate);

  // DLT Template variables:
  // Variable 1: "your ward" (always use this as per requirement)
  // Variable 2: the attendance date
  const message = buildAbsenceMessage(template, [
    'your ward',
    formattedDate
  ]);

  return dispatchSms({
    to: parentMobile,
    message,
    templateId: SMS_TEMPLATE_ID,
    peId: SMS_PE_ID,
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

