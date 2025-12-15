const { masterPool } = require('../config/database');
const { sendAbsenceNotification } = require('../services/smsService');
const { getNotificationSetting } = require('./settingsController');
const { sendBrevoEmail } = require('../utils/emailService');
const { sendAttendanceReportNotifications } = require('../services/attendanceNotificationService');
const { getAllAttendanceForDate, areAllBatchesMarked, areAllBatchesMarkedForCollege, areAllBatchesMarkedForCollegeCourseBranch } = require('../services/getAllAttendanceForDate');
const {
  getNonWorkingDayInfo,
  getNonWorkingDaysForRange
} = require('../services/nonWorkingDayService');
const { listCustomHolidays } = require('../services/customHolidayService');
const { getPublicHolidaysForYear } = require('../services/holidayService');
const { getScopeConditionString } = require('../utils/scoping');

// Helper function to replace template variables
const replaceTemplateVariables = (template, variables) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
};

// Helper function to convert plain text to HTML (basic conversion)
const textToHtml = (text) => {
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<p></p>';
      return `<p>${trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('\n');
};

// Helper function to resolve parent email
const resolveParentEmail = (student) => {
  if (!student) return '';
  
  const data = student.student_data || {};
  return (
    student.parent_email ||
    data['Parent Email'] ||
    data['Parent Email Address'] ||
    data['parent_email'] ||
    ''
  );
};

const VALID_STATUSES = new Set(['present', 'absent', 'holiday']);
const EXCLUDED_COURSES = ['M.Tech', 'MBA', 'MCS', 'M Sc Aqua', 'MCA', 'M.Pharma', 'M Pharma'];

const parseStudentData = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data;

  try {
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
};

const getDateOnlyString = (input) => {
  if (!input) {
    const today = new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
};

exports.getFilterOptions = async (req, res) => {
  try {
    // Get filter parameters from query string
    const { course, branch, batch, year, semester, college } = req.query;
    
    // Build WHERE clause based on applied filters - only regular students
    const params = [];
    let whereClause = `WHERE 1=1 AND student_status = 'Regular'`;
    if (EXCLUDED_COURSES.length > 0) {
      whereClause += ` AND course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`;
      params.push(...EXCLUDED_COURSES);
    }
    
    // Apply user scope filtering first
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 'students');
      if (scopeCondition) {
        whereClause += ` AND ${scopeCondition}`;
        params.push(...scopeParams);
      }
    }
    
    if (college) {
      whereClause += ' AND college = ?';
      params.push(college);
    }
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
    
    // Fetch distinct values for each filter, applying cascading filters
    const [batchRows] = await masterPool.query(
      `SELECT DISTINCT batch FROM students ${whereClause} AND batch IS NOT NULL AND batch <> '' ORDER BY batch ASC`,
      params
    );
    
    // For years and semesters, build separate WHERE clauses that exclude year/semester filters
    // so they cascade properly based on batch/course/branch
    const yearParams = [];
    let yearWhereClause = `WHERE 1=1 AND student_status = 'Regular'`;
    if (EXCLUDED_COURSES.length > 0) {
      yearWhereClause += ` AND course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`;
      yearParams.push(...EXCLUDED_COURSES);
    }
    
    // Apply user scope filtering
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 'students');
      if (scopeCondition) {
        yearWhereClause += ` AND ${scopeCondition}`;
        yearParams.push(...scopeParams);
      }
    }
    
    if (college) {
      yearWhereClause += ' AND college = ?';
      yearParams.push(college);
    }
    if (course) {
      yearWhereClause += ' AND course = ?';
      yearParams.push(course);
    }
    if (branch) {
      yearWhereClause += ' AND branch = ?';
      yearParams.push(branch);
    }
    if (batch) {
      yearWhereClause += ' AND batch = ?';
      yearParams.push(batch);
    }
    // Note: year and semester are NOT included in the WHERE clause for years/semesters queries
    
    const [yearRows] = await masterPool.query(
      `SELECT DISTINCT current_year AS currentYear FROM students ${yearWhereClause} AND current_year IS NOT NULL AND current_year <> 0 ORDER BY current_year ASC`,
      yearParams
    );
    
    // For semesters, use the same WHERE clause as years
    const [semesterRows] = await masterPool.query(
      `SELECT DISTINCT current_semester AS currentSemester FROM students ${yearWhereClause} AND current_semester IS NOT NULL AND current_semester <> 0 ORDER BY current_semester ASC`,
      yearParams
    );
    
    // For courses, if college is selected, filter courses by college
    let courseRows;
    if (college) {
      // Get college ID from college name
      const [collegeRows] = await masterPool.query(
        'SELECT id FROM colleges WHERE name = ? AND is_active = 1 LIMIT 1',
        [college]
      );
      
      if (collegeRows.length > 0) {
        const collegeId = collegeRows[0].id;
        // Get courses for this college from courses table (these are the valid courses for this college)
        const [collegeCourses] = await masterPool.query(
          'SELECT name FROM courses WHERE college_id = ? AND is_active = 1 ORDER BY name ASC',
          [collegeId]
        );
        const validCourseNames = collegeCourses.map(c => c.name);
        
        if (validCourseNames.length > 0) {
          // Get distinct courses from students that match:
          // 1. The current filters (college, batch, year, semester, etc.)
          // 2. AND are in the list of valid courses for this college
          const placeholders = validCourseNames.map(() => '?').join(',');
          const courseWhereClause = `${whereClause} AND course IN (${placeholders})`;
          const courseParams = [...params, ...validCourseNames];
          [courseRows] = await masterPool.query(
            `SELECT DISTINCT course FROM students ${courseWhereClause} AND course IS NOT NULL AND course <> '' ORDER BY course ASC`,
            courseParams
          );
        } else {
          // No courses configured for this college
          courseRows = [];
        }
      } else {
        // College not found, return empty courses
        courseRows = [];
      }
    } else {
      // No college filter, get all courses from students
      [courseRows] = await masterPool.query(
        `SELECT DISTINCT course FROM students ${whereClause} AND course IS NOT NULL AND course <> '' ORDER BY course ASC`,
        params
      );
    }
    
    // For branches, if college is selected, filter branches by college and valid courses
    let branchRows;
    if (college) {
      // Get college ID from college name
      const [collegeRows] = await masterPool.query(
        'SELECT id FROM colleges WHERE name = ? AND is_active = 1 LIMIT 1',
        [college]
      );
      
      if (collegeRows.length > 0) {
        const collegeId = collegeRows[0].id;
        // Get courses for this college from courses table
        const [collegeCourses] = await masterPool.query(
          'SELECT id, name FROM courses WHERE college_id = ? AND is_active = 1 ORDER BY name ASC',
          [collegeId]
        );
        const validCourseNames = collegeCourses.map(c => c.name);
        const validCourseIds = collegeCourses.map(c => c.id);
        
        if (validCourseNames.length > 0) {
          // If course is also selected, filter branches for that specific course
          if (course) {
            // Get course ID for the selected course
            const selectedCourse = collegeCourses.find(c => c.name === course);
            if (selectedCourse) {
              // Get branches for this specific course from course_branches table
              const [courseBranches] = await masterPool.query(
                'SELECT name FROM course_branches WHERE course_id = ? AND is_active = 1 ORDER BY name ASC',
                [selectedCourse.id]
              );
              const validBranchNames = courseBranches.map(b => b.name);
              
              if (validBranchNames.length > 0) {
                // Get distinct branches from students that match:
                // 1. The current filters (college, course, batch, year, semester, etc.)
                // 2. AND are in the list of valid branches for this course
                const placeholders = validBranchNames.map(() => '?').join(',');
                const branchWhereClause = `${whereClause} AND branch IN (${placeholders})`;
                const branchParams = [...params, ...validBranchNames];
                [branchRows] = await masterPool.query(
                  `SELECT DISTINCT branch FROM students ${branchWhereClause} AND branch IS NOT NULL AND branch <> '' ORDER BY branch ASC`,
                  branchParams
                );
              } else {
                branchRows = [];
              }
            } else {
              // Selected course doesn't belong to this college
              branchRows = [];
            }
          } else {
            // No course selected, get all branches for all courses in this college
            // Get all branches for all courses in this college
            if (validCourseIds.length > 0) {
              const courseIdPlaceholders = validCourseIds.map(() => '?').join(',');
              const [allBranches] = await masterPool.query(
                `SELECT name FROM course_branches WHERE course_id IN (${courseIdPlaceholders}) AND is_active = 1 ORDER BY name ASC`,
                validCourseIds
              );
              const validBranchNames = allBranches.map(b => b.name);
              
              if (validBranchNames.length > 0) {
                const placeholders = validBranchNames.map(() => '?').join(',');
                const branchWhereClause = `${whereClause} AND branch IN (${placeholders})`;
                const branchParams = [...params, ...validBranchNames];
                [branchRows] = await masterPool.query(
                  `SELECT DISTINCT branch FROM students ${branchWhereClause} AND branch IS NOT NULL AND branch <> '' ORDER BY branch ASC`,
                  branchParams
                );
              } else {
                branchRows = [];
              }
            } else {
              branchRows = [];
            }
          }
        } else {
          // No courses configured for this college
          branchRows = [];
        }
      } else {
        // College not found, return empty branches
        branchRows = [];
      }
    } else {
      // No college filter, get all branches from students
      [branchRows] = await masterPool.query(
        `SELECT DISTINCT branch FROM students ${whereClause} AND branch IS NOT NULL AND branch <> '' ORDER BY branch ASC`,
        params
      );
    }

    res.json({
      success: true,
      data: {
        batches: batchRows.map((row) => row.batch),
        years: yearRows.map((row) => row.currentYear),
        semesters: semesterRows.map((row) => row.currentSemester),
        courses: courseRows.map((row) => row.course),
        branches: branchRows.map((row) => row.branch)
      }
    });
  } catch (error) {
    console.error('Failed to fetch attendance filters:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance filters'
    });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const attendanceDate = getDateOnlyString(req.query.date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance date supplied'
      });
    }

    let holidayInfo = null;
    try {
      holidayInfo = await getNonWorkingDayInfo(attendanceDate);
    } catch (error) {
      holidayInfo = {
        date: attendanceDate,
        isNonWorkingDay: false,
        isSunday: false,
        publicHoliday: null,
        customHoliday: null,
        reasons: []
      };
    }

    const {
      batch,
      currentYear,
      currentSemester,
      studentName,
      parentMobile,
      course,
      branch,
      limit,
      offset
    } = req.query;

    let query = `
      SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        s.parent_mobile1,
        s.parent_mobile2,
        s.student_photo,
        s.batch,
        s.course,
        s.branch,
        s.current_year,
        s.current_semester,
        s.registration_status,
        s.fee_status,
        s.student_data,
        ar.id AS attendance_record_id,
        ar.status AS attendance_status,
        COALESCE(ar.sms_sent, 0) AS sms_sent
      FROM students s
      LEFT JOIN attendance_records ar
        ON ar.student_id = s.id
       AND ar.attendance_date = ?
      WHERE 1=1
    `;

    const params = [attendanceDate];

    // Filter for regular students only
    query += ` AND s.student_status = 'Regular'`;
    // Exclude certain courses
    if (EXCLUDED_COURSES.length > 0) {
      query += ` AND s.course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`;
      params.push(...EXCLUDED_COURSES);
    }

    // Apply user scope filtering
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 's');
      if (scopeCondition) {
        query += ` AND ${scopeCondition}`;
        params.push(...scopeParams);
      }
    }

    if (batch) {
      query += ' AND s.batch = ?';
      params.push(batch);
    }

    if (currentYear) {
      const parsedYear = parseInt(currentYear, 10);
      if (!Number.isNaN(parsedYear)) {
        query += ' AND s.current_year = ?';
        params.push(parsedYear);
      }
    }

    if (currentSemester) {
      const parsedSemester = parseInt(currentSemester, 10);
      if (!Number.isNaN(parsedSemester)) {
        query += ' AND s.current_semester = ?';
        params.push(parsedSemester);
      }
    }

    if (course) {
      query += ' AND s.course = ?';
      params.push(course);
    }

    if (branch) {
      query += ' AND s.branch = ?';
      params.push(branch);
    }

    if (studentName) {
      const keyword = `%${studentName}%`;
      query += `
        AND (
          s.student_name LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Student Name"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."student_name"')) LIKE ?
          OR s.pin_no LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."PIN Number"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Pin Number"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."pin_number"')) LIKE ?
        )
      `;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (parentMobile) {
      const mobileLike = `%${parentMobile}%`;
      query += `
        AND (
          s.parent_mobile1 LIKE ?
          OR s.parent_mobile2 LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile Number 1"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile Number 2"')) LIKE ?
        )
      `;
      params.push(mobileLike, mobileLike, mobileLike, mobileLike);
    }

    query += ' ORDER BY s.student_name ASC';

    // Build count query for pagination - use same WHERE clause but count distinct students
    // This ensures accurate pagination based on all applied filters (batch, course, branch, year, semester, etc.)
    let countQuery = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM students s
      WHERE 1=1
    `;
    
    const countParams = [];
    
    // Apply same filters to count query
    countQuery += ` AND s.student_status = 'Regular'`;
    
    // Exclude certain courses
    if (EXCLUDED_COURSES.length > 0) {
      countQuery += ` AND s.course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`;
      countParams.push(...EXCLUDED_COURSES);
    }
    
    // Apply user scope filtering
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 's');
      if (scopeCondition) {
        countQuery += ` AND ${scopeCondition}`;
        countParams.push(...scopeParams);
      }
    }
    
    if (batch) {
      countQuery += ' AND s.batch = ?';
      countParams.push(batch);
    }
    
    if (currentYear) {
      const parsedYear = parseInt(currentYear, 10);
      if (!Number.isNaN(parsedYear)) {
        countQuery += ' AND s.current_year = ?';
        countParams.push(parsedYear);
      }
    }
    
    if (currentSemester) {
      const parsedSemester = parseInt(currentSemester, 10);
      if (!Number.isNaN(parsedSemester)) {
        countQuery += ' AND s.current_semester = ?';
        countParams.push(parsedSemester);
      }
    }
    
    if (course) {
      countQuery += ' AND s.course = ?';
      countParams.push(course);
    }
    
    if (branch) {
      countQuery += ' AND s.branch = ?';
      countParams.push(branch);
    }
    
    if (studentName) {
      const keyword = `%${studentName}%`;
      countQuery += `
        AND (
          s.student_name LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Student Name"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."student_name"')) LIKE ?
          OR s.pin_no LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."PIN Number"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Pin Number"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."pin_number"')) LIKE ?
        )
      `;
      countParams.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }
    
    if (parentMobile) {
      const mobileLike = `%${parentMobile}%`;
      countQuery += `
        AND (
          s.parent_mobile1 LIKE ?
          OR s.parent_mobile2 LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile Number 1"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile Number 2"')) LIKE ?
        )
      `;
      countParams.push(mobileLike, mobileLike, mobileLike, mobileLike);
    }

    const parsedLimit = limit ? parseInt(limit, 10) : null;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    // Get total count with all filters applied
    const [countRows] = await masterPool.query(countQuery, countParams);
    const total = countRows?.[0]?.total || 0;
    // Get statistics for all students (not just current page) - use same query structure
    // Build WHERE clause for statistics (same filters as main query)
    let statsWhereClause = 'WHERE 1=1 AND s.student_status = \'Regular\'';
    const statsParams = [];
    
    // Exclude certain courses
    if (EXCLUDED_COURSES.length > 0) {
      statsWhereClause += ` AND s.course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`;
      statsParams.push(...EXCLUDED_COURSES);
    }
    
    // Apply same filters to stats query
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 's');
      if (scopeCondition) {
        statsWhereClause += ` AND ${scopeCondition}`;
        statsParams.push(...scopeParams);
      }
    }

    if (batch) {
      statsWhereClause += ' AND s.batch = ?';
      statsParams.push(batch);
    }

    if (currentYear) {
      const parsedYear = parseInt(currentYear, 10);
      if (!Number.isNaN(parsedYear)) {
        statsWhereClause += ' AND s.current_year = ?';
        statsParams.push(parsedYear);
      }
    }

    if (currentSemester) {
      const parsedSemester = parseInt(currentSemester, 10);
      if (!Number.isNaN(parsedSemester)) {
        statsWhereClause += ' AND s.current_semester = ?';
        statsParams.push(parsedSemester);
      }
    }

    if (course) {
      statsWhereClause += ' AND s.course = ?';
      statsParams.push(course);
    }

    if (branch) {
      statsWhereClause += ' AND s.branch = ?';
      statsParams.push(branch);
    }

    if (studentName) {
      const keyword = `%${studentName}%`;
      statsWhereClause += `
        AND (
          s.student_name LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Student Name"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."student_name"')) LIKE ?
          OR s.pin_no LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."PIN Number"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Pin Number"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."pin_number"')) LIKE ?
        )
      `;
      statsParams.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (parentMobile) {
      const mobileLike = `%${parentMobile}%`;
      statsWhereClause += `
        AND (
          s.parent_mobile1 LIKE ?
          OR s.parent_mobile2 LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile Number 1"')) LIKE ?
          OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile Number 2"')) LIKE ?
        )
      `;
      statsParams.push(mobileLike, mobileLike, mobileLike, mobileLike);
    }

    // Use separate queries for accurate counting
    // Get present count
    const presentQuery = `
      SELECT COUNT(DISTINCT s.id) AS count
      FROM students s
      INNER JOIN attendance_records ar ON ar.student_id = s.id AND ar.attendance_date = ? AND ar.status = 'present'
      ${statsWhereClause}
    `;
    
    // Get absent count
    const absentQuery = `
      SELECT COUNT(DISTINCT s.id) AS count
      FROM students s
      INNER JOIN attendance_records ar ON ar.student_id = s.id AND ar.attendance_date = ? AND ar.status = 'absent'
      ${statsWhereClause}
    `;
    
    // Get marked count (any status)
    const markedQuery = `
      SELECT COUNT(DISTINCT s.id) AS count
      FROM students s
      INNER JOIN attendance_records ar ON ar.student_id = s.id AND ar.attendance_date = ?
      ${statsWhereClause}
    `;
    
    const [presentRows] = await masterPool.query(presentQuery, [attendanceDate, ...statsParams]);
    const [absentRows] = await masterPool.query(absentQuery, [attendanceDate, ...statsParams]);
    const [markedRows] = await masterPool.query(markedQuery, [attendanceDate, ...statsParams]);
    
    const presentCount = parseInt(presentRows[0]?.count || 0, 10);
    const absentCount = parseInt(absentRows[0]?.count || 0, 10);
    const markedCount = parseInt(markedRows[0]?.count || 0, 10);
    const unmarkedCount = Math.max(0, total - markedCount);
    
    const statistics = {
      total: total,
      present: presentCount,
      absent: absentCount,
      marked: markedCount,
      unmarked: unmarkedCount
    };

    // Apply pagination to data query
    if (parsedLimit && parsedLimit > 0) {
      query += ' LIMIT ? OFFSET ?';
      params.push(parsedLimit, parsedOffset);
    }

    const [rows] = await masterPool.query(query, params);

    const students = rows.map((row) => {
      const studentData = parseStudentData(row.student_data);

      const resolvedName =
        row.student_name ||
        studentData['Student Name'] ||
        studentData['student_name'] ||
        null;

      const parentMobile1 =
        row.parent_mobile1 ||
        studentData['Parent Mobile Number 1'] ||
        studentData['Parent Phone Number 1'] ||
        null;

      const parentMobile2 =
        row.parent_mobile2 ||
        studentData['Parent Mobile Number 2'] ||
        studentData['Parent Phone Number 2'] ||
        null;

      const courseValue =
        row.course || studentData.Course || studentData.course || null;

      const branchValue =
        row.branch || studentData.Branch || studentData.branch || null;

      const pinNumberValue =
        row.pin_no ||
        studentData['PIN Number'] ||
        studentData['Pin Number'] ||
        studentData['pin_number'] ||
        studentData.pin_no ||
        null;

      const resolvedRegistrationStatus =
        (row.registration_status && String(row.registration_status).trim().length > 0)
          ? row.registration_status
          : (studentData.registration_status || studentData['Registration Status'] || null);

      const resolvedFeeStatus =
        (row.fee_status && String(row.fee_status).trim().length > 0)
          ? row.fee_status
          : (studentData.fee_status || studentData['Fee Status'] || null);

      return {
        id: row.id,
        admissionNumber: row.admission_number || studentData['Admission Number'] || studentData.admission_number || null,
        pinNumber: pinNumberValue,
        studentName: resolvedName,
        parentMobile1,
        parentMobile2,
        photo: row.student_photo,
        batch: row.batch || studentData.Batch || null,
        course: courseValue,
        branch: branchValue,
        currentYear: row.current_year || studentData['Current Academic Year'] || null,
        currentSemester: row.current_semester || studentData['Current Semester'] || null,
        attendanceStatus: row.attendance_status || null,
        registration_status: resolvedRegistrationStatus,
        fee_status: resolvedFeeStatus,
        smsSent: row.sms_sent === 1 || row.sms_sent === true
      };
    });

    res.json({
      success: true,
      data: {
        date: attendanceDate,
        students,
        holiday: holidayInfo,
        statistics
      },
      pagination: {
        total,
        limit: parsedLimit || null,
        offset: parsedOffset
      }
    });
  } catch (error) {
    console.error('Failed to fetch attendance list:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance'
    });
  }
};

