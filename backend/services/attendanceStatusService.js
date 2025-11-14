const { masterPool } = require('../config/database');
const { normalizeDate } = require('./customHolidayService');

const getAttendanceSubmissionCounts = async (startDate, endDate) => {
  const normalizedStart = normalizeDate(startDate);
  const normalizedEnd = normalizeDate(endDate);

  if (!normalizedStart || !normalizedEnd) {
    throw new Error('Invalid date range supplied');
  }

  const [rows] = await masterPool.query(
    `
      SELECT attendance_date, COUNT(*) AS count
      FROM attendance_records
      WHERE attendance_date BETWEEN ? AND ?
      GROUP BY attendance_date
    `,
    [normalizedStart, normalizedEnd]
  );

  const map = new Map();
  rows.forEach((row) => {
    map.set(row.attendance_date, Number(row.count) || 0);
  });

  return map;
};

const getAttendanceStatusForRange = async (startDate, endDate) => {
  return getAttendanceSubmissionCounts(startDate, endDate);
};

module.exports = {
  getAttendanceStatusForRange
};

