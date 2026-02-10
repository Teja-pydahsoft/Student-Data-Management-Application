/**
 * Subjects Controller (Pydah v2.0)
 * CRUD for subjects (per college/course/branch) with Theory/Lab classification.
 */

const { masterPool } = require('../config/database');

function buildScopeCondition(scope) {
  if (!scope || scope.unrestricted) return { condition: '1=1', params: [] };
  const parts = [];
  const params = [];
  if (scope.collegeIds?.length) { parts.push('s.college_id IN (?)'); params.push(scope.collegeIds); }
  if (!scope.allCourses && scope.courseIds?.length) { parts.push('s.course_id IN (?)'); params.push(scope.courseIds); }
  if (!scope.allBranches && scope.branchIds?.length) { parts.push('(s.branch_id IS NULL OR s.branch_id IN (?))'); params.push(scope.branchIds); }
  if (parts.length === 0) return { condition: '1=1', params: [] };
  return { condition: parts.join(' AND '), params }; // each param is array for IN (?)
}

exports.list = async (req, res) => {
  try {
    const { college_id, course_id, branch_id } = req.query;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);

    let sql = `SELECT s.id, s.college_id, s.course_id, s.branch_id, s.name, s.code, s.subject_type, 
               s.units, s.experiments_count, s.credits, s.is_active,
               c.name AS college_name, cr.name AS course_name, b.name AS branch_name
               FROM subjects s
               LEFT JOIN colleges c ON c.id = s.college_id
               LEFT JOIN courses cr ON cr.id = s.course_id
               LEFT JOIN course_branches b ON b.id = s.branch_id
               WHERE ${condition}`;
    const queryParams = [...(params || [])];

    if (college_id) { sql += ' AND s.college_id = ?'; queryParams.push(college_id); }
    if (course_id) { sql += ' AND s.course_id = ?'; queryParams.push(course_id); }
    if (branch_id) { sql += ' AND (s.branch_id IS NULL OR s.branch_id = ?)'; queryParams.push(branch_id); }
    sql += ' ORDER BY s.name';

    const [rows] = await masterPool.query(sql, queryParams);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('subjects list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
};

exports.create = async (req, res) => {
  try {
    const { college_id, course_id, branch_id, name, code, subject_type, units, experiments_count, credits } = req.body;

    if (!college_id || !course_id || !name || !code || !credits) {
      return res.status(400).json({ success: false, message: 'college_id, course_id, name, code, and credits are required' });
    }

    // Validate subject type
    if (subject_type && !['theory', 'lab'].includes(subject_type)) {
      return res.status(400).json({ success: false, message: 'subject_type must be either "theory" or "lab"' });
    }

    // Validate units for theory subjects
    if (subject_type === 'theory' && !units) {
      return res.status(400).json({ success: false, message: 'Units are required for theory subjects' });
    }

    // Validate experiments count for lab subjects
    if (subject_type === 'lab' && !experiments_count) {
      return res.status(400).json({ success: false, message: 'Experiments count is required for lab subjects' });
    }

    const scope = req.userScope || {};
    if (!scope.unrestricted && scope.collegeIds?.length && !scope.collegeIds.includes(Number(college_id))) {
      return res.status(403).json({ success: false, message: 'Not allowed for this college' });
    }

    const [r] = await masterPool.query(
      `INSERT INTO subjects (college_id, course_id, branch_id, name, code, subject_type, units, experiments_count, credits) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        college_id,
        course_id,
        branch_id || null,
        name,
        code || null,
        subject_type || 'theory',
        subject_type === 'theory' ? units : null,
        subject_type === 'lab' ? experiments_count : null,
        credits || null
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        id: r.insertId,
        college_id,
        course_id,
        branch_id: branch_id || null,
        name,
        code: code || null,
        subject_type: subject_type || 'theory',
        units: subject_type === 'theory' ? units : null,
        experiments_count: subject_type === 'lab' ? experiments_count : null,
        credits: credits || null
      }
    });
  } catch (error) {
    console.error('subjects create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create subject' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, subject_type, units, experiments_count, credits, is_active } = req.body;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);

    const [existing] = await masterPool.query(
      `SELECT id, subject_type FROM subjects s WHERE s.id = ? AND (${condition})`,
      [id, ...params]
    );
    if (!existing?.length) return res.status(404).json({ success: false, message: 'Subject not found' });

    // Validate subject type change
    if (subject_type && !['theory', 'lab'].includes(subject_type)) {
      return res.status(400).json({ success: false, message: 'subject_type must be either "theory" or "lab"' });
    }

    if (code !== undefined && !code) {
      return res.status(400).json({ success: false, message: 'Subject code cannot be empty' });
    }

    if (credits !== undefined && (credits === null || credits === '')) {
      return res.status(400).json({ success: false, message: 'Credits cannot be empty' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (code !== undefined) { updates.push('code = ?'); values.push(code); }
    if (subject_type !== undefined) {
      updates.push('subject_type = ?');
      values.push(subject_type);

      // Clear opposite field when changing type
      if (subject_type === 'theory') {
        updates.push('experiments_count = NULL');
      } else if (subject_type === 'lab') {
        updates.push('units = NULL');
      }
    }

    if (units !== undefined) { updates.push('units = ?'); values.push(units); }
    if (experiments_count !== undefined) { updates.push('experiments_count = ?'); values.push(experiments_count); }
    if (credits !== undefined) { updates.push('credits = ?'); values.push(credits); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(!!is_active); }

    if (updates.length === 0) return res.json({ success: true });

    values.push(id);
    await masterPool.query(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    console.error('subjects update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update subject' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.userScope || {};
    const { condition, params } = buildScopeCondition(scope);
    const [r] = await masterPool.query(
      `DELETE s FROM subjects s WHERE s.id = ? AND (${condition})`,
      [id, ...params]
    );
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Subject not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('subjects remove error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete subject' });
  }
};