exports.deleteAttendanceForDate = async (req, res) => {
  try {
    const attendanceDate = getDateOnlyString(req.query.date || req.body.date);
    const countOnly = req.query.countOnly === 'true' || req.body.countOnly === true;
    
    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance date supplied'
      });
    }

    // Extract filter parameters
    const {
      batch,
      currentYear,
      currentSemester,
      studentName,
      parentMobile,
      course,
      branch
    } = req.query;

    // Build the WHERE clause for filtering students
    let whereConditions = [];
    const params = [];

    // Filter for regular students only
    whereConditions.push('s.student_status = ?');
    params.push('Regular');

    // Exclude certain courses
    if (EXCLUDED_COURSES.length > 0) {
      whereConditions.push(`s.course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`);
      params.push(...EXCLUDED_COURSES);
    }

    // Apply user scope filtering
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 's');
      if (scopeCondition) {
        whereConditions.push(scopeCondition);
        params.push(...scopeParams);
      }
    }

    // Apply filters
    if (batch) {
      whereConditions.push('s.batch = ?');
      params.push(batch);
    }

    if (currentYear) {
      const parsedYear = parseInt(currentYear, 10);
      if (!Number.isNaN(parsedYear)) {
        whereConditions.push('s.current_year = ?');
        params.push(parsedYear);
      }
    }

    if (currentSemester) {
      const parsedSemester = parseInt(currentSemester, 10);
      if (!Number.isNaN(parsedSemester)) {
        whereConditions.push('s.current_semester = ?');
        params.push(parsedSemester);
      }
    }

    if (course) {
      whereConditions.push('s.course = ?');
      params.push(course);
    }

    if (branch) {
      whereConditions.push('s.branch = ?');
      params.push(branch);
    }

    if (studentName) {
      const keyword = `%${studentName}%`;
      whereConditions.push(`(
        s.student_name LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Student Name"')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."student_name"')) LIKE ?
        OR s.pin_no LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."PIN Number"')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Pin Number"')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."pin_number"')) LIKE ?
      )`);
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (parentMobile) {
      const mobileLike = `%${parentMobile}%`;
      whereConditions.push(`(
        s.parent_mobile1 LIKE ?
        OR s.parent_mobile2 LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile 1"')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."Parent Mobile 2"')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."parent_mobile1"')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(s.student_data, '$."parent_mobile2"')) LIKE ?
      )`);
      params.push(mobileLike, mobileLike, mobileLike, mobileLike, mobileLike, mobileLike);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : 'WHERE 1=1';

    // Build query to count/delete attendance records matching filters
    // We need to join with students table to apply filters
    const queryBase = `
      FROM attendance_records AS ar
      INNER JOIN students AS s ON s.id = ar.student_id
      ${whereClause}
      AND ar.attendance_date = ?
    `;
    
    params.push(attendanceDate);

    if (countOnly) {
      // Just return the count without deleting
      const [countResult] = await masterPool.query(
        `SELECT COUNT(*) AS count ${queryBase}`,
        params
      );
      
      return res.json({
        success: true,
        message: `Found ${countResult[0].count} attendance record(s) matching filters`,
        data: {
          date: attendanceDate,
          count: countResult[0].count,
          filters: {
            batch: batch || null,
            course: course || null,
            branch: branch || null,
            currentYear: currentYear || null,
            currentSemester: currentSemester || null,
            studentName: studentName || null,
            parentMobile: parentMobile || null
          }
        }
      });
    }

    // Delete the attendance records using JOIN
    // MySQL DELETE with JOIN syntax: DELETE alias FROM table AS alias INNER JOIN ...
    const [result] = await masterPool.query(
      `DELETE ar ${queryBase}`,
      params
    );

    res.json({
      success: true,
      message: `Deleted ${result.affectedRows} attendance record(s) for ${attendanceDate}`,
      data: {
        date: attendanceDate,
        deletedCount: result.affectedRows
      }
    });
  } catch (error) {
    console.error('Failed to delete attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting attendance records'
    });
  }
};

