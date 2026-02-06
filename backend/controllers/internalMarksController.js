/**
 * Internal Marks Controller (Pydah v2.0)
 * List/add/update internal marks per student/subject/semester.
 */

const { masterPool } = require('../config/database');

function buildScopeCondition(scope) {
  if (!scope || scope.unrestricted) return { condition: '1=1', params: [] };
  const parts = [];
  const params = [];
  if (scope.collegeIds?.length) {
    parts.push('st.college_id IN (?)');
    params.push(scope.collegeIds);
  }
  if (!scope.allCourses && scope.courseIds?.length) {
    parts.push('st.course_id IN (?)');
    params.push(scope.courseIds);
  }
  if (parts.length === 0) return { condition: '1=1', params: [] };
  return { condition: parts.join(' AND '), params };
}

exports.list = async (req, res) => {
  try {
    const { student_id, subject_id, academic_year, semester } = req.query;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    let sql = `SELECT im.id, im.student_id, im.subject_id, im.academic_year, im.semester, im.marks_type, im.marks, im.max_marks, im.created_at,
               st.name AS subject_name
               FROM internal_marks im
               JOIN subjects st ON st.id = im.subject_id
               WHERE (${condition})`;
    const queryParams = [...(params || [])];
    if (student_id) { sql += ' AND im.student_id = ?'; queryParams.push(student_id); }
    if (subject_id) { sql += ' AND im.subject_id = ?'; queryParams.push(subject_id); }
    if (academic_year) { sql += ' AND im.academic_year = ?'; queryParams.push(academic_year); }
    if (semester) { sql += ' AND im.semester = ?'; queryParams.push(semester); }
    sql += ' ORDER BY im.student_id, im.subject_id, im.marks_type';
    const [rows] = await masterPool.query(sql, queryParams);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('internalMarks list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch internal marks' });
  }
};

exports.upsert = async (req, res) => {
  try {
    const { student_id, subject_id, academic_year, semester, marks_type, marks, max_marks } = req.body || {};
    const created_by = req.user?.id || req.admin?.id;
    if (!student_id || !subject_id || !marks_type || marks == null) {
      return res.status(400).json({ success: false, message: 'student_id, subject_id, marks_type, marks required' });
    }
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    const [subjectCheck] = await masterPool.query(
      `SELECT 1 FROM subjects st WHERE st.id = ? AND (${condition})`,
      [subject_id, ...(params || [])]
    );
    if (!subjectCheck?.length) return res.status(403).json({ success: false, message: 'Subject not in scope' });
    const [check] = await masterPool.query(
      `SELECT id FROM internal_marks
       WHERE student_id = ? AND subject_id = ? AND marks_type = ? AND (academic_year <=> ?) AND (semester <=> ?)`,
      [student_id, subject_id, marks_type, academic_year || null, semester || null]
    );
    const max = max_marks != null ? max_marks : 100;
    if (check?.length) {
      await masterPool.query(
        'UPDATE internal_marks SET marks = ?, max_marks = ?, created_by = ? WHERE id = ?',
        [marks, max, created_by, check[0].id]
      );
      return res.json({ success: true, message: 'Updated' });
    }
    await masterPool.query(
      `INSERT INTO internal_marks (student_id, subject_id, academic_year, semester, marks_type, marks, max_marks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, subject_id, academic_year || null, semester || null, marks_type, marks, max, created_by]
    );
    res.json({ success: true, message: 'Created' });
  } catch (error) {
    console.error('internalMarks upsert error:', error);
    res.status(500).json({ success: false, message: 'Failed to save internal marks' });
  }
};

/** GET for student (own marks) */
exports.getByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const user = req.user || req.admin;
    let sid = studentId === 'me' ? null : Number(studentId);
    if ((!sid || isNaN(sid)) && (user?.role === 'student' || user?.admission_number)) {
      const [s] = await masterPool.query(
        'SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1',
        [user.admission_number || user.admissionNumber, user.admission_number || user.admissionNo]
      );
      if (s.length) sid = s[0].id;
    }
    if (!sid) return res.status(400).json({ success: false, message: 'Student not found' });
    if (user?.role === 'student' && user?.admission_number) {
      const [own] = await masterPool.query(
        'SELECT id FROM students WHERE (admission_number = ? OR admission_no = ?) AND id = ?',
        [user.admission_number, user.admission_number, sid]
      );
      if (!own.length) return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const [rows] = await masterPool.query(
      `SELECT im.marks_type, im.marks, im.max_marks, im.academic_year, im.semester, st.name AS subject_name
       FROM internal_marks im JOIN subjects st ON st.id = im.subject_id WHERE im.student_id = ?
       ORDER BY im.academic_year DESC, im.semester DESC, st.name`,
      [sid]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('internalMarks getByStudent error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch marks' });
  }
};
