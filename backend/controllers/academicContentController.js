/**
 * Academic Content Controller (Pydah v2.0)
 * Notes, assignments, tests - list/create/update/delete; student submissions.
 */

const { masterPool } = require('../config/database');

function buildScopeCondition(scope) {
  if (!scope || scope.unrestricted) return { condition: '1=1', params: [] };
  const parts = [];
  const params = [];
  if (scope.collegeIds?.length) { parts.push('ac.college_id IN (?)'); params.push(scope.collegeIds); }
  if (!scope.allCourses && scope.courseIds?.length) { parts.push('(ac.course_id IS NULL OR ac.course_id IN (?))'); params.push(scope.courseIds); }
  if (!scope.allBranches && scope.branchIds?.length) { parts.push('(ac.branch_id IS NULL OR ac.branch_id IN (?))'); params.push(scope.branchIds); }
  if (parts.length === 0) return { condition: '1=1', params: [] };
  return { condition: parts.join(' AND '), params };
}

exports.list = async (req, res) => {
  try {
    const { type, college_id, course_id, subject_id, student_id } = req.query;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    let sql = `SELECT ac.id, ac.type, ac.title, ac.description, ac.file_url, ac.subject_id, ac.college_id, ac.course_id, ac.branch_id,
               ac.posted_by, ac.due_date, ac.max_marks, ac.is_published, ac.created_at,
               s.name AS subject_name
               FROM academic_content ac
               LEFT JOIN subjects s ON s.id = ac.subject_id
               WHERE ac.is_published = 1 AND (${condition})`;
    const queryParams = [...(params || [])];
    if (type) { sql += ' AND ac.type = ?'; queryParams.push(type); }
    if (college_id) { sql += ' AND ac.college_id = ?'; queryParams.push(college_id); }
    if (course_id) { sql += ' AND ac.course_id = ?'; queryParams.push(course_id); }
    if (subject_id) { sql += ' AND ac.subject_id = ?'; queryParams.push(subject_id); }
    sql += ' ORDER BY ac.due_date IS NULL ASC, ac.due_date ASC, ac.created_at DESC';

    const [rows] = await masterPool.query(sql, queryParams);
    let data = rows;

    if (student_id) {
      const [subs] = await masterPool.query(
        'SELECT content_id, marks, max_marks, submitted_at FROM content_submissions WHERE student_id = ?',
        [student_id]
      );
      const byContent = {};
      subs.forEach((r) => { byContent[r.content_id] = r; });
      data = rows.map((r) => ({ ...r, submission: byContent[r.id] || null }));
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('academicContent list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

exports.create = async (req, res) => {
  try {
    const { type, title, description, file_url, subject_id, college_id, course_id, branch_id, due_date, max_marks } = req.body || {};
    const posted_by = req.user?.id || req.admin?.id;
    if (!type || !title || !college_id) {
      return res.status(400).json({ success: false, message: 'type, title, college_id required' });
    }
    if (!['note', 'assignment', 'test'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be note, assignment, or test' });
    }
    const scope = req.userScope || {};
    if (!scope.unrestricted && scope.collegeIds?.length && !scope.collegeIds.includes(Number(college_id))) {
      return res.status(403).json({ success: false, message: 'Not allowed for this college' });
    }
    const [r] = await masterPool.query(
      `INSERT INTO academic_content (type, title, description, file_url, subject_id, college_id, course_id, branch_id, posted_by, due_date, max_marks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, title, description || null, file_url || null, subject_id || null, college_id, course_id || null, branch_id || null, posted_by, due_date || null, max_marks || null]
    );
    res.status(201).json({ success: true, data: { id: r.insertId, type, title } });
  } catch (error) {
    console.error('academicContent create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create content' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    const [rows] = await masterPool.query(
      `SELECT ac.*, s.name AS subject_name FROM academic_content ac LEFT JOIN subjects s ON s.id = ac.subject_id
       WHERE ac.id = ? AND (${condition})`,
      [id, ...(params || [])]
    );
    if (!rows?.length) return res.status(404).json({ success: false, message: 'Content not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('academicContent getById error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, file_url, due_date, max_marks, is_published } = req.body || {};
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    const [existing] = await masterPool.query(
      `SELECT id FROM academic_content WHERE id = ? AND (${condition})`,
      [id, ...(params || [])]
    );
    if (!existing?.length) return res.status(404).json({ success: false, message: 'Content not found' });
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (file_url !== undefined) { updates.push('file_url = ?'); values.push(file_url); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
    if (max_marks !== undefined) { updates.push('max_marks = ?'); values.push(max_marks); }
    if (is_published !== undefined) { updates.push('is_published = ?'); values.push(!!is_published); }
    if (updates.length === 0) return res.json({ success: true });
    values.push(id);
    await masterPool.query(`UPDATE academic_content SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    console.error('academicContent update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update content' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    const [r] = await masterPool.query(
      `DELETE FROM academic_content WHERE id = ? AND (${condition})`,
      [id, ...(params || [])]
    );
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Content not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('academicContent remove error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete content' });
  }
};

exports.submit = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_url, marks } = req.body || {};
    const user = req.user || req.admin;
    if (user?.role !== 'student' && !user?.admission_number) {
      return res.status(403).json({ success: false, message: 'Student only' });
    }
    const [students] = await masterPool.query(
      'SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1',
      [user.admission_number || user.admissionNumber, user.admission_number || user.admissionNo]
    );
    if (!students.length) return res.status(403).json({ success: false, message: 'Student not found' });
    const student_id = students[0].id;
    const [content] = await masterPool.query(
      'SELECT id, type, max_marks FROM academic_content WHERE id = ? AND is_published = 1',
      [id]
    );
    if (!content.length) return res.status(404).json({ success: false, message: 'Content not found' });
    const submission_type = content[0].type === 'test' ? 'test' : 'assignment';
    await masterPool.query(
      `INSERT INTO content_submissions (content_id, student_id, submission_type, file_url, marks, max_marks)
       VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE file_url = COALESCE(VALUES(file_url), file_url), marks = COALESCE(VALUES(marks), marks)`,
      [id, student_id, submission_type, file_url || null, marks || null, content[0].max_marks || null]
    );
    res.json({ success: true, message: 'Submitted' });
  } catch (error) {
    console.error('academicContent submit error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit' });
  }
};