exports.markAttendance = async (req, res) => {
  const { attendanceDate, records } = req.body || {};
  const normalizedDate = getDateOnlyString(attendanceDate);

  if (!normalizedDate) {
    return res.status(400).json({
      success: false,
      message: 'Invalid attendance date supplied'
    });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Attendance records are required'
    });
  }

  const normalizedRecords = records
    .map((record) => ({
      studentId: Number(record.studentId),
      status: record.status ? String(record.status).toLowerCase() : null,
      holidayReason: record.holidayReason ? String(record.holidayReason).trim() : null
    }))
    .filter((record) => Number.isInteger(record.studentId) && VALID_STATUSES.has(record.status));

  let isHolidayDate = false;
  try {
    const holidayInfo = await getNonWorkingDayInfo(normalizedDate);
    isHolidayDate = Boolean(holidayInfo?.isNonWorkingDay);
    if (isHolidayDate && normalizedRecords.some((r) => r.status !== 'holiday')) {
      return res.status(400).json({
        success: false,
        message: 'On holidays, only holiday status can be recorded'
      });
    }
  } catch (error) {
    console.warn('Holiday check failed during attendance mark:', error.message || error);
  }

  if (normalizedRecords.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid attendance records supplied'
    });
  }

  const uniqueStudentIds = [
    ...new Set(normalizedRecords.map((record) => record.studentId))
  ];

  let connection;

  try {
    connection = await masterPool.getConnection();
    await connection.beginTransaction();

    const [studentRows] = await connection.query(
      `
        SELECT
          s.id,
          s.admission_number,
          s.student_name,
          s.parent_mobile1,
          s.parent_mobile2,
          s.student_mobile,
          s.pin_no,
          s.batch,
          s.current_year,
          s.current_semester,
          s.college,
          s.course,
          s.branch,
          s.student_data
        FROM students s
        WHERE s.id IN (?)
          AND s.student_status = 'Regular'
      `,
      [uniqueStudentIds]
    );

    const studentMap = new Map(
      studentRows.map((row) => [
        row.id,
        {
          ...row,
          student_data: parseStudentData(row.student_data)
        }
      ])
    );

    const missingStudents = uniqueStudentIds.filter(
      (id) => !studentMap.has(id)
    );

    if (missingStudents.length > 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `Students not found: ${missingStudents.join(', ')}`
      });
    }

    const [existingRows] = await connection.query(
      `
        SELECT id, student_id, status
        FROM attendance_records
        WHERE attendance_date = ?
          AND student_id IN (?)
      `,
      [normalizedDate, uniqueStudentIds]
    );

    const existingMap = new Map(
      existingRows.map((row) => [row.student_id, row])
    );

    const adminId = req.admin?.id || null;

    let updatedCount = 0;
    let insertedCount = 0;

    const smsQueue = [];

    for (const record of normalizedRecords) {
      const student = studentMap.get(record.studentId);
      const existing = existingMap.get(record.studentId);

      if (existing) {
        if (existing.status === record.status) {
          // No change needed
          continue;
        }

        // Build UPDATE query - include holiday_reason if status is holiday
        let updateQuery = `
          UPDATE attendance_records
          SET status = ?, marked_by = ?`;
        let updateParams = [record.status, adminId];
        
        // Add holiday_reason if status is holiday and reason is provided
        if (record.status === 'holiday' && record.holidayReason) {
          updateQuery += `, holiday_reason = ?`;
          updateParams.push(record.holidayReason);
        } else if (record.status !== 'holiday') {
          // Clear holiday_reason if status is not holiday
          updateQuery += `, holiday_reason = NULL`;
        }
        
        updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        updateParams.push(existing.id);
        
        await connection.query(updateQuery, updateParams);

        updatedCount += 1;

        if (record.status === 'absent') {
          smsQueue.push({ student, attendanceDate: normalizedDate });
        }
      } else {
        // Build INSERT query - include holiday_reason if status is holiday
        // Check if we need to handle holiday_reason column
        let insertQuery = `
          INSERT INTO attendance_records
            (student_id, admission_number, attendance_date, status, marked_by`;
        let insertParams = [
          record.studentId,
          student.admission_number || null,
          normalizedDate,
          record.status,
          adminId
        ];
        
        // Add holiday_reason if status is holiday and reason is provided
        if (record.status === 'holiday' && record.holidayReason) {
          insertQuery += `, holiday_reason`;
          insertParams.push(record.holidayReason);
        }
        
        insertQuery += `) VALUES (${insertParams.map(() => '?').join(', ')})`;
        
        await connection.query(insertQuery, insertParams);

        insertedCount += 1;

        if (record.status === 'absent') {
          smsQueue.push({ student, attendanceDate: normalizedDate });
        }
      }
    }

    await connection.commit();

    // Get notification settings for attendance
    let notificationSettings = null;
    try {
      notificationSettings = await getNotificationSetting('attendance_absent');
    } catch (error) {
      console.warn('Failed to load attendance notification settings, using defaults:', error);
    }

    const notificationResults = [];
    console.log(`\n========== NOTIFICATION DISPATCH LOG (${normalizedDate}) ==========`);
    console.log(`Total absent students to notify: ${smsQueue.length}`);
    
    // Get connection again for updating SMS status
    const updateConnection = await masterPool.getConnection();
    
    for (const payload of smsQueue) {
      const student = payload.student;
      const studentData = student.student_data || {};
      
      // Extract student details for logging and response
      const studentDetails = {
        studentId: student.id,
        admissionNumber: student.admission_number || '',
        pinNumber: student.pin_no || studentData['PIN Number'] || studentData['Pin Number'] || '',
        studentName: student.student_name || studentData['Student Name'] || studentData['student_name'] || 'Unknown',
        college: student.college || studentData['College'] || studentData['college'] || '',
        course: student.course || studentData['Course'] || studentData['course'] || '',
        branch: student.branch || studentData['Branch'] || studentData['branch'] || '',
        year: student.current_year || studentData['Current Academic Year'] || '',
        semester: student.current_semester || studentData['Current Semester'] || '',
        parentMobile: student.parent_mobile1 || student.parent_mobile2 || 
                      studentData['Parent Mobile Number 1'] || studentData['Parent Phone Number 1'] || 
                      studentData['Parent Mobile Number'] || '',
        parentEmail: resolveParentEmail(student)
      };

      const result = {
        ...studentDetails,
        emailSent: false,
        smsSent: false,
        emailError: null,
        smsError: null
      };

      // Check if notifications are enabled
      const isEnabled = notificationSettings?.enabled !== false;
      
      if (isEnabled) {
        // Send SMS if enabled
        if (notificationSettings?.smsEnabled !== false && studentDetails.parentMobile) {
          try {
            const smsResult = await sendAbsenceNotification({
              ...payload,
              notificationSettings
            });
            result.smsSent = !!smsResult?.success;
            result.smsError = smsResult?.reason || null;
            result.sentTo = smsResult?.sentTo || studentDetails.parentMobile;
            result.apiResponse = smsResult?.data || null;
            
            // Update SMS status in database if SMS was sent successfully
            if (result.smsSent) {
              try {
                await updateConnection.query(
                  `
                    UPDATE attendance_records
                    SET sms_sent = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE student_id = ? AND attendance_date = ?
                  `,
                  [student.id, normalizedDate]
                );
              } catch (updateError) {
                // If column doesn't exist, try to add it (graceful fallback)
                console.warn(`Could not update sms_sent for student ${student.id}:`, updateError.message);
              }
            }
          } catch (error) {
            console.error(`SMS notification failed for ${student.admission_number}:`, error);
            result.smsError = error.message || 'unknown_error';
          }
        }

        // Email notifications removed for attendance - only SMS is sent
      } else {
        // Notifications disabled - skip
        result.smsError = 'notifications_disabled';
        result.emailError = 'notifications_disabled';
      }

      notificationResults.push(result);
    }
    
    // Release update connection
    if (updateConnection) {
      updateConnection.release();
    }
    
    // Summary log
    const smsSuccessCount = notificationResults.filter(r => r.smsSent).length;
    const emailSuccessCount = notificationResults.filter(r => r.emailSent).length;
    const smsFailedCount = notificationResults.filter(r => !r.smsSent && r.smsError && r.smsError !== 'notifications_disabled').length;
    const emailFailedCount = notificationResults.filter(r => !r.emailSent && r.emailError && r.emailError !== 'notifications_disabled').length;
    
    console.log(`\n========== NOTIFICATION DISPATCH SUMMARY ==========`);
    console.log(`📱 SMS: ✅ ${smsSuccessCount} sent, ❌ ${smsFailedCount} failed`);
    console.log(`📧 Email: ✅ ${emailSuccessCount} sent, ❌ ${emailFailedCount} failed`);
    console.log(`==================================================\n`);

    // ============================================
    // GENERATE AND SEND ATTENDANCE REPORT PDFs
    // ============================================
    // Get all attendance data for the date
    const allAttendanceData = await getAllAttendanceForDate(normalizedDate);
    
    // Get all active Principals and HODs with their access scopes
    const { getAllNotificationUsers, filterAttendanceByUserScope, areAllBatchesMarkedForUserScope } = require('../services/getUserScopeAttendance');
    const { principals, hods } = await getAllNotificationUsers();

    console.log(`\n📊 Attendance Report Status for ${normalizedDate}:`);
    console.log(`   Total attendance groups: ${allAttendanceData.length}`);
    console.log(`   Total Principals: ${principals.length}`);
    console.log(`   Total HODs: ${hods.length}`);

    const reportResults = [];
    const processedUsers = new Set(); // Track which users received reports

    // Process each Principal
    for (const principal of principals) {
      console.log(`\n👤 Checking Principal: ${principal.name} (${principal.email})`);
      console.log(`   Scope: Colleges: ${principal.collegeNames.join(', ') || 'All'}, Courses: ${principal.allCourses ? 'All' : principal.courseNames.join(', ') || 'None'}, Branches: ${principal.allBranches ? 'All' : principal.branchNames.join(', ') || 'None'}`);

      // Filter attendance data by principal's scope
      const filteredGroups = filterAttendanceByUserScope(allAttendanceData, principal);

      if (filteredGroups.length === 0) {
        console.log(`   ⚠️  No attendance data found in principal's scope`);
        continue;
      }

      console.log(`   📋 Found ${filteredGroups.length} group(s) in principal's scope`);

      // Check if all batches in principal's scope are marked
      const allMarked = areAllBatchesMarkedForUserScope(filteredGroups);

      console.log(`   ${allMarked ? '✅ All batches marked' : '⏳ Not all batches marked yet'}`);

      if (allMarked) {
        // Group filtered groups by college for per-college reports
        const groupsByCollege = new Map();
        for (const group of filteredGroups) {
          const collegeKey = group.college || 'Unknown';
          if (!groupsByCollege.has(collegeKey)) {
            groupsByCollege.set(collegeKey, []);
          }
          groupsByCollege.get(collegeKey).push(group);
        }

        // Send separate report for each college in principal's scope
        for (const [collegeName, collegeGroups] of groupsByCollege) {
          // Combine all students and attendance records from all groups for this college
          const allStudents = [];
          const allAttendanceRecords = [];
          const allBatchesData = [];

          for (const group of collegeGroups) {
            allStudents.push(...group.students);
            allAttendanceRecords.push(...group.attendanceRecords);
            allBatchesData.push(group);
          }

          // Get college ID
          let collegeId = null;
          if (principal.collegeNames.includes(collegeName)) {
            const collegeIndex = principal.collegeNames.indexOf(collegeName);
            collegeId = principal.collegeIds[collegeIndex] || null;
          }

          // Determine report scope description for this college
          const scopeDescription = principal.allCourses && principal.allBranches
            ? 'All Courses & Branches'
            : principal.allCourses
              ? `All Courses${principal.branchNames.length > 0 ? ` - ${principal.branchNames.join(', ')}` : ''}`
              : principal.allBranches
                ? `${principal.courseNames.join(', ')} - All Branches`
                : `${principal.courseNames.join(', ')}${principal.branchNames.length > 0 ? ` - ${principal.branchNames.join(', ')}` : ''}`;

          try {
            const result = await sendAttendanceReportNotifications({
              collegeId,
              collegeName: collegeName,
              courseId: null, // Scope-based report
              courseName: scopeDescription,
              branchId: null, // Scope-based report
              branchName: principal.allBranches ? 'All Branches' : principal.branchNames.join(', ') || 'All Branches',
              batch: 'All Batches',
              year: 'All Years',
              semester: 'All Semesters',
              attendanceDate: normalizedDate,
              students: allStudents,
              attendanceRecords: allAttendanceRecords,
              allBatchesData: allBatchesData,
              recipientUser: principal // Pass user info for personalized email
            });

            reportResults.push({
              user: principal.name,
              userEmail: principal.email,
              role: 'Principal',
              college: collegeName,
              ...result
            });

            processedUsers.add(principal.email);
            console.log(`   📧 Report sent to Principal: ${principal.name} (${principal.email}) for ${collegeName}`);
          } catch (error) {
            console.error(`   ❌ Error sending report to Principal ${principal.name} for ${collegeName}:`, error);
            reportResults.push({
              user: principal.name,
              userEmail: principal.email,
              role: 'Principal',
              college: collegeName,
              pdfGenerated: false,
              emailsSent: 0,
              emailsFailed: 0,
              errors: [error.message]
            });
          }
        }
      }
    }

    // Process each HOD
    for (const hod of hods) {
      console.log(`\n👤 Checking HOD: ${hod.name} (${hod.email})`);
      console.log(`   Scope: Colleges: ${hod.collegeNames.join(', ') || 'All'}, Courses: ${hod.allCourses ? 'All' : hod.courseNames.join(', ') || 'None'}, Branches: ${hod.branchNames.join(', ') || 'None'}`);

      // Filter attendance data by HOD's scope
      const filteredGroups = filterAttendanceByUserScope(allAttendanceData, hod);

      if (filteredGroups.length === 0) {
        console.log(`   ⚠️  No attendance data found in HOD's scope`);
        continue;
      }

      console.log(`   📋 Found ${filteredGroups.length} group(s) in HOD's scope`);

      // Check if all batches in HOD's scope are marked
      const allMarked = areAllBatchesMarkedForUserScope(filteredGroups);

      console.log(`   ${allMarked ? '✅ All batches marked' : '⏳ Not all batches marked yet'}`);

      if (allMarked) {
        // Combine all students and attendance records from all groups in HOD's scope
        const allStudents = [];
        const allAttendanceRecords = [];
        const allBatchesData = [];

        for (const group of filteredGroups) {
          allStudents.push(...group.students);
          allAttendanceRecords.push(...group.attendanceRecords);
          allBatchesData.push(group);
        }

        // Get IDs for recipient lookup
        let collegeId = null;
        let courseId = null;
        let branchId = null;

        if (hod.collegeIds.length > 0) {
          collegeId = hod.collegeIds[0];
        }

        if (!hod.allCourses && hod.courseIds.length > 0) {
          courseId = hod.courseIds[0];
        }

        if (!hod.allBranches && hod.branchIds.length > 0) {
          branchId = hod.branchIds[0];
        }

        // Get names for display
        const collegeName = hod.collegeNames[0] || 'Unknown';
        const courseName = hod.allCourses ? 'All Courses' : (hod.courseNames[0] || 'Unknown');
        const branchName = hod.allBranches ? 'All Branches' : (hod.branchNames[0] || 'Unknown');

        try {
          const result = await sendAttendanceReportNotifications({
            collegeId,
            collegeName,
            courseId,
            courseName,
            branchId,
            branchName,
            batch: 'All Batches',
            year: 'All Years',
            semester: 'All Semesters',
            attendanceDate: normalizedDate,
            students: allStudents,
            attendanceRecords: allAttendanceRecords,
            allBatchesData: allBatchesData,
            recipientUser: hod, // Pass user info for personalized email
            senderName: senderName // Pass sender name
          });

          reportResults.push({
            user: hod.name,
            userEmail: hod.email,
            role: 'HOD',
            ...result
          });

          processedUsers.add(hod.email);
          console.log(`   📧 Report sent to HOD: ${hod.name} (${hod.email})`);
        } catch (error) {
          console.error(`   ❌ Error sending report to HOD ${hod.name}:`, error);
          reportResults.push({
            user: hod.name,
            userEmail: hod.email,
            role: 'HOD',
            pdfGenerated: false,
            emailsSent: 0,
            emailsFailed: 0,
            errors: [error.message]
          });
        }
      }
    }

    // Log summary
    if (processedUsers.size > 0) {
      console.log(`\n📋 Summary: Reports sent to ${processedUsers.size} user(s)`);
    } else {
      console.log(`\n⏳ No reports sent - waiting for all batches to be marked in user scopes`);
    }

    // ============================================
    // AUTOMATIC DAY-END REPORT FOR COLLEGE/COURSE COMBINATIONS
    // ============================================
    // Check if all batches are marked for each college/course combination
    // If all batches are marked (pending = 0), automatically send day-end report
    console.log(`\n📊 Checking college/course combinations for automatic day-end reports...`);
    
    // Group attendance data by college/course
    const groupsByCollegeCourse = new Map();
    for (const group of allAttendanceData) {
      const college = group.college || 'Unknown';
      const course = group.course || 'Unknown';
      const key = `${college}|${course}`;
      
      if (!groupsByCollegeCourse.has(key)) {
        groupsByCollegeCourse.set(key, {
          college,
          course,
          groups: []
        });
      }
      
      groupsByCollegeCourse.get(key).groups.push(group);
    }

    const dayEndReportResults = [];
    const dayEndProcessedUsers = new Set();

    // Check each college/course combination
    for (const [key, collegeCourseData] of groupsByCollegeCourse) {
      const { college, course, groups } = collegeCourseData;
      
      // Check if all batches for this college/course are marked (pending = 0)
      const allBatchesMarked = groups.every(group => group.isFullyMarked);
      const totalGroups = groups.length;
      const markedGroups = groups.filter(g => g.isFullyMarked).length;
      
      console.log(`\n   📋 ${college} - ${course}: ${markedGroups}/${totalGroups} batches marked`);
      
      if (allBatchesMarked && totalGroups > 0) {
        console.log(`   ✅ All batches marked for ${college} - ${course}. Sending day-end report...`);
        
        // Combine all students and attendance records for this college/course
        const allStudents = [];
        const allAttendanceRecords = [];
        const allBatchesData = [];

        for (const group of groups) {
          allStudents.push(...group.students);
          allAttendanceRecords.push(...group.attendanceRecords);
          allBatchesData.push(group);
        }

        // Find relevant principals and HODs for this college/course
        const relevantPrincipals = principals.filter(principal => {
          // Check if principal has access to this college
          const hasCollegeAccess = principal.collegeNames.length === 0 || 
                                   principal.collegeNames.includes(college);
          
          // Check if principal has access to this course
          const hasCourseAccess = principal.allCourses || 
                                  principal.courseNames.includes(course);
          
          return hasCollegeAccess && hasCourseAccess;
        });

        const relevantHODs = hods.filter(hod => {
          // Check if HOD has access to this college
          const hasCollegeAccess = hod.collegeNames.length === 0 || 
                                   hod.collegeNames.includes(college);
          
          // Check if HOD has access to this course
          const hasCourseAccess = hod.allCourses || 
                                  hod.courseNames.includes(course);
          
          return hasCollegeAccess && hasCourseAccess;
        });

        // Send reports to relevant principals
        for (const principal of relevantPrincipals) {
          // Skip if already sent a report for this specific college/course combination
          const reportKey = `${principal.email}|${college}|${course}`;
          if (dayEndProcessedUsers.has(reportKey)) {
            continue;
          }

          // Get college ID
          let collegeId = null;
          if (principal.collegeNames.includes(college)) {
            const collegeIndex = principal.collegeNames.indexOf(college);
            collegeId = principal.collegeIds[collegeIndex] || null;
          }

          try {
            const result = await sendAttendanceReportNotifications({
              collegeId,
              collegeName: college,
              courseId: null,
              courseName: course,
              branchId: null,
              branchName: 'All Branches',
              batch: 'All Batches',
              year: 'All Years',
              semester: 'All Semesters',
              attendanceDate: normalizedDate,
              students: allStudents,
              attendanceRecords: allAttendanceRecords,
              allBatchesData: allBatchesData,
              recipientUser: principal
            });

            dayEndReportResults.push({
              user: principal.name,
              userEmail: principal.email,
              role: 'Principal',
              college,
              course,
              ...result
            });

            dayEndProcessedUsers.add(reportKey);
            console.log(`   📧 Day-end report sent to Principal: ${principal.name} (${principal.email}) for ${college} - ${course}`);
          } catch (error) {
            console.error(`   ❌ Error sending day-end report to Principal ${principal.name} for ${college} - ${course}:`, error);
            dayEndReportResults.push({
              user: principal.name,
              userEmail: principal.email,
              role: 'Principal',
              college,
              course,
              pdfGenerated: false,
              emailsSent: 0,
              emailsFailed: 0,
              errors: [error.message]
            });
          }
        }

        // Send reports to relevant HODs
        for (const hod of relevantHODs) {
          // Skip if already sent a report for this specific college/course combination
          const reportKey = `${hod.email}|${college}|${course}`;
          if (dayEndProcessedUsers.has(reportKey)) {
            continue;
          }

          // Get IDs for recipient lookup
          let collegeId = null;
          let courseId = null;
          let branchId = null;

          if (hod.collegeIds.length > 0 && hod.collegeNames.includes(college)) {
            const collegeIndex = hod.collegeNames.indexOf(college);
            collegeId = hod.collegeIds[collegeIndex] || null;
          }

          if (!hod.allCourses && hod.courseIds.length > 0 && hod.courseNames.includes(course)) {
            const courseIndex = hod.courseNames.indexOf(course);
            courseId = hod.courseIds[courseIndex] || null;
          }

          if (!hod.allBranches && hod.branchIds.length > 0) {
            branchId = hod.branchIds[0];
          }

          try {
            const result = await sendAttendanceReportNotifications({
              collegeId,
              collegeName: college,
              courseId,
              courseName: course,
              branchId,
              branchName: hod.allBranches ? 'All Branches' : (hod.branchNames[0] || 'All Branches'),
              batch: 'All Batches',
              year: 'All Years',
              semester: 'All Semesters',
              attendanceDate: normalizedDate,
              students: allStudents,
              attendanceRecords: allAttendanceRecords,
              allBatchesData: allBatchesData,
              recipientUser: hod
            });

            dayEndReportResults.push({
              user: hod.name,
              userEmail: hod.email,
              role: 'HOD',
              college,
              course,
              ...result
            });

            dayEndProcessedUsers.add(reportKey);
            console.log(`   📧 Day-end report sent to HOD: ${hod.name} (${hod.email}) for ${college} - ${course}`);
          } catch (error) {
            console.error(`   ❌ Error sending day-end report to HOD ${hod.name} for ${college} - ${course}:`, error);
            dayEndReportResults.push({
              user: hod.name,
              userEmail: hod.email,
              role: 'HOD',
              college,
              course,
              pdfGenerated: false,
              emailsSent: 0,
              emailsFailed: 0,
              errors: [error.message]
            });
          }
        }
      }
    }

    // Log day-end report summary
    const uniqueDayEndUsers = new Set();
    for (const key of dayEndProcessedUsers) {
      const email = key.split('|')[0];
      uniqueDayEndUsers.add(email);
    }
    
    if (dayEndProcessedUsers.size > 0) {
      console.log(`\n📋 Day-End Report Summary: ${dayEndReportResults.length} report(s) sent to ${uniqueDayEndUsers.size} unique user(s) for completed college/course combinations`);
    } else {
      console.log(`\n⏳ No day-end reports sent - no college/course combinations with all batches marked`);
    }

    // Combine report results
    const allReportResults = [...reportResults, ...dayEndReportResults];

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: {
        attendanceDate: normalizedDate,
        updatedCount,
        insertedCount,
        smsResults: notificationResults.map(r => ({
          ...r,
          success: r.smsSent || r.emailSent
        })),
        reportResults: allReportResults,
        dayEndReportResults
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Failed to mark attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking attendance'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Manually send day-end reports to Principals and HODs
exports.sendDayEndReports = async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    // Normalize date
    const normalizedDate = getDateOnlyString(date);
    
    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    // Get sender information
    const sender = req.user || req.admin;
    if (!sender) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const senderName = sender.name || sender.username || 'System';
    const senderEmail = sender.email || '';
    
    console.log(`\n📧 Manual Day-End Report Request for ${normalizedDate}`);
    console.log(`   Sender: ${senderName} (${senderEmail})`);

    // Get all attendance data for the date
    const allAttendanceData = await getAllAttendanceForDate(normalizedDate);
    
    // Filter attendance data by sender's scope first
    let filteredAttendanceData = allAttendanceData;
    if (req.userScope && !req.userScope.unrestricted) {
      const { filterAttendanceByUserScope } = require('../services/getUserScopeAttendance');
      
      // Convert req.userScope to the format needed for filterAttendanceByUserScope
      const senderScope = {
        collegeNames: req.userScope.collegeNames || [],
        courseNames: req.userScope.courseNames || [],
        branchNames: req.userScope.branchNames || [],
        allCourses: req.userScope.allCourses || false,
        allBranches: req.userScope.allBranches || false,
        role: sender.role
      };
      
      filteredAttendanceData = filterAttendanceByUserScope(allAttendanceData, senderScope);
      console.log(`   📊 Filtered by sender scope: ${filteredAttendanceData.length}/${allAttendanceData.length} groups`);
      
      if (filteredAttendanceData.length === 0) {
        return res.json({
          success: true,
          message: 'No attendance data found in your scope',
          data: {
            attendanceDate: normalizedDate,
            reportResults: [],
            totalSent: 0,
            totalFailed: 0,
            totalRecipients: 0
          }
        });
      }
    }
    
    // Get all active Principals and HODs with their access scopes
    const { getAllNotificationUsers, filterAttendanceByUserScope } = require('../services/getUserScopeAttendance');
    const { principals, hods } = await getAllNotificationUsers();

    console.log(`📊 Manual Day-End Report Status for ${normalizedDate}:`);
    console.log(`   Total attendance groups (after sender scope filter): ${filteredAttendanceData.length}`);
    console.log(`   Total Principals: ${principals.length}`);
    console.log(`   Total HODs: ${hods.length}`);

    const reportResults = [];
    const processedUsers = new Set();

    // Group attendance data by college/course
    const groupsByCollegeCourse = new Map();
    for (const group of allAttendanceData) {
      const college = group.college || 'Unknown';
      const course = group.course || 'Unknown';
      const key = `${college}|${course}`;
      
      if (!groupsByCollegeCourse.has(key)) {
        groupsByCollegeCourse.set(key, {
          college,
          course,
          groups: []
        });
      }
      
      groupsByCollegeCourse.get(key).groups.push(group);
    }

    // Process each Principal with RBAC scope filtering
    for (const principal of principals) {
      console.log(`\n👤 Processing Principal: ${principal.name} (${principal.email})`);
      console.log(`   Scope: Colleges: ${principal.collegeNames.join(', ') || 'All'}, Courses: ${principal.allCourses ? 'All' : principal.courseNames.join(', ') || 'None'}, Branches: ${principal.allBranches ? 'All' : principal.branchNames.join(', ') || 'None'}`);

      // Filter attendance data by principal's scope (from already sender-filtered data)
      const filteredGroups = filterAttendanceByUserScope(filteredAttendanceData, principal);

      if (filteredGroups.length === 0) {
        console.log(`   ⚠️  No attendance data found in principal's scope`);
        continue;
      }

      console.log(`   📋 Found ${filteredGroups.length} group(s) in principal's scope`);

      // Group filtered groups by college for per-college reports
      const groupsByCollege = new Map();
      for (const group of filteredGroups) {
        const collegeKey = group.college || 'Unknown';
        if (!groupsByCollege.has(collegeKey)) {
          groupsByCollege.set(collegeKey, []);
        }
        groupsByCollege.get(collegeKey).push(group);
      }

      // Send separate report for each college in principal's scope
      for (const [collegeName, collegeGroups] of groupsByCollege) {
        // Combine all students and attendance records from all groups for this college
        const allStudents = [];
        const allAttendanceRecords = [];
        const allBatchesData = [];

        for (const group of collegeGroups) {
          allStudents.push(...group.students);
          allAttendanceRecords.push(...group.attendanceRecords);
          allBatchesData.push(group);
        }

        // Get actual courses from groups that have students (only courses with attendance data)
        const actualCourses = [...new Set(
          collegeGroups
            .filter(g => g.students && g.students.length > 0) // Only groups with students
            .map(g => g.course)
            .filter(c => c && c !== 'Unknown')
        )];
        const actualBranches = [...new Set(
          collegeGroups
            .filter(g => g.students && g.students.length > 0) // Only groups with students
            .map(g => g.branch)
            .filter(b => b && b !== 'Unknown')
        )];

        // Get college ID
        let collegeId = null;
        if (principal.collegeNames.includes(collegeName)) {
          const collegeIndex = principal.collegeNames.indexOf(collegeName);
          collegeId = principal.collegeIds[collegeIndex] || null;
        }

        // Determine report scope description based on actual courses in the data (sender's scope)
        // Don't include branches here - they will be added separately in email subject
        let scopeDescription;
        if (actualCourses.length === 0) {
          scopeDescription = 'All Courses';
        } else if (actualCourses.length === 1) {
          scopeDescription = actualCourses[0];
        } else if (actualCourses.length <= 5) {
          // Show courses if 5 or fewer
          scopeDescription = actualCourses.join(', ');
        } else {
          // Too many courses, show count
          scopeDescription = `${actualCourses.length} Courses`;
        }

        // Determine branch name from actual branches in the data
        let branchNameForReport;
        if (actualBranches.length === 0) {
          branchNameForReport = principal.allBranches ? 'All Branches' : (principal.branchNames.join(', ') || 'All Branches');
        } else if (actualBranches.length === 1) {
          branchNameForReport = actualBranches[0];
        } else if (actualBranches.length <= 5) {
          branchNameForReport = actualBranches.join(', ');
        } else {
          branchNameForReport = `${actualBranches.length} Branches`;
        }

        const reportKey = `${principal.email}|${collegeName}`;
        if (processedUsers.has(reportKey)) {
          continue;
        }

        try {
          const result = await sendAttendanceReportNotifications({
            collegeId,
            collegeName: collegeName,
            courseId: null, // Scope-based report
            courseName: scopeDescription,
            branchId: null, // Scope-based report
            branchName: branchNameForReport,
            batch: 'All Batches',
            year: 'All Years',
            semester: 'All Semesters',
            attendanceDate: normalizedDate,
            students: allStudents,
            attendanceRecords: allAttendanceRecords,
            allBatchesData: allBatchesData,
            recipientUser: principal, // Pass user info for personalized email
            senderName: senderName // Pass sender name
          });

          reportResults.push({
            user: principal.name,
            userEmail: principal.email,
            role: 'Principal',
            college: collegeName,
            course: scopeDescription,
            ...result
          });

          processedUsers.add(reportKey);
          console.log(`   📧 Day-end report sent to Principal: ${principal.name} (${principal.email}) for ${collegeName}`);
        } catch (error) {
          console.error(`   ❌ Error sending day-end report to Principal ${principal.name} for ${collegeName}:`, error);
          reportResults.push({
            user: principal.name,
            userEmail: principal.email,
            role: 'Principal',
            college: collegeName,
            course: scopeDescription,
            pdfGenerated: false,
            emailsSent: 0,
            emailsFailed: 0,
            errors: [error.message]
          });
        }
      }
    }

    // Process each HOD with RBAC scope filtering
    for (const hod of hods) {
      console.log(`\n👤 Processing HOD: ${hod.name} (${hod.email})`);
      console.log(`   Scope: Colleges: ${hod.collegeNames.join(', ') || 'All'}, Courses: ${hod.allCourses ? 'All' : hod.courseNames.join(', ') || 'None'}, Branches: ${hod.branchNames.join(', ') || 'None'}`);

      // Filter attendance data by HOD's scope (from already sender-filtered data)
      const filteredGroups = filterAttendanceByUserScope(filteredAttendanceData, hod);

      if (filteredGroups.length === 0) {
        console.log(`   ⚠️  No attendance data found in HOD's scope`);
        continue;
      }

      console.log(`   📋 Found ${filteredGroups.length} group(s) in HOD's scope`);

      // Combine all students and attendance records from all groups in HOD's scope
      const allStudents = [];
      const allAttendanceRecords = [];
      const allBatchesData = [];

      for (const group of filteredGroups) {
        allStudents.push(...group.students);
        allAttendanceRecords.push(...group.attendanceRecords);
        allBatchesData.push(group);
      }

      // Get actual courses from groups that have students (only courses with attendance data)
      const actualCourses = [...new Set(
        filteredGroups
          .filter(g => g.students && g.students.length > 0) // Only groups with students
          .map(g => g.course)
          .filter(c => c && c !== 'Unknown')
      )];
      const actualBranches = [...new Set(
        filteredGroups
          .filter(g => g.students && g.students.length > 0) // Only groups with students
          .map(g => g.branch)
          .filter(b => b && b !== 'Unknown')
      )];

      // Get IDs for recipient lookup
      let collegeId = null;
      let courseId = null;
      let branchId = null;

      if (hod.collegeIds.length > 0) {
        collegeId = hod.collegeIds[0];
      }

      if (!hod.allCourses && hod.courseIds.length > 0) {
        courseId = hod.courseIds[0];
      }

      if (!hod.allBranches && hod.branchIds.length > 0) {
        branchId = hod.branchIds[0];
      }

      // Get names for display - use actual courses and branches from filtered data (sender's scope)
      const collegeName = hod.collegeNames[0] || 'Unknown';
      let courseName;
      if (actualCourses.length === 0) {
        courseName = hod.allCourses ? 'All Courses' : (hod.courseNames[0] || 'Unknown');
      } else if (actualCourses.length === 1) {
        courseName = actualCourses[0];
      } else if (actualCourses.length <= 5) {
        courseName = actualCourses.join(', ');
      } else {
        courseName = `${actualCourses.length} Courses`;
      }
      
      // Determine branch name from actual branches in the data
      let branchName;
      if (actualBranches.length === 0) {
        branchName = hod.allBranches ? 'All Branches' : (hod.branchNames[0] || 'Unknown');
      } else if (actualBranches.length === 1) {
        branchName = actualBranches[0];
      } else if (actualBranches.length <= 5) {
        branchName = actualBranches.join(', ');
      } else {
        branchName = `${actualBranches.length} Branches`;
      }

      const reportKey = `${hod.email}|${collegeName}|${courseName}`;
      if (processedUsers.has(reportKey)) {
        continue;
      }

      try {
        const result = await sendAttendanceReportNotifications({
          collegeId,
          collegeName,
          courseId,
          courseName,
          branchId,
          branchName,
          batch: 'All Batches',
          year: 'All Years',
          semester: 'All Semesters',
          attendanceDate: normalizedDate,
          students: allStudents,
          attendanceRecords: allAttendanceRecords,
          allBatchesData: allBatchesData,
          recipientUser: hod, // Pass user info for personalized email
          senderName: senderName // Pass sender name
        });

        reportResults.push({
          user: hod.name,
          userEmail: hod.email,
          role: 'HOD',
          college: collegeName,
          course: courseName,
          ...result
        });

        processedUsers.add(reportKey);
        console.log(`   📧 Day-end report sent to HOD: ${hod.name} (${hod.email})`);
      } catch (error) {
        console.error(`   ❌ Error sending day-end report to HOD ${hod.name}:`, error);
        reportResults.push({
          user: hod.name,
          userEmail: hod.email,
          role: 'HOD',
          college: collegeName,
          course: courseName,
          pdfGenerated: false,
          emailsSent: 0,
          emailsFailed: 0,
          errors: [error.message]
        });
      }
    }

    // Log summary
    const totalSent = reportResults.filter(r => r.emailsSent > 0).length;
    const totalFailed = reportResults.filter(r => r.emailsFailed > 0).length;

    console.log(`\n📋 Manual Day-End Report Summary: ${totalSent} report(s) sent successfully, ${totalFailed} failed`);

    res.json({
      success: true,
      message: `Day-end reports sent to ${totalSent} recipient(s)`,
      data: {
        attendanceDate: normalizedDate,
        reportResults,
        totalSent,
        totalFailed,
        totalRecipients: processedUsers.size
      }
    });
  } catch (error) {
    console.error('Failed to send day-end reports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending day-end reports'
    });
  }
};

