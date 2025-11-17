const { masterPool } = require('../config/database');
const { sendAbsenceNotification } = require('../services/smsService');
const {
  getNonWorkingDayInfo,
  getNonWorkingDaysForRange
} = require('../services/nonWorkingDayService');
const { listCustomHolidays } = require('../services/customHolidayService');
const { getPublicHolidaysForYear } = require('../services/holidayService');

const VALID_STATUSES = new Set(['present', 'absent']);

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
    
    // Fetch distinct values for each filter, applying cascading filters
    const [batchRows] = await masterPool.query(
      `SELECT DISTINCT batch FROM students ${whereClause} AND batch IS NOT NULL AND batch <> '' ORDER BY batch ASC`,
      params
    );
    const [yearRows] = await masterPool.query(
      `SELECT DISTINCT current_year AS currentYear FROM students ${whereClause} AND current_year IS NOT NULL AND current_year <> 0 ORDER BY current_year ASC`,
      params
    );
    const [semesterRows] = await masterPool.query(
      `SELECT DISTINCT current_semester AS currentSemester FROM students ${whereClause} AND current_semester IS NOT NULL AND current_semester <> 0 ORDER BY current_semester ASC`,
      params
    );
    const [courseRows] = await masterPool.query(
      `SELECT DISTINCT course FROM students ${whereClause} AND course IS NOT NULL AND course <> '' ORDER BY course ASC`,
      params
    );
    const [branchRows] = await masterPool.query(
      `SELECT DISTINCT branch FROM students ${whereClause} AND branch IS NOT NULL AND branch <> '' ORDER BY branch ASC`,
      params
    );

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
        s.current_year,
        s.current_semester,
        s.student_data,
        ar.id AS attendance_record_id,
        ar.status AS attendance_status
      FROM students s
      LEFT JOIN attendance_records ar
        ON ar.student_id = s.id
       AND ar.attendance_date = ?
      WHERE 1=1
    `;

    const params = [attendanceDate];

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

    const parsedLimit = limit ? parseInt(limit, 10) : null;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

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

      return {
        id: row.id,
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
        attendanceStatus: row.attendance_status || null
      };
    });

    res.json({
      success: true,
      data: {
        date: attendanceDate,
        students,
        holiday: holidayInfo
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

  try {
    const holidayInfo = await getNonWorkingDayInfo(normalizedDate);
    if (holidayInfo?.isNonWorkingDay) {
      return res.status(400).json({
        success: false,
        message: 'Attendance cannot be recorded on holidays'
      });
    }
  } catch (error) {
    console.warn('Holiday check failed during attendance mark:', error.message || error);
  }

  const normalizedRecords = records
    .map((record) => ({
      studentId: Number(record.studentId),
      status: record.status ? String(record.status).toLowerCase() : null
    }))
    .filter((record) => Number.isInteger(record.studentId) && VALID_STATUSES.has(record.status));

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
          id,
          admission_number,
          student_name,
          parent_mobile1,
          parent_mobile2,
          batch,
          current_year,
          current_semester,
          student_data
        FROM students
        WHERE id IN (?)
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

        await connection.query(
          `
            UPDATE attendance_records
            SET status = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [record.status, adminId, existing.id]
        );

        updatedCount += 1;

        if (record.status === 'absent') {
          smsQueue.push({ student, attendanceDate: normalizedDate });
        }
      } else {
        await connection.query(
          `
            INSERT INTO attendance_records
              (student_id, admission_number, attendance_date, status, marked_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          [
            record.studentId,
            student.admission_number || null,
            normalizedDate,
            record.status,
            adminId
          ]
        );

        insertedCount += 1;

        if (record.status === 'absent') {
          smsQueue.push({ student, attendanceDate: normalizedDate });
        }
      }
    }

    await connection.commit();

    const smsResults = [];
    for (const payload of smsQueue) {
      try {
        const result = await sendAbsenceNotification(payload);
        smsResults.push({
          studentId: payload.student.id,
          success: !!result?.success,
          ...result
        });
      } catch (error) {
        console.error('SMS notification failed:', error);
        smsResults.push({
          studentId: payload.student.id,
          success: false,
          reason: error.message || 'unknown_error'
        });
      }
    }

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: {
        attendanceDate: normalizedDate,
        updatedCount,
        insertedCount,
        smsResults
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
    marked: 0,
    pending: 0,
    totalStudents: totalStudents || 0,
    total: totalStudents || 0,
    percentage: 0,
    isHoliday: Boolean(options.isHoliday),
    holiday: options.holiday || null
  };

  if (summary.isHoliday) {
    return summary;
  }

  rows.forEach((row) => {
    if (row.status === 'present') summary.present = row.count;
    if (row.status === 'absent') summary.absent = row.count;
  });

  summary.marked = summary.present + summary.absent;
  summary.pending = Math.max((summary.totalStudents || 0) - summary.marked, 0);

  const denominator = summary.totalStudents || summary.marked || 1;
  summary.percentage = Math.round(((summary.present || 0) / denominator) * 100);

  return summary;
};

const aggregateRowsByDate = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const dateKey = formatDateKey(new Date(row.attendance_date));
    const entry = grouped.get(dateKey) || { date: dateKey, present: 0, absent: 0 };
    if (row.status === 'present') entry.present += row.count;
    if (row.status === 'absent') entry.absent += row.count;
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

  if (filters.batch) {
    conditions.push(`${prefix}batch = ?`);
    params.push(filters.batch);
  }

  if (filters.course) {
    conditions.push(`${prefix}course = ?`);
    params.push(filters.course);
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
      semester: parseOptionalInteger(req.query.semester)
    };

    const countFilter = buildWhereClause(filters, 's');

    const [studentCountRows] = await masterPool.query(
      `SELECT COUNT(*) AS totalStudents FROM students s WHERE 1=1${countFilter.clause}`,
      countFilter.params
    );
    const totalStudents = studentCountRows[0]?.totalStudents || 0;

    const dailyFilter = buildWhereClause(filters, 's');
    const [dailyRows] = await masterPool.query(
      `
        SELECT ar.status, COUNT(*) AS count
        FROM attendance_records ar
        INNER JOIN students s ON s.id = ar.student_id
        WHERE ar.attendance_date = ?${dailyFilter.clause}
        GROUP BY ar.status
      `,
      [todayKey, ...dailyFilter.params]
    );

    const windowFilter = buildWhereClause(filters, 's');
    const [weeklyRows] = await masterPool.query(
      `
        SELECT ar.attendance_date, ar.status, COUNT(*) AS count
        FROM attendance_records ar
        INNER JOIN students s ON s.id = ar.student_id
        WHERE ar.attendance_date BETWEEN ? AND ?${windowFilter.clause}
        GROUP BY attendance_date, status
        ORDER BY attendance_date ASC
      `,
      [formatDateKey(weekStart), todayKey, ...windowFilter.params]
    );

    const monthFilter = buildWhereClause(filters, 's');
    const [monthlyRows] = await masterPool.query(
      `
        SELECT ar.attendance_date, ar.status, COUNT(*) AS count
        FROM attendance_records ar
        INNER JOIN students s ON s.id = ar.student_id
        WHERE ar.attendance_date BETWEEN ? AND ?${monthFilter.clause}
        GROUP BY attendance_date, status
        ORDER BY attendance_date ASC
      `,
      [formatDateKey(monthStart), todayKey, ...monthFilter.params]
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
        }
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

    const weekStart = new Date(referenceDate);
    weekStart.setDate(referenceDate.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(referenceDate);
    monthStart.setDate(referenceDate.getDate() - 29);
    monthStart.setHours(0, 0, 0, 0);

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

    const [historyRows] = await masterPool.query(
      `
        SELECT attendance_date, status
        FROM attendance_records
        WHERE student_id = ?
          AND attendance_date BETWEEN ? AND ?
        ORDER BY attendance_date ASC
      `,
      [studentId, formatDateKey(monthStart), todayKey]
    );

    const weeklyRows = historyRows.filter(
      (row) => new Date(row.attendance_date) >= weekStart
    );

    let holidayRangeInfo = { dates: new Set(), details: new Map() };
    try {
      holidayRangeInfo = await getNonWorkingDaysForRange(formatDateKey(monthStart), todayKey);
    } catch (error) {
      console.warn('Failed to fetch holiday range for student history:', error.message || error);
    }

    const weekly = buildStudentSeries(weeklyRows, weekStart, referenceDate, holidayRangeInfo);
    const monthly = buildStudentSeries(historyRows, monthStart, referenceDate, holidayRangeInfo);

    res.json({
      success: true,
      data: {
        student: {
          id: studentRows[0].id,
          name: studentRows[0].student_name,
          pin: studentRows[0].pin_no,
          batch: studentRows[0].batch,
          course: studentRows[0].course,
          branch: studentRows[0].branch,
          currentYear: studentRows[0].current_year,
          currentSemester: studentRows[0].current_semester
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
        }
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
    const { fromDate, toDate, format, batch, course, branch, year, semester } = req.query;

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

    // Check if all filters are empty (all students selected)
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

