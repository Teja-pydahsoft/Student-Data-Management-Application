const { masterPool } = require('../config/database');
const { sendAbsenceNotification } = require('../services/smsService');

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
    const [batchRows] = await masterPool.query(
      `SELECT DISTINCT batch FROM students WHERE batch IS NOT NULL AND batch <> '' ORDER BY batch ASC`
    );
    const [yearRows] = await masterPool.query(
      `SELECT DISTINCT current_year AS currentYear FROM students WHERE current_year IS NOT NULL AND current_year <> 0 ORDER BY current_year ASC`
    );
    const [semesterRows] = await masterPool.query(
      `SELECT DISTINCT current_semester AS currentSemester FROM students WHERE current_semester IS NOT NULL AND current_semester <> 0 ORDER BY current_semester ASC`
    );
    const [courseRows] = await masterPool.query(
      `SELECT DISTINCT course FROM students WHERE course IS NOT NULL AND course <> '' ORDER BY course ASC`
    );
    const [branchRows] = await masterPool.query(
      `SELECT DISTINCT branch FROM students WHERE branch IS NOT NULL AND branch <> '' ORDER BY branch ASC`
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
        students
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

const buildDailySummary = (rows, totalStudents) => {
  const summary = { present: 0, absent: 0, total: totalStudents || 0, percentage: 0 };
  rows.forEach((row) => {
    if (row.status === 'present') summary.present = row.count;
    if (row.status === 'absent') summary.absent = row.count;
  });
  const marked = summary.present + summary.absent;
  summary.marked = marked;
  summary.pending = Math.max((summary.total || 0) - marked, 0);
  const denominator = summary.total || marked || 1;
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

const ensureContinuousSeries = (rows, startDate, endDate) => {
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  const map = new Map(rows.map((row) => [row.date, row]));
  const data = [];
  while (cursor <= end) {
    const key = formatDateKey(cursor);
    const row = map.get(key) || { date: key, present: 0, absent: 0 };
    data.push({
      date: key,
      present: row.present || 0,
      absent: row.absent || 0,
      total: (row.present || 0) + (row.absent || 0)
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

    const weeklyAggregated = aggregateRowsByDate(weeklyRows);
    const monthlyAggregated = aggregateRowsByDate(monthlyRows);

    const weeklySeries = ensureContinuousSeries(weeklyAggregated, weekStart, referenceDate);
    const monthlySeries = ensureContinuousSeries(monthlyAggregated, monthStart, referenceDate);

    const weeklyTotals = weeklySeries.reduce(
      (acc, entry) => {
        acc.present += entry.present;
        acc.absent += entry.absent;
        return acc;
      },
      { present: 0, absent: 0 }
    );
    weeklyTotals.total = weeklyTotals.present + weeklyTotals.absent;

    const monthlyTotals = monthlySeries.reduce(
      (acc, entry) => {
        acc.present += entry.present;
        acc.absent += entry.absent;
        return acc;
      },
      { present: 0, absent: 0 }
    );
    monthlyTotals.total = monthlyTotals.present + monthlyTotals.absent;

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
          ...buildDailySummary(dailyRows, totalStudents)
        },
        weekly: {
          startDate: formatDateKey(weekStart),
          endDate: todayKey,
          totals: weeklyTotals,
          series: weeklySeries
        },
        monthly: {
          startDate: formatDateKey(monthStart),
          endDate: todayKey,
          totals: monthlyTotals,
          series: monthlySeries
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

const buildStudentSeries = (rows, startDate, endDate) => {
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  const map = new Map(
    rows.map((row) => [formatDateKey(new Date(row.attendance_date)), row.status])
  );

  const series = [];
  const totals = { present: 0, absent: 0, unmarked: 0 };

  while (cursor <= end) {
    const key = formatDateKey(cursor);
    const status = map.get(key) || 'unmarked';
    series.push({ date: key, status });

    if (status === 'present') totals.present += 1;
    else if (status === 'absent') totals.absent += 1;
    else totals.unmarked += 1;

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

    const weekly = buildStudentSeries(weeklyRows, weekStart, referenceDate);
    const monthly = buildStudentSeries(historyRows, monthStart, referenceDate);

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
          series: weekly.series
        },
        monthly: {
          startDate: formatDateKey(monthStart),
          endDate: todayKey,
          totals: monthly.totals,
          series: monthly.series
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