// Retry SMS for a specific student
exports.retrySms = async (req, res) => {
  try {
    const { studentId, admissionNumber, attendanceDate, parentMobile } = req.body;
    
    if (!studentId && !admissionNumber) {
      return res.status(400).json({
        success: false,
        message: 'Student ID or admission number is required'
      });
    }
    
    // Get student details
    let query = 'SELECT * FROM students WHERE ';
    let params = [];
    
    if (studentId) {
      query += 'id = ?';
      params.push(studentId);
    } else {
      query += 'admission_number = ?';
      params.push(admissionNumber);
    }
    
    const [students] = await masterPool.query(query, params);
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    const student = {
      ...students[0],
      student_data: parseStudentData(students[0].student_data)
    };
    
    // Resolve parent mobile
    const resolvedMobile = parentMobile || 
      student.parent_mobile1 || 
      student.parent_mobile2 || 
      student.student_data?.['Parent Mobile Number 1'] ||
      student.student_data?.['Parent Phone Number 1'] ||
      student.student_data?.['Parent Mobile Number'];
    
    if (!resolvedMobile) {
      return res.json({
        success: false,
        data: {
          studentId: student.id,
          success: false,
          skipped: true,
          reason: 'missing_parent_mobile'
        }
      });
    }
    
    console.log(`[SMS RETRY] Retrying notification for student ${student.admission_number}`);
    
    // Get notification settings
    let notificationSettings = null;
    try {
      notificationSettings = await getNotificationSetting('attendance_absent');
    } catch (error) {
      console.warn('Failed to load attendance notification settings:', error);
    }
    
    // Send SMS
    const normalizedDate = attendanceDate || getDateOnlyString();
    const result = await sendAbsenceNotification({
      student: {
        ...student,
        parent_mobile1: resolvedMobile
      },
      attendanceDate: normalizedDate,
      notificationSettings
    });
    
    // Update SMS status in database if SMS was sent successfully
    if (result?.success) {
      try {
        await masterPool.query(
          `
            UPDATE attendance_records
            SET sms_sent = 1, updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ? AND attendance_date = ?
          `,
          [student.id, normalizedDate]
        );
      } catch (updateError) {
        // If column doesn't exist, try to add it (graceful fallback)
        console.warn(`Could not update sms_sent for student ${student.id}:`, updateError.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        studentId: student.id,
        ...result,
        sentTo: resolvedMobile
      }
    });
    
  } catch (error) {
    console.error('SMS retry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrying SMS'
    });
  }
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDailySummary = (rows, totalStudents, options = {}) => {
  const summary = {
    present: 0,
    absent: 0,
    holiday: 0,
    marked: 0,
    pending: 0,
    totalStudents: totalStudents || 0,
    total: totalStudents || 0,
    percentage: 0,
    isHoliday: Boolean(options.isHoliday),
    holiday: options.holiday || null
  };

  rows.forEach((row) => {
    if (row.status === 'present') summary.present = row.count;
    if (row.status === 'absent') summary.absent = row.count;
    if (row.status === 'holiday') summary.holiday = row.count;
  });

  summary.marked = (summary.present || 0) + (summary.absent || 0) + (summary.holiday || 0);
  summary.pending = Math.max((summary.totalStudents || 0) - summary.marked, 0);

  const denominator = summary.totalStudents || summary.marked || 1;
  summary.percentage = Math.round(((summary.present || 0) / denominator) * 100);

  return summary;
};

const aggregateRowsByDate = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const dateKey = formatDateKey(new Date(row.attendance_date));
    const entry = grouped.get(dateKey) || { date: dateKey, present: 0, absent: 0, holiday: 0 };
    if (row.status === 'present') entry.present += row.count;
    if (row.status === 'absent') entry.absent += row.count;
    if (row.status === 'holiday') entry.holiday += row.count;
    grouped.set(dateKey, entry);
  });
  return Array.from(grouped.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
};

const ensureContinuousSeries = (rows, startDate, endDate, holidayInfo) => {
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  const map = new Map(rows.map((row) => [row.date, row]));
  const data = [];
  const holidayDates = holidayInfo?.dates || new Set();
  const holidayDetails = holidayInfo?.details || new Map();
  while (cursor <= end) {
    const key = formatDateKey(cursor);
    const row = map.get(key) || { date: key, present: 0, absent: 0 };
    const isHoliday = holidayDates.has(key);
    const details = holidayDetails.get(key) || null;
    data.push({
      date: key,
      present: row.present || 0,
      absent: row.absent || 0,
      total: (row.present || 0) + (row.absent || 0),
      isHoliday,
      holiday: details
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return data;
};

const parseOptionalInteger = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeTextFilter = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildStudentFilterConditions = (filters = {}, alias = 'students') => {
  const prefix = alias ? `${alias}.` : '';
  const conditions = [];
  const params = [];

  const status = filters.studentStatus || filters.student_status;
  if (status) {
    conditions.push(`${prefix}student_status = ?`);
    params.push(status);
  }

  if (filters.batch) {
    conditions.push(`${prefix}batch = ?`);
    params.push(filters.batch);
  }

  if (filters.course) {
    conditions.push(`${prefix}course = ?`);
    params.push(filters.course);
  }

  // Exclude certain courses globally (e.g., M.Tech, MBA, MCS)
  if (EXCLUDED_COURSES.length > 0) {
    conditions.push(`${prefix}course NOT IN (${EXCLUDED_COURSES.map(() => '?').join(',')})`);
    params.push(...EXCLUDED_COURSES);
  }

  if (filters.branch) {
    conditions.push(`${prefix}branch = ?`);
    params.push(filters.branch);
  }

  if (Number.isInteger(filters.year)) {
    conditions.push(`${prefix}current_year = ?`);
    params.push(filters.year);
  }

  if (Number.isInteger(filters.semester)) {
    conditions.push(`${prefix}current_semester = ?`);
    params.push(filters.semester);
  }

  return { conditions, params };
};

const buildWhereClause = (filters, alias) => {
  const { conditions, params } = buildStudentFilterConditions(filters, alias);
  const clause = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
  return { clause, params };
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const referenceDate = safeDate(req.query.date) || new Date();
    const todayKey = formatDateKey(referenceDate);

    const weekStart = new Date(referenceDate);
    weekStart.setDate(referenceDate.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const filters = {
      batch: normalizeTextFilter(req.query.batch),
      course: normalizeTextFilter(req.query.course),
      branch: normalizeTextFilter(req.query.branch),
      year: parseOptionalInteger(req.query.year),
    semester: parseOptionalInteger(req.query.semester),
    studentStatus: 'Regular' // Day-end summary should only consider regular students
    };

    // Build filter conditions
    const countFilter = buildWhereClause(filters, 's');
    
    // Apply user scope filtering
    let scopeCondition = '';
    let scopeParams = [];
    if (req.userScope) {
      const { scopeCondition: scopeCond, params: scopeP } = getScopeConditionString(req.userScope, 's');
      if (scopeCond) {
        scopeCondition = ` AND ${scopeCond}`;
        scopeParams = scopeP;
      }
    }

    const [studentCountRows] = await masterPool.query(
      `SELECT COUNT(*) AS totalStudents FROM students s WHERE 1=1${countFilter.clause}${scopeCondition}`,
      [...countFilter.params, ...scopeParams]
    );
    const totalStudents = studentCountRows[0]?.totalStudents || 0;

    const dailyFilter = buildWhereClause(filters, 's');
    const [dailyRows] = await masterPool.query(
      `
        SELECT ar.status, COUNT(*) AS count
        FROM attendance_records ar
        INNER JOIN students s ON s.id = ar.student_id
        WHERE ar.attendance_date = ?${dailyFilter.clause}${scopeCondition}
        GROUP BY ar.status
      `,
      [todayKey, ...dailyFilter.params, ...scopeParams]
    );

    const windowFilter = buildWhereClause(filters, 's');
    const [weeklyRows] = await masterPool.query(
      `
        SELECT ar.attendance_date, ar.status, COUNT(*) AS count
        FROM attendance_records ar
        INNER JOIN students s ON s.id = ar.student_id
        WHERE ar.attendance_date BETWEEN ? AND ?${windowFilter.clause}${scopeCondition}
        GROUP BY attendance_date, status
        ORDER BY attendance_date ASC
      `,
      [formatDateKey(weekStart), todayKey, ...windowFilter.params, ...scopeParams]
    );

    const monthFilter = buildWhereClause(filters, 's');
    const [monthlyRows] = await masterPool.query(
      `
        SELECT ar.attendance_date, ar.status, COUNT(*) AS count
        FROM attendance_records ar
        INNER JOIN students s ON s.id = ar.student_id
        WHERE ar.attendance_date BETWEEN ? AND ?${monthFilter.clause}${scopeCondition}
        GROUP BY attendance_date, status
        ORDER BY attendance_date ASC
      `,
      [formatDateKey(monthStart), todayKey, ...monthFilter.params, ...scopeParams]
    );

    const [groupedRows] = await masterPool.query(
      `
        SELECT 
          s.college AS college,
          s.batch AS batch,
          s.course AS course,
          s.branch AS branch,
          s.current_year AS year,
          s.current_semester AS semester,
          COUNT(*) AS total_students,
          SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN ar.status = 'holiday' THEN 1 ELSE 0 END) AS holiday
        FROM students s
        LEFT JOIN attendance_records ar 
          ON ar.student_id = s.id 
          AND ar.attendance_date = ?
        WHERE 1=1${countFilter.clause}${scopeCondition}
        GROUP BY s.college, s.batch, s.course, s.branch, s.current_year, s.current_semester
        ORDER BY s.college, s.batch, s.course, s.branch, s.current_year, s.current_semester
      `,
      [todayKey, ...countFilter.params, ...scopeParams]
    );

    let todayHolidayInfo = null;
    let weeklyHolidayInfo = { dates: new Set(), details: new Map() };
    let monthlyHolidayInfo = { dates: new Set(), details: new Map() };

    try {
      todayHolidayInfo = await getNonWorkingDayInfo(todayKey);
    } catch (error) {
      todayHolidayInfo = null;
      console.warn('Unable to determine holiday status for daily summary:', error.message || error);
    }

    try {
      weeklyHolidayInfo = await getNonWorkingDaysForRange(formatDateKey(weekStart), todayKey);
    } catch (error) {
      console.warn('Failed to resolve weekly holiday range:', error.message || error);
    }

    try {
      monthlyHolidayInfo = await getNonWorkingDaysForRange(formatDateKey(monthStart), todayKey);
    } catch (error) {
      console.warn('Failed to resolve monthly holiday range:', error.message || error);
    }

    const weeklyAggregated = aggregateRowsByDate(weeklyRows);
    const monthlyAggregated = aggregateRowsByDate(monthlyRows);

    const weeklySeries = ensureContinuousSeries(
      weeklyAggregated,
      weekStart,
      referenceDate,
      weeklyHolidayInfo
    );
    const monthlySeries = ensureContinuousSeries(
      monthlyAggregated,
      monthStart,
      referenceDate,
      monthlyHolidayInfo
    );

    const weeklyTotals = weeklySeries.reduce(
      (acc, entry) => {
        if (entry.isHoliday) {
          acc.holidays += 1;
          return acc;
        }
        acc.present += entry.present;
        acc.absent += entry.absent;
        return acc;
      },
      { present: 0, absent: 0, holidays: 0 }
    );
    weeklyTotals.total = weeklyTotals.present + weeklyTotals.absent;
    weeklyTotals.workingDays = weeklySeries.length - weeklyTotals.holidays;

    const monthlyTotals = monthlySeries.reduce(
      (acc, entry) => {
        if (entry.isHoliday) {
          acc.holidays += 1;
          return acc;
        }
        acc.present += entry.present;
        acc.absent += entry.absent;
        return acc;
      },
      { present: 0, absent: 0, holidays: 0 }
    );
    monthlyTotals.total = monthlyTotals.present + monthlyTotals.absent;
    monthlyTotals.workingDays = monthlySeries.length - monthlyTotals.holidays;

    res.json({
      success: true,
      data: {
        totalStudents,
        referenceDate: todayKey,
        filters: {
          batch: filters.batch,
          course: filters.course,
          branch: filters.branch,
          year: filters.year,
          semester: filters.semester
        },
        daily: {
          date: todayKey,
          ...buildDailySummary(dailyRows, totalStudents, {
            isHoliday: todayHolidayInfo?.isNonWorkingDay,
            holiday: todayHolidayInfo
          })
        },
        weekly: {
          startDate: formatDateKey(weekStart),
          endDate: todayKey,
          totals: weeklyTotals,
          series: weeklySeries,
          holidays: weeklySeries.filter((entry) => entry.isHoliday)
        },
        monthly: {
          startDate: formatDateKey(monthStart),
          endDate: todayKey,
          totals: monthlyTotals,
          series: monthlySeries,
          holidays: monthlySeries.filter((entry) => entry.isHoliday)
        },
        groupedSummary: groupedRows.map((row) => {
          const present = Number(row.present) || 0;
          const absent = Number(row.absent) || 0;
          const holiday = Number(row.holiday) || 0;
          const total = Number(row.total_students) || 0;
          const marked = present + absent + holiday;
          return {
            college: row.college || null,
            batch: row.batch || null,
            course: row.course || null,
            branch: row.branch || null,
            year: row.year || null,
            semester: row.semester || null,
            totalStudents: total,
            presentToday: present,
            absentToday: absent,
            holidayToday: holiday,
            
            markedToday: marked,
            pendingToday: Math.max(0, total - marked)
          };
        })
      }
    });
  } catch (error) {
    console.error('Failed to fetch attendance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance summary'
    });
  }
};

const buildStudentSeries = (rows, startDate, endDate, holidayInfo) => {
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  const map = new Map(
    rows.map((row) => [formatDateKey(new Date(row.attendance_date)), row.status])
  );

  const series = [];
  const totals = { present: 0, absent: 0, unmarked: 0, holidays: 0 };
  const holidayDates = holidayInfo?.dates || new Set();
  const holidayDetails = holidayInfo?.details || new Map();

  while (cursor <= end) {
    const key = formatDateKey(cursor);
    const recordedStatus = map.get(key) || null;
    const isHoliday = holidayDates.has(key);
    const holiday = holidayDetails.get(key) || null;

    let status = recordedStatus || 'unmarked';

    if (isHoliday) {
      status = 'holiday';
      totals.holidays += 1;
    } else if (status === 'present') {
      totals.present += 1;
    } else if (status === 'absent') {
      totals.absent += 1;
    } else {
      totals.unmarked += 1;
    }

    series.push({ date: key, status, isHoliday, holiday });

    cursor.setDate(cursor.getDate() + 1);
  }

  return { series, totals };
};

exports.getStudentAttendanceHistory = async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student id'
      });
    }

    const referenceDate = safeDate(req.query.date) || new Date();
    const todayKey = formatDateKey(referenceDate);

    const [studentRows] = await masterPool.query(
      `
        SELECT id, student_name, pin_no, batch, course, branch, current_year, current_semester
        FROM students
        WHERE id = ?
      `,
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = studentRows[0];
    let semesterStartDate = null;
    let semesterEndDate = null;
    let semesterInfo = null;

    // Try to get semester dates from academic calendar
    if (student.course && student.current_year && student.current_semester) {
      try {
        // First, get the course ID from course name
        const [courseRows] = await masterPool.query(
          `SELECT id FROM courses WHERE name = ? AND is_active = 1 LIMIT 1`,
          [student.course]
        );

        if (courseRows.length > 0) {
          const courseId = courseRows[0].id;
          
          // Get the current academic year (try to find active semester)
          const [semesterRows] = await masterPool.query(
            `
              SELECT start_date, end_date, academic_year_id, year_of_study, semester_number
              FROM semesters
              WHERE course_id = ?
                AND year_of_study = ?
                AND semester_number = ?
                AND start_date <= ?
                AND end_date >= ?
              ORDER BY start_date DESC
              LIMIT 1
            `,
            [courseId, student.current_year, student.current_semester, todayKey, todayKey]
          );

          // If no active semester found, get the most recent one
          if (semesterRows.length === 0) {
            const [recentSemesterRows] = await masterPool.query(
              `
                SELECT start_date, end_date, academic_year_id, year_of_study, semester_number
                FROM semesters
                WHERE course_id = ?
                  AND year_of_study = ?
                  AND semester_number = ?
                ORDER BY start_date DESC
                LIMIT 1
              `,
              [courseId, student.current_year, student.current_semester]
            );

            if (recentSemesterRows.length > 0) {
              semesterInfo = recentSemesterRows[0];
              semesterStartDate = new Date(semesterInfo.start_date);
              semesterEndDate = new Date(semesterInfo.end_date);
            }
          } else {
            semesterInfo = semesterRows[0];
            semesterStartDate = new Date(semesterInfo.start_date);
            semesterEndDate = new Date(semesterInfo.end_date);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch semester dates:', error.message || error);
      }
    }

    // Fallback to fixed windows if semester dates not found
    let weekStart, monthStart;
    if (semesterStartDate && semesterEndDate) {
      // Use semester dates, but limit to current date if semester hasn't ended
      const effectiveEndDate = semesterEndDate > referenceDate ? referenceDate : semesterEndDate;
      const effectiveStartDate = semesterStartDate < referenceDate ? semesterStartDate : referenceDate;
      
      // For weekly: last 7 days from reference date, but within semester
      weekStart = new Date(referenceDate);
      weekStart.setDate(referenceDate.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      if (weekStart < semesterStartDate) {
        weekStart = new Date(semesterStartDate);
        weekStart.setHours(0, 0, 0, 0);
      }

      // For monthly: use semester start date or last 30 days, whichever is more recent
      monthStart = new Date(referenceDate);
      monthStart.setDate(referenceDate.getDate() - 29);
      monthStart.setHours(0, 0, 0, 0);
      if (monthStart < semesterStartDate) {
        monthStart = new Date(semesterStartDate);
        monthStart.setHours(0, 0, 0, 0);
      }
    } else {
      // Fallback to original logic
      weekStart = new Date(referenceDate);
      weekStart.setDate(referenceDate.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      monthStart = new Date(referenceDate);
      monthStart.setDate(referenceDate.getDate() - 29);
      monthStart.setHours(0, 0, 0, 0);
    }

    // Determine the date range for fetching attendance
    let queryStartDate = monthStart < weekStart ? monthStart : weekStart;
    if (semesterStartDate && queryStartDate < semesterStartDate) {
      queryStartDate = new Date(semesterStartDate);
      queryStartDate.setHours(0, 0, 0, 0);
    }

    const [historyRows] = await masterPool.query(
      `
        SELECT attendance_date, status
        FROM attendance_records
        WHERE student_id = ?
          AND attendance_date BETWEEN ? AND ?
        ORDER BY attendance_date ASC
      `,
      [studentId, formatDateKey(queryStartDate), todayKey]
    );

    const weeklyRows = historyRows.filter(
      (row) => {
        const rowDate = new Date(row.attendance_date);
        return rowDate >= weekStart && rowDate <= referenceDate;
      }
    );

    const monthlyRows = historyRows.filter(
      (row) => {
        const rowDate = new Date(row.attendance_date);
        return rowDate >= monthStart && rowDate <= referenceDate;
      }
    );

    // Determine holiday range
    const holidayStartDate = monthStart < weekStart ? monthStart : weekStart;
    let holidayRangeInfo = { dates: new Set(), details: new Map() };
    try {
      holidayRangeInfo = await getNonWorkingDaysForRange(formatDateKey(holidayStartDate), todayKey);
    } catch (error) {
      console.warn('Failed to fetch holiday range for student history:', error.message || error);
    }

    const weekly = buildStudentSeries(weeklyRows, weekStart, referenceDate, holidayRangeInfo);
    const monthly = buildStudentSeries(monthlyRows, monthStart, referenceDate, holidayRangeInfo);

    // Calculate attendance percentage based on semester dates
    let semesterAttendance = null;
    if (semesterStartDate && semesterEndDate) {
      const semesterRows = historyRows.filter(
        (row) => {
          const rowDate = new Date(row.attendance_date);
          return rowDate >= semesterStartDate && rowDate <= (semesterEndDate > referenceDate ? referenceDate : semesterEndDate);
        }
      );

      // Get holidays for semester range
      let semesterHolidayInfo = { dates: new Set(), details: new Map() };
      try {
        const semesterEndKey = semesterEndDate > referenceDate ? todayKey : formatDateKey(semesterEndDate);
        semesterHolidayInfo = await getNonWorkingDaysForRange(formatDateKey(semesterStartDate), semesterEndKey);
      } catch (error) {
        console.warn('Failed to fetch semester holiday range:', error.message || error);
      }

      const semesterSeries = buildStudentSeries(
        semesterRows,
        semesterStartDate,
        semesterEndDate > referenceDate ? referenceDate : semesterEndDate,
        semesterHolidayInfo
      );

      semesterAttendance = {
        startDate: formatDateKey(semesterStartDate),
        endDate: semesterEndDate > referenceDate ? todayKey : formatDateKey(semesterEndDate),
        totals: semesterSeries.totals,
        series: semesterSeries.series,
        holidays: semesterSeries.series.filter((entry) => entry.isHoliday)
      };
    }

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.student_name,
          pin: student.pin_no,
          batch: student.batch,
          course: student.course,
          branch: student.branch,
          currentYear: student.current_year,
          currentSemester: student.current_semester
        },
        weekly: {
          startDate: formatDateKey(weekStart),
          endDate: todayKey,
          totals: weekly.totals,
          series: weekly.series,
          holidays: weekly.series.filter((entry) => entry.isHoliday)
        },
        monthly: {
          startDate: formatDateKey(monthStart),
          endDate: todayKey,
          totals: monthly.totals,
          series: monthly.series,
          holidays: monthly.series.filter((entry) => entry.isHoliday)
        },
        semester: semesterAttendance
      }
    });
  } catch (error) {
    console.error('Failed to fetch student attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student attendance history'
    });
  }
};

const generateAggregatedReport = async (req, res, from, to, format, holidayInfo, publicHolidaysList, instituteHolidaysList) => {
  try {
    // First, get all students
    const [studentRows] = await masterPool.query(
      `
        SELECT
          s.id,
          s.batch,
          s.course,
          s.branch,
          s.current_year,
          s.current_semester
        FROM students s
        ORDER BY s.batch, s.course, s.branch, s.current_year, s.current_semester
      `
    );

    // Get all student IDs
    const studentIds = studentRows.map((row) => row.id);
    
    // Now get attendance records for these students in the date range
    let attendanceRows = [];
    if (studentIds.length > 0) {
      const [attendanceData] = await masterPool.query(
        `
          SELECT
            ar.student_id,
            ar.attendance_date,
            ar.status AS attendance_status
          FROM attendance_records ar
          WHERE ar.student_id IN (${studentIds.map(() => '?').join(',')})
            AND ar.attendance_date BETWEEN ? AND ?
          ORDER BY ar.student_id, ar.attendance_date
        `,
        [...studentIds, from, to]
      );
      attendanceRows = attendanceData;
    }

    // Initialize date set
    const dateSet = new Set();
    const cursor = new Date(from);
    const end = new Date(to);
    while (cursor <= end) {
      dateSet.add(getDateOnlyString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Create a student map for quick lookup
    const studentMap = new Map(studentRows.map((row) => [row.id, row]));

    // Group by batch, course, branch, year, semester
    const groupMap = new Map();

    // First, initialize all groups with students
    studentRows.forEach((row) => {
      const batch = row.batch || 'N/A';
      const course = row.course || 'N/A';
      const branch = row.branch || 'N/A';
      const year = row.current_year || 0;
      const semester = row.current_semester || 0;

      const key = `${batch}|${course}|${branch}|${year}|${semester}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          batch,
          course,
          branch,
          year,
          semester,
          studentIds: new Set(),
          attendance: new Map() // date -> { present: count, absent: count }
        });
      }

      const group = groupMap.get(key);
      group.studentIds.add(row.id);
    });

    // Now process attendance records
    attendanceRows.forEach((row) => {
      // Find which group this student belongs to using the map
      const student = studentMap.get(row.student_id);
      if (!student) return;

      const batch = student.batch || 'N/A';
      const course = student.course || 'N/A';
      const branch = student.branch || 'N/A';
      const year = student.current_year || 0;
      const semester = student.current_semester || 0;

      const key = `${batch}|${course}|${branch}|${year}|${semester}`;
      const group = groupMap.get(key);
      
      if (group && row.attendance_date) {
        // Normalize date to ensure consistent format matching
        const normalizedDate = getDateOnlyString(row.attendance_date);
        if (normalizedDate) {
          if (!group.attendance.has(normalizedDate)) {
            group.attendance.set(normalizedDate, { present: 0, absent: 0 });
          }
          const dayStats = group.attendance.get(normalizedDate);
          if (row.attendance_status === 'present') {
            dayStats.present += 1;
          } else if (row.attendance_status === 'absent') {
            dayStats.absent += 1;
          }
        }
      }
    });

    // Calculate totals for each group
    const aggregatedData = Array.from(groupMap.values())
      .map((group) => {
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalUnmarked = 0;

        dateSet.forEach((date) => {
          const isHoliday = holidayInfo.dates.has(date);
          if (!isHoliday) {
            const dayStats = group.attendance.get(date) || { present: 0, absent: 0 };
            totalPresent += dayStats.present;
            totalAbsent += dayStats.absent;
            const marked = dayStats.present + dayStats.absent;
            const totalStudents = group.studentIds.size;
            totalUnmarked += Math.max(0, totalStudents - marked);
          }
        });

        return {
          batch: group.batch,
          course: group.course,
          branch: group.branch,
          year: group.year,
          semester: group.semester,
          studentCount: group.studentIds.size,
          present: totalPresent,
          absent: totalAbsent,
          unmarked: totalUnmarked
        };
      })
      // Filter out rows with 0 students
      .filter((row) => row.studentCount > 0);

    // Sort aggregated data
    aggregatedData.sort((a, b) => {
      if (a.batch !== b.batch) return (a.batch || '').localeCompare(b.batch || '');
      if (a.course !== b.course) return (a.course || '').localeCompare(b.course || '');
      if (a.branch !== b.branch) return (a.branch || '').localeCompare(b.branch || '');
      if (a.year !== b.year) return a.year - b.year;
      return a.semester - b.semester;
    });

    const totalWorkingDays = dateSet.size - (holidayInfo.dates.size || 0);

    const reportData = {
      fromDate: from,
      toDate: to,
      aggregatedData,
      totalWorkingDays,
      publicHolidays: publicHolidaysList,
      instituteHolidays: instituteHolidaysList,
      totalHolidays: holidayInfo.dates.size || 0
    };

    if (format === 'json') {
      return res.json({
        success: true,
        data: reportData
      });
    }

    if (format === 'excel') {
      const xlsx = require('xlsx');
      const workbook = xlsx.utils.book_new();

      // Calculate totals
      const totals = aggregatedData.reduce(
        (acc, row) => ({
          studentCount: acc.studentCount + row.studentCount,
          present: acc.present + row.present,
          absent: acc.absent + row.absent,
          unmarked: acc.unmarked + row.unmarked
        }),
        { studentCount: 0, present: 0, absent: 0, unmarked: 0 }
      );

      // Single sheet with all data
      const allRows = [];

      // Header section
      allRows.push(['Attendance Summary Report']);
      allRows.push(['']);
      allRows.push(['Report Period', `${from} to ${to}`]);
      allRows.push(['']);
      allRows.push(['Total Working Days', totalWorkingDays]);
      allRows.push(['Total Holidays', reportData.totalHolidays]);
      allRows.push(['Total Public Holidays', publicHolidaysList.length]);
      allRows.push(['Total Institute Holidays', instituteHolidaysList.length]);
      allRows.push(['Total Groups', aggregatedData.length]);
      allRows.push(['Total Students', totals.studentCount]);
      allRows.push(['Total Present Records', totals.present]);
      allRows.push(['Total Absent Records', totals.absent]);
      allRows.push(['Total Unmarked Records', totals.unmarked]);
      allRows.push(['']);
      allRows.push(['']);

      // Attendance Summary Table
      const summaryHeader = [
        'Batch',
        'Course',
        'Branch',
        'Year',
        'Semester',
        'Student Count',
        'Total Present',
        'Total Absent',
        'Total Unmarked'
      ];
      allRows.push(summaryHeader);

      aggregatedData.forEach((row) => {
        allRows.push([
          row.batch,
          row.course,
          row.branch,
          row.year,
          row.semester,
          row.studentCount,
          row.present,
          row.absent,
          row.unmarked
        ]);
      });

      // Totals row
      allRows.push([
        'TOTAL',
        '',
        '',
        '',
        '',
        totals.studentCount,
        totals.present,
        totals.absent,
        totals.unmarked
      ]);

      allRows.push(['']);
      allRows.push(['']);

      // Holidays Section
      allRows.push(['Holidays List']);
      allRows.push(['']);
      const holidaysHeader = ['Date', 'Month', 'Year', 'Holiday Name', 'Type'];
      allRows.push(holidaysHeader);

      publicHolidaysList.forEach((holiday) => {
        allRows.push([
          holiday.date,
          holiday.month,
          holiday.year,
          holiday.name,
          'Public Holiday'
        ]);
      });

      instituteHolidaysList.forEach((holiday) => {
        allRows.push([
          holiday.date,
          holiday.month,
          holiday.year,
          holiday.name,
          'Institute Holiday'
        ]);
      });

      const mainSheet = xlsx.utils.aoa_to_sheet(allRows);
      xlsx.utils.book_append_sheet(workbook, mainSheet, 'Attendance Report');

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance_summary_${from}_to_${to}.xlsx"`
      );
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    }

    // Default: return JSON
    return res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Failed to generate aggregated report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating aggregated report'
    });
  }
};

exports.downloadAttendanceReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      format,
      batch,
      course,
      branch,
      year,
      semester,
      student_status,
      studentStatus
    } = req.query;
    const statusFilter = student_status || studentStatus || null;
    const normalizedFormat = (format || 'xlsx').toLowerCase();

    if (normalizedFormat !== 'xlsx') {
      return res.status(400).json({
        success: false,
        message: 'Only Excel (xlsx) export is supported for day-end reports currently.'
      });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'From date and to date are required'
      });
    }

    const from = getDateOnlyString(fromDate);
    const to = getDateOnlyString(toDate);

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (new Date(from) > new Date(to)) {
      return res.status(400).json({
        success: false,
        message: 'From date must be before or equal to to date'
      });
    }

    // Check if all core filters are empty (all students selected)
    // We intentionally do NOT include statusFilter here so Regular-only can still use aggregated flow.
    const isAllStudents = !batch && !course && !branch && !year && !semester;

    // Get holiday info for the date range
    let holidayInfo = { dates: new Set(), details: new Map() };
    let publicHolidaysList = [];
    let instituteHolidaysList = [];
    
    try {
      holidayInfo = await getNonWorkingDaysForRange(from, to);
      
      // Get public holidays for the date range
      const fromYear = new Date(from).getFullYear();
      const toYear = new Date(to).getFullYear();
      const years = [];
      for (let y = fromYear; y <= toYear; y++) {
        years.push(y);
      }
      
      const allPublicHolidays = [];
      for (const year of years) {
        const { holidays } = await getPublicHolidaysForYear(year);
        allPublicHolidays.push(...(holidays || []));
      }
      
      publicHolidaysList = allPublicHolidays
        .filter((h) => h.date >= from && h.date <= to)
        .map((h) => ({
          date: h.date,
          name: h.localName || h.name,
          month: new Date(h.date).getMonth() + 1,
          year: new Date(h.date).getFullYear()
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Get institute holidays
      const customHolidays = await listCustomHolidays({ startDate: from, endDate: to });
      instituteHolidaysList = customHolidays.map((h) => ({
        date: h.date,
        name: h.title || 'Institute Holiday',
        month: new Date(h.date).getMonth() + 1,
        year: new Date(h.date).getFullYear()
      }));
    } catch (error) {
      console.warn('Failed to fetch holiday info for report:', error.message || error);
    }

    // If all students selected, generate aggregated summary report
    if (isAllStudents) {
      return await generateAggregatedReport(req, res, from, to, format, holidayInfo, publicHolidaysList, instituteHolidaysList);
    }

    // First, get all students matching filters (to include students with no attendance)
    let studentQuery = `
      SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        s.batch,
        s.course,
        s.branch,
        s.current_year,
        s.current_semester,
        s.student_data
      FROM students s
      WHERE 1=1
    `;
    const studentParams = [];

    if (statusFilter) {
      studentQuery += ' AND s.student_status = ?';
      studentParams.push(statusFilter);
    }

    if (batch) {
      studentQuery += ' AND s.batch = ?';
      studentParams.push(batch);
    }

    if (course) {
      studentQuery += ' AND s.course = ?';
      studentParams.push(course);
    }

    if (branch) {
      studentQuery += ' AND s.branch = ?';
      studentParams.push(branch);
    }

    if (year) {
      const parsedYear = parseInt(year, 10);
      if (!Number.isNaN(parsedYear)) {
        studentQuery += ' AND s.current_year = ?';
        studentParams.push(parsedYear);
      }
    }

    if (semester) {
      const parsedSemester = parseInt(semester, 10);
      if (!Number.isNaN(parsedSemester)) {
        studentQuery += ' AND s.current_semester = ?';
        studentParams.push(parsedSemester);
      }
    }

    // Get all students matching filters
    const [studentRows] = await masterPool.query(studentQuery, studentParams);

    // Now get attendance records for these students in the date range
    const studentIds = studentRows.map((row) => row.id);
    let attendanceRows = [];
    
    if (studentIds.length > 0) {
      let attendanceQuery = `
        SELECT
          ar.student_id,
          ar.attendance_date,
          ar.status AS attendance_status
        FROM attendance_records ar
        WHERE ar.student_id IN (${studentIds.map(() => '?').join(',')})
          AND ar.attendance_date BETWEEN ? AND ?
        ORDER BY ar.student_id, ar.attendance_date
      `;
      
      const attendanceParams = [...studentIds, from, to];
      [attendanceRows] = await masterPool.query(attendanceQuery, attendanceParams);
    }

    // Combine student data with attendance records
    const rows = studentRows.map((student) => {
      const studentAttendance = attendanceRows.filter((ar) => ar.student_id === student.id);
      if (studentAttendance.length === 0) {
        // Return student with null attendance
        return {
          ...student,
          attendance_date: null,
          attendance_status: null
        };
      }
      // Return one row per attendance record
      return studentAttendance.map((ar) => ({
        ...student,
        attendance_date: ar.attendance_date,
        attendance_status: ar.attendance_status
      }));
    }).flat();

    // holidayInfo is already fetched at the top of the function, reuse it

    // Organize data by student
    const studentMap = new Map();
    const dateSet = new Set();

    // Initialize date set
    const cursor = new Date(from);
    const end = new Date(to);
    while (cursor <= end) {
      dateSet.add(getDateOnlyString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    rows.forEach((row) => {
      const studentId = row.id;
      if (!studentMap.has(studentId)) {
        const studentData = parseStudentData(row.student_data);
        studentMap.set(studentId, {
          id: studentId,
          admissionNumber: row.admission_number,
          pinNumber: row.pin_no || studentData['PIN Number'] || studentData['Pin Number'] || null,
          studentName: row.student_name || studentData['Student Name'] || studentData['student_name'] || 'Unknown',
          batch: row.batch || studentData.Batch || null,
          course: row.course || studentData.Course || studentData.course || null,
          branch: row.branch || studentData.Branch || studentData.branch || null,
          year: row.current_year || studentData['Current Academic Year'] || null,
          semester: row.current_semester || studentData['Current Semester'] || null,
          attendance: new Map()
        });
      }

      const student = studentMap.get(studentId);
      if (row.attendance_date) {
        // Normalize date to ensure consistent format matching
        const normalizedDate = getDateOnlyString(row.attendance_date);
        if (normalizedDate) {
          student.attendance.set(normalizedDate, row.attendance_status);
        }
      }
    });

    // Calculate statistics
    const students = Array.from(studentMap.values());
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHolidays = 0;
    let totalUnmarked = 0;

    students.forEach((student) => {
      dateSet.forEach((date) => {
        const isHoliday = holidayInfo.dates.has(date);
        const status = student.attendance.get(date) || null;

        if (isHoliday) {
          totalHolidays += 1;
        } else if (status === 'present') {
          totalPresent += 1;
        } else if (status === 'absent') {
          totalAbsent += 1;
        } else {
          totalUnmarked += 1;
        }
      });
    });

    // Convert students Map to serializable format
    const studentsData = students.map((student) => ({
      ...student,
      attendance: Object.fromEntries(student.attendance)
    }));

    const reportData = {
      fromDate: from,
      toDate: to,
      students: studentsData,
      dates: Array.from(dateSet).sort(),
      statistics: {
        totalStudents: students.length,
        totalPresent,
        totalAbsent,
        totalHolidays,
        totalUnmarked,
        workingDays: dateSet.size - (holidayInfo.dates.size || 0)
      },
      holidayInfo: {
        dates: Array.from(holidayInfo.dates),
        details: Array.from(holidayInfo.details.entries()).map(([date, info]) => ({
          date,
          ...info
        }))
      },
      filters: {
        batch: batch || null,
        course: course || null,
        branch: branch || null,
        year: year || null,
        semester: semester || null
      }
    };

    if (format === 'json') {
      return res.json({
        success: true,
        data: reportData
      });
    }

    // For Excel and PDF, we'll return JSON and let frontend handle generation
    // Or we can generate on backend - let's do backend for better control
    if (format === 'excel') {
      const xlsx = require('xlsx');

      // Create workbook
      const workbook = xlsx.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['Attendance Report Summary'],
        [''],
        ['Report Period', `${from} to ${to}`],
        [''],
        ['Total Students', reportData.statistics.totalStudents],
        ['Total Present', reportData.statistics.totalPresent],
        ['Total Absent', reportData.statistics.totalAbsent],
        ['Total Holidays', reportData.statistics.totalHolidays],
        ['Total Unmarked', reportData.statistics.totalUnmarked],
        ['Working Days', reportData.statistics.workingDays],
        [''],
        ['Filters Applied'],
        ['Batch', reportData.filters.batch || 'All'],
        ['Course', reportData.filters.course || 'All'],
        ['Branch', reportData.filters.branch || 'All'],
        ['Year', reportData.filters.year || 'All'],
        ['Semester', reportData.filters.semester || 'All']
      ];

      const summarySheet = xlsx.utils.aoa_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Detailed attendance sheet
      const headerRow = [
        'Admission Number',
        'PIN Number',
        'Student Name',
        'Batch',
        'Course',
        'Branch',
        'Year',
        'Semester',
        ...reportData.dates
      ];

      const attendanceRows = [headerRow];

      students.forEach((student) => {
        const row = [
          student.admissionNumber || '',
          student.pinNumber || '',
          student.studentName || '',
          student.batch || '',
          student.course || '',
          student.branch || '',
          student.year || '',
          student.semester || '',
          ...reportData.dates.map((date) => {
            const isHoliday = holidayInfo.dates.has(date);
            if (isHoliday) {
              return 'Holiday';
            }
            const status = student.attendance.get(date);
            if (status === 'present') return 'Present';
            if (status === 'absent') return 'Absent';
            return 'Unmarked';
          })
        ];
        attendanceRows.push(row);
      });

      const attendanceSheet = xlsx.utils.aoa_to_sheet(attendanceRows);
      xlsx.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance Details');

      // Generate buffer
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance_report_${from}_to_${to}.xlsx"`
      );
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    }

    // Default: return JSON
    return res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Failed to generate attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating attendance report'
    });
  }
};

