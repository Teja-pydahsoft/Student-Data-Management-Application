/**
 * Faculty Management Controller (Pydah v2.0)
 * List faculty, get faculty with subjects, assign subjects.
 * Employees: principals, HODs, faculty for Structure and Assign HODs.
 */

const { masterPool } = require('../config/database');
const { USER_ROLES, ROLE_LABELS } = require('../constants/rbac');

const FACULTY_ROLES = [USER_ROLES.FACULTY, 'branch_faculty', 'faculty'];
const FACULTY_ROLES_LOWER = ['faculty', 'branch_faculty'];

const EMPLOYEE_ROLES_LOWER = ['college_principal', 'college_ao', 'branch_hod', 'faculty', 'branch_faculty'];

const resolveRelativeSemester = (sem, year) => {
  const s = parseInt(sem, 10);
  const y = parseInt(year, 10);
  if (Number.isNaN(s) || Number.isNaN(y)) return sem;
  if (s > 2) {
    return ((s - 1) % 2) + 1;
  }
  return s;
};

const parseScopeData = (data) => {
  if (!data) return [];
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [data];
  }
};

function buildFacultyScopeCondition(scope) {
  if (!scope || scope.unrestricted) return { condition: '1=1', params: [] };
  const parts = [];
  const params = [];
  if (scope.collegeIds && scope.collegeIds.length > 0) {
    const ph = scope.collegeIds.map(() => '?').join(',');
    parts.push(`(u.college_id IN (${ph}) OR (COALESCE(u.college_ids, '[]') IS NOT NULL AND JSON_OVERLAPS(COALESCE(u.college_ids, '[]'), CAST(? AS JSON))))`);
    params.push(...scope.collegeIds);
    params.push(JSON.stringify(scope.collegeIds));
  }
  if (!scope.allCourses && scope.courseIds && scope.courseIds.length > 0) {
    const ph = scope.courseIds.map(() => '?').join(',');
    parts.push(`(u.course_id IN (${ph}) OR (COALESCE(u.course_ids, '[]') IS NOT NULL AND JSON_OVERLAPS(COALESCE(u.course_ids, '[]'), CAST(? AS JSON))))`);
    params.push(...scope.courseIds);
    params.push(JSON.stringify(scope.courseIds));
  }
  if (!scope.allBranches && scope.branchIds && scope.branchIds.length > 0) {
    const ph = scope.branchIds.map(() => '?').join(',');
    parts.push(`(u.branch_id IN (${ph}) OR (COALESCE(u.branch_ids, '[]') IS NOT NULL AND JSON_OVERLAPS(COALESCE(u.branch_ids, '[]'), CAST(? AS JSON))))`);
    params.push(...scope.branchIds);
    params.push(JSON.stringify(scope.branchIds));
  }
  if (parts.length === 0) return { condition: '1=1', params: [] };
  return { condition: parts.join(' AND '), params };
}

/**
 * GET /api/faculty - List faculty (scoped by current user)
 */
exports.getFaculty = async (req, res) => {
  try {
    const scope = req.userScope || {};
    const { condition, params: scopeParams } = buildFacultyScopeCondition(scope);

    // Match role case-insensitively so 'Faculty' or 'faculty' both show in Faculty Management
    const [rows] = await masterPool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.username, u.role, u.college_id, u.course_id, u.branch_id,
              u.college_ids, u.course_ids, u.branch_ids,
              u.is_active, u.created_at,
              c.name AS college_name, cr.name AS course_name, b.name AS branch_name
       FROM rbac_users u
       LEFT JOIN colleges c ON c.id = u.college_id
       LEFT JOIN courses cr ON cr.id = u.course_id
       LEFT JOIN course_branches b ON b.id = u.branch_id
       WHERE LOWER(TRIM(COALESCE(u.role, ''))) IN (?, ?) AND (${condition})
       ORDER BY u.name`,
      [...FACULTY_ROLES_LOWER, ...(scopeParams && scopeParams.length ? scopeParams : [])]
    );

    const facultyIds = rows.map((r) => r.id);
    if (facultyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const [subjectsRows] = await masterPool.query(
      `SELECT fs.rbac_user_id, fs.subject_id, s.name AS subject_name, s.code AS subject_code
       FROM faculty_subjects fs
       JOIN subjects s ON s.id = fs.subject_id
       WHERE fs.rbac_user_id IN (?)`,
      [facultyIds]
    );

    const subjectsByFaculty = {};
    subjectsRows.forEach((row) => {
      if (!subjectsByFaculty[row.rbac_user_id]) subjectsByFaculty[row.rbac_user_id] = [];
      subjectsByFaculty[row.rbac_user_id].push({
        id: row.subject_id,
        name: row.subject_name,
        code: row.subject_code
      });
    });

    const data = rows.map((r) => ({
      ...r,
      subjects: subjectsByFaculty[r.id] || []
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('getFaculty error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch faculty' });
  }
};

/**
 * GET /api/faculty/:id - Get one faculty with assigned subjects
 */
exports.getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.userScope || {};
    const { condition, params: scopeParams } = buildFacultyScopeCondition(scope);

    const [rows] = await masterPool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.username, u.role, u.college_id, u.course_id, u.branch_id,
              u.is_active, u.created_at,
              c.name AS college_name, cr.name AS course_name, b.name AS branch_name
       FROM rbac_users u
       LEFT JOIN colleges c ON c.id = u.college_id
       LEFT JOIN courses cr ON cr.id = u.course_id
       LEFT JOIN course_branches b ON b.id = u.branch_id
       WHERE u.id = ? AND LOWER(TRIM(COALESCE(u.role, ''))) IN (?, ?) AND (${condition})`,
      [id, ...FACULTY_ROLES_LOWER, ...(scopeParams && scopeParams.length ? scopeParams : [])]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    const [subjectsRows] = await masterPool.query(
      `SELECT fs.subject_id, s.name AS subject_name, s.code AS subject_code, s.course_id, s.branch_id
       FROM faculty_subjects fs
       JOIN subjects s ON s.id = fs.subject_id
       WHERE fs.rbac_user_id = ?`,
      [id]
    );

    const data = {
      ...rows[0],
      subjects: subjectsRows.map((r) => ({
        id: r.subject_id,
        name: r.subject_name,
        code: r.subject_code,
        course_id: r.course_id,
        branch_id: r.branch_id
      }))
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('getFacultyById error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch faculty' });
  }
};

/**
 * PUT /api/faculty/:id/subjects - Assign subjects to faculty
 * Body: { subjectIds: number[] }
 */
exports.assignSubjects = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectIds } = req.body || {};
    const ids = Array.isArray(subjectIds) ? subjectIds.filter((n) => Number.isInteger(Number(n))) : [];

    const scope = req.userScope || {};
    const { condition, params: scopeParams } = buildFacultyScopeCondition(scope);

    const [existing] = await masterPool.query(
      `SELECT u.id FROM rbac_users u WHERE u.id = ? AND LOWER(TRIM(COALESCE(u.role, ''))) IN (?, ?) AND (${condition})`,
      [id, ...FACULTY_ROLES_LOWER, ...(Array.isArray(scopeParams) ? scopeParams : scopeParams)]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    await masterPool.query('DELETE FROM faculty_subjects WHERE rbac_user_id = ?', [id]);

    if (ids.length > 0) {
      const values = ids.map((sid) => [id, sid]);
      await masterPool.query(
        'INSERT INTO faculty_subjects (rbac_user_id, subject_id) VALUES ?',
        [values]
      );
    }

    res.json({ success: true, message: 'Subjects assigned', subjectIds: ids });
  } catch (error) {
    console.error('assignSubjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign subjects' });
  }
};

/**
 * GET /api/faculty/employees - List principals, HODs, and faculty (for Structure, Employees, Assign HODs)
 */
exports.getEmployees = async (req, res) => {
  try {
    const scope = req.userScope || {};
    const { condition, params: scopeParams } = buildFacultyScopeCondition(scope);

    const rolePlaceholders = EMPLOYEE_ROLES_LOWER.map(() => '?').join(',');
    const [rows] = await masterPool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.username, u.role, u.college_id, u.course_id, u.branch_id,
              u.college_ids, u.course_ids, u.branch_ids, u.all_courses, u.all_branches,
              u.is_active, u.created_at,
              c.name AS college_name, cr.name AS course_name, b.name AS branch_name
       FROM rbac_users u
       LEFT JOIN colleges c ON c.id = u.college_id
       LEFT JOIN courses cr ON cr.id = u.course_id
       LEFT JOIN course_branches b ON b.id = u.branch_id
       WHERE LOWER(TRIM(COALESCE(u.role, ''))) IN (${rolePlaceholders}) AND (${condition})
       ORDER BY u.role, u.name`,
      [...EMPLOYEE_ROLES_LOWER, ...(scopeParams && scopeParams.length ? scopeParams : [])]
    );

    const allCollegeIds = new Set();
    const allCourseIds = new Set();
    const allBranchIds = new Set();

    rows.forEach(r => {
      const cIds = parseScopeData(r.college_ids);
      const crIds = parseScopeData(r.course_ids);
      const bIds = parseScopeData(r.branch_ids);
      cIds.forEach(id => allCollegeIds.add(id));
      crIds.forEach(id => allCourseIds.add(id));
      bIds.forEach(id => allBranchIds.add(id));
    });

    const collegeMap = {};
    const courseMap = {};
    const branchMap = {};

    if (allCollegeIds.size > 0) {
      const [cols] = await masterPool.query(`SELECT id, name FROM colleges WHERE id IN (${Array.from(allCollegeIds).join(',')})`);
      cols.forEach(c => collegeMap[c.id] = c.name);
    }
    if (allCourseIds.size > 0) {
      const [crs] = await masterPool.query(`SELECT id, name FROM courses WHERE id IN (${Array.from(allCourseIds).join(',')})`);
      crs.forEach(c => courseMap[c.id] = c.name);
    }
    if (allBranchIds.size > 0) {
      const [brs] = await masterPool.query(`SELECT id, name FROM course_branches WHERE id IN (${Array.from(allBranchIds).join(',')})`);
      brs.forEach(b => branchMap[b.id] = b.name);
    }

    const employees = rows.map((row) => {
      const collegeIds = parseScopeData(row.college_ids);
      const courseIds = parseScopeData(row.course_ids);
      const branchIds = parseScopeData(row.branch_ids);

      const collegeNames = collegeIds.map(id => ({ id, name: collegeMap[id] || 'Unknown' }));
      const courseNames = courseIds.map(id => ({ id, name: courseMap[id] || 'Unknown' }));
      const branchNames = branchIds.map(id => ({ id, name: branchMap[id] || 'Unknown' }));

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        username: row.username,
        role: row.role,
        roleLabel: ROLE_LABELS[row.role] || row.role || '—',
        collegeId: row.college_id,
        courseId: row.course_id,
        branchId: row.branch_id,
        collegeIds,
        courseIds,
        branchIds,
        allCourses: !!row.all_courses,
        allBranches: !!row.all_branches,
        collegeName: row.college_name,
        courseName: row.course_name,
        branchName: row.branch_name,
        collegeNames,
        courseNames,
        branchNames,
        isActive: !!row.is_active,
        createdAt: row.created_at
      };
    });

    const principals = employees.filter(e =>
      ['college_principal', 'college_ao'].includes((e.role || '').toLowerCase())
    );
    const hods = employees.filter(e => (e.role || '').toLowerCase() === 'branch_hod');
    const faculty = employees.filter(e =>
      ['faculty', 'branch_faculty'].includes((e.role || '').toLowerCase())
    );

    res.json({
      success: true,
      data: {
        principals,
        hods,
        faculty,
        all: employees
      }
    });
  } catch (error) {
    console.error('getEmployees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
};

/**
 * POST /api/faculty/assign-hod
 * Assign an existing user as HOD for a branch with specific years (e.g. Year 1 only, or Years 2,3,4)
 * Body: { branchId, userId, years: [1] | [2,3,4] | [1,2,3,4] }
 */
exports.assignHod = async (req, res) => {
  try {
    const { branchId, userId, years } = req.body;
    const bid = parseInt(branchId, 10);
    const uid = parseInt(userId, 10);
    if (!bid || Number.isNaN(bid) || !uid || Number.isNaN(uid)) {
      return res.status(400).json({ success: false, message: 'branchId and userId required' });
    }
    let yearsArr = Array.isArray(years) ? years : (years ? [years] : [1, 2, 3, 4, 5, 6]);
    yearsArr = yearsArr.map((y) => parseInt(y, 10)).filter((y) => !Number.isNaN(y) && y >= 1 && y <= 6);
    if (yearsArr.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one year (1-6) required' });
    }
    yearsArr = [...new Set(yearsArr)].sort((a, b) => a - b);

    // Removed ensureBranchHodYearAssignmentsTable call


    const [branchRows] = await masterPool.query(
      'SELECT id, course_id FROM course_branches WHERE id = ? AND is_active = 1',
      [bid]
    );
    if (!branchRows || branchRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    const branch = branchRows[0];
    const [courseRows] = await masterPool.query(
      'SELECT college_id FROM courses WHERE id = ?',
      [branch.course_id]
    );
    const collegeId = courseRows && courseRows[0] ? courseRows[0].college_id : null;

    const [userRows] = await masterPool.query(
      'SELECT id, role, college_id, course_id, branch_id, branch_ids FROM rbac_users WHERE id = ?',
      [uid]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userRows[0];
    let branchIds = parseScopeData(user.branch_ids);
    if (user.branch_id && !branchIds.includes(user.branch_id)) branchIds.push(user.branch_id);
    if (!branchIds.includes(bid)) branchIds.push(bid);
    branchIds = [...new Set(branchIds)];

    await masterPool.query(
      `INSERT INTO branch_hod_year_assignments (branch_id, rbac_user_id, years)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE years = VALUES(years)`,
      [bid, uid, JSON.stringify(yearsArr)]
    );

    await masterPool.query(
      `UPDATE rbac_users SET
         role = ?,
         college_id = ?,
         course_id = ?,
         branch_id = ?,
         branch_ids = CAST(? AS JSON)
       WHERE id = ?`,
      ['branch_hod', collegeId || user.college_id, branch.course_id, branchIds[0], JSON.stringify(branchIds), uid]
    );

    res.json({ success: true, message: 'HOD assigned', data: { userId: uid, branchId: bid, years: yearsArr } });
  } catch (error) {
    console.error('assignHod error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign HOD' });
  }
};

/**
 * DELETE /api/faculty/unassign-hod
 * Remove HOD assignment for a branch. Body: { branchId, userId }
 */
exports.unassignHod = async (req, res) => {
  try {
    const { branchId, userId } = req.body;
    const bid = parseInt(branchId, 10);
    const uid = parseInt(userId, 10);
    if (!bid || Number.isNaN(bid) || !uid || Number.isNaN(uid)) {
      return res.status(400).json({ success: false, message: 'branchId and userId required' });
    }
    // Removed ensureBranchHodYearAssignmentsTable call

    await masterPool.query(
      'DELETE FROM branch_hod_year_assignments WHERE branch_id = ? AND rbac_user_id = ?',
      [bid, uid]
    );
    const [userRows] = await masterPool.query(
      'SELECT id, branch_id, branch_ids FROM rbac_users WHERE id = ?',
      [uid]
    );
    if (userRows && userRows.length > 0) {
      const [remaining] = await masterPool.query(
        'SELECT DISTINCT branch_id FROM branch_hod_year_assignments WHERE rbac_user_id = ?',
        [uid]
      );
      const remainingIds = (remaining || []).map((r) => r.branch_id);
      const branchIdsJson = remainingIds.length > 0 ? JSON.stringify(remainingIds) : '[]';
      const newBranchId = remainingIds[0] || null;
      await masterPool.query(
        'UPDATE rbac_users SET branch_id = ?, branch_ids = CAST(? AS JSON) WHERE id = ?',
        [newBranchId, branchIdsJson, uid]
      );
      if (remainingIds.length === 0) {
        await masterPool.query(
          "UPDATE rbac_users SET role = 'faculty' WHERE id = ? AND LOWER(TRIM(COALESCE(role, ''))) = 'branch_hod'",
          [uid]
        );
      }
    }
    res.json({ success: true, message: 'HOD unassigned', data: { userId: uid, branchId: bid } });
  } catch (error) {
    console.error('unassignHod error:', error);
    res.status(500).json({ success: false, message: 'Failed to unassign HOD' });
  }
};

// Removed ensureSubjectsTable, ensureFacultySubjectsTable, ensureBranchHodYearAssignmentsTable, ensureBranchSemesterSubjectsTable functions


/**
 * Build year/sem list from hierarchy config, or fallback to current regular students.
 * (User requested hierarchy-based loading)
 */
async function getYearSemListFromRegularStudents(branchId) {
  const [branchRows] = await masterPool.query(
    `SELECT cb.id, cb.name AS branch_name, cb.total_years AS branch_years, cb.semesters_per_year AS branch_sems, cb.year_semester_config AS branch_ys_config,
            c.name AS course_name, c.college_id, c.total_years AS course_years, c.semesters_per_year AS course_sems, c.year_semester_config AS course_ys_config
     FROM course_branches cb
     JOIN courses c ON c.id = cb.course_id
     WHERE cb.id = ? AND cb.is_active = 1`,
    [branchId]
  );
  if (!branchRows || branchRows.length === 0) return [];
  const branch = branchRows[0];

  // 1. Try to use hierarchy config
  const totalYears = branch.branch_years || branch.course_years;
  const semsPerYear = branch.branch_sems || branch.course_sems || 2;
  const ysConfig = branch.branch_ys_config || branch.course_ys_config;

  if (totalYears && totalYears > 0) {
    const list = [];
    let configArr = [];
    if (ysConfig) {
      try { configArr = (typeof ysConfig === 'string') ? JSON.parse(ysConfig) : ysConfig; } catch (_) { }
    }

    let aggregateSem = 1;
    for (let y = 1; y <= totalYears; y++) {
      let semestersThisYear = semsPerYear;
      if (Array.isArray(configArr)) {
        const yearCfg = configArr.find(c => c.year === y || c.year_number === y);
        if (yearCfg && (yearCfg.semesters || yearCfg.semester_count)) {
          semestersThisYear = yearCfg.semesters || yearCfg.semester_count;
        }
      }

      for (let s = 1; s <= semestersThisYear; s++) {
        list.push({
          year: y,
          semester: s,
          label: `Year ${y} Sem ${s} (S${aggregateSem})`
        });
        aggregateSem++;
      }
    }
    return list;
  }

  // 2. Fallback to current students
  const courseName = branch.course_name;
  const branchName = branch.branch_name;
  let studentWhere = "student_status = 'Regular' AND course = ? AND branch = ?";
  const params = [courseName, branchName];
  try {
    const [cols] = await masterPool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME IN ('college', 'college_id')"
    );
    const hasCollege = cols.some(c => c.COLUMN_NAME === 'college');
    const hasCollegeId = cols.some(c => c.COLUMN_NAME === 'college_id');
    if (hasCollegeId && branch.college_id) {
      studentWhere += ' AND college_id = ?';
      params.push(branch.college_id);
    } else if (hasCollege) {
      const [cn] = await masterPool.query('SELECT name FROM colleges WHERE id = ?', [branch.college_id]);
      if (cn && cn[0]) {
        studentWhere += ' AND college = ?';
        params.push(cn[0].name);
      }
    }
  } catch (_) { }
  const [rows] = await masterPool.query(
    `SELECT DISTINCT current_year AS year, current_semester AS semester
     FROM students
     WHERE ${studentWhere} AND current_year IS NOT NULL AND current_year <> 0 AND current_semester IS NOT NULL AND current_semester <> 0
     ORDER BY current_year ASC, current_semester ASC`,
    params
  );
  return (rows || []).map(r => ({
    year: r.year,
    semester: r.semester,
    label: `Year ${r.year} Sem ${r.semester}`
  }));
}

/**
 * GET /api/faculty/program-subjects
 * Get subjects by program (course) and year - all branches in that program with their year/sem subjects
 * Query: collegeId, courseId, year (year optional - when omitted, returns yearsAvailable only)
 */
exports.getProgramYearSubjects = async (req, res) => {
  try {
    const collegeId = parseInt(req.query.collegeId, 10);
    const courseId = parseInt(req.query.courseId, 10);
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    if (!collegeId || Number.isNaN(collegeId) || !courseId || Number.isNaN(courseId)) {
      return res.status(400).json({ success: false, message: 'collegeId and courseId required' });
    }
    const [branchRows] = await masterPool.query(
      `SELECT cb.id, cb.name, cb.course_id, c.name AS course_name
       FROM course_branches cb
       JOIN courses c ON c.id = cb.course_id
       WHERE c.college_id = ? AND cb.course_id = ? AND cb.is_active = 1
       ORDER BY cb.name`,
      [collegeId, courseId]
    );
    if (!branchRows || branchRows.length === 0) {
      return res.json({ success: true, data: { branches: [], yearsAvailable: [1, 2, 3, 4, 5, 6] } });
    }
    let yearsAvailable = [];
    const branchesData = [];
    for (const br of branchRows) {
      const yearSemList = await getYearSemListFromRegularStudents(br.id);
      const ys = yearSemList || [];
      yearsAvailable = [...new Set([...yearsAvailable, ...ys.map((x) => x.year).filter(Boolean)])];
      const yearFiltered = year ? ys.filter((x) => x.year === year) : [];
      let assignments = [];
      if (year) {
        try {
          const [rows] = await masterPool.query(
            `SELECT bss.year_of_study AS year, bss.semester_number AS semester, bss.subject_id,
                    s.name AS subject_name, s.code AS subject_code, s.subject_type, s.units, s.experiments_count, s.credits
             FROM branch_semester_subjects bss
             JOIN subjects s ON s.id = bss.subject_id
             WHERE bss.branch_id = ? AND bss.year_of_study = ?
             ORDER BY bss.semester_number`,
            [br.id, year]
          );
          assignments = rows || [];
        } catch (_) { }
      }
      const subjectIds = assignments.map((a) => a.subject_id);
      let facultyBySubject = {};
      if (subjectIds.length > 0) {
        try {
          const [facRows] = await masterPool.query(
            `SELECT fs.subject_id, fs.rbac_user_id, u.name, u.email
             FROM faculty_subjects fs
             JOIN rbac_users u ON u.id = fs.rbac_user_id
             WHERE fs.subject_id IN (?) AND u.is_active = 1`,
            [subjectIds]
          );
          for (const row of facRows || []) {
            if (!facultyBySubject[row.subject_id]) facultyBySubject[row.subject_id] = [];
            facultyBySubject[row.subject_id].push({ id: row.rbac_user_id, name: row.name, email: row.email || '' });
          }
        } catch (_) { }
      }
      const assignmentsByKey = {};
      assignments.forEach((a) => {
        const relSem = resolveRelativeSemester(a.semester, a.year);
        const key = `${a.year}-${relSem}`;
        if (!assignmentsByKey[key]) assignmentsByKey[key] = [];
        assignmentsByKey[key].push({
          subjectId: a.subject_id,
          subjectName: a.subject_name,
          subjectCode: a.subject_code,
          subjectType: a.subject_type,
          units: a.units,
          experimentsCount: a.experiments_count,
          credits: a.credits,
          faculty: facultyBySubject[a.subject_id] || []
        });
      });
      branchesData.push({
        id: br.id,
        name: br.name,
        course_name: br.course_name,
        yearSemList: yearFiltered,
        assignmentsByKey
      });
    }
    yearsAvailable = [...new Set(yearsAvailable)].sort((a, b) => a - b);
    if (yearsAvailable.length === 0) yearsAvailable = [1, 2, 3, 4, 5, 6];
    res.json({ success: true, data: { branches: branchesData, yearsAvailable } });
  } catch (error) {
    console.error('getProgramYearSubjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch program subjects' });
  }
};

/**
 * GET /api/faculty/branches/:branchId/available-years
 * Get distinct years from students currently in this branch (for HOD year assignment dropdown)
 */
exports.getBranchAvailableYears = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ success: false, message: 'Invalid branch ID' });
    }
    const yearSemList = await getYearSemListFromRegularStudents(branchId);
    const years = [...new Set((yearSemList || []).map((ys) => ys.year).filter((y) => y != null))].sort((a, b) => a - b);
    res.json({ success: true, data: years.length > 0 ? years : [1, 2, 3, 4, 5, 6] });
  } catch (error) {
    console.error('getBranchAvailableYears error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available years' });
  }
};

/**
 * GET /api/faculty/branches/:branchId/year-sem-subjects
 * Get year/sem list and subject assignments for a branch (for HOD to assign subjects per sem)
 */
exports.getBranchYearSemSubjects = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ success: false, message: 'Invalid branch ID' });
    }
    const [branchRows] = await masterPool.query(
      `SELECT cb.id, cb.name, cb.course_id, c.college_id
       FROM course_branches cb
       JOIN courses c ON c.id = cb.course_id
       WHERE cb.id = ? AND cb.is_active = 1`,
      [branchId]
    );
    if (!branchRows || branchRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    const branch = branchRows[0];
    const yearSemList = await getYearSemListFromRegularStudents(branchId);
    let assignments = [];
    try {
      const [rows] = await masterPool.query(
        `SELECT bss.year_of_study AS year, bss.semester_number AS semester, bss.subject_id,
                s.name AS subject_name, s.code AS subject_code, s.subject_type, s.units, s.experiments_count, s.credits
         FROM branch_semester_subjects bss
         JOIN subjects s ON s.id = bss.subject_id
         WHERE bss.branch_id = ?
         ORDER BY bss.year_of_study, bss.semester_number`,
        [branchId]
      );
      assignments = rows || [];
    } catch (tableErr) {
      console.error('getBranchYearSemSubjects assignments error:', tableErr);
      assignments = [];
    }
    let subjectsRows = [];
    try {
      const [rows] = await masterPool.query(
        `SELECT id, name, code FROM subjects WHERE (branch_id = ? OR branch_id IS NULL) AND course_id = ? AND is_active = 1 ORDER BY name`,
        [branchId, branch.course_id]
      );
      subjectsRows = rows || [];
    } catch (tableErr) {
      console.error('getBranchYearSemSubjects subjects error:', tableErr);
      subjectsRows = [];
    }
    const subjectIds = [...new Set(assignments.map((a) => a.subject_id))];
    let facultyBySubject = {};
    if (subjectIds.length > 0) {
      try {
        const [facRows] = await masterPool.query(
          `SELECT fs.subject_id, fs.rbac_user_id, u.name, u.email
           FROM faculty_subjects fs
           JOIN rbac_users u ON u.id = fs.rbac_user_id
           WHERE fs.subject_id IN (?) AND u.is_active = 1`,
          [subjectIds]
        );
        for (const row of facRows || []) {
          if (!facultyBySubject[row.subject_id]) facultyBySubject[row.subject_id] = [];
          facultyBySubject[row.subject_id].push({ id: row.rbac_user_id, name: row.name, email: row.email || '' });
        }
      } catch (_) { }
    }
    const assignmentsByKey = {};
    assignments.forEach((a) => {
      const relSem = resolveRelativeSemester(a.semester, a.year);
      const key = `${a.year}-${relSem}`;
      if (!assignmentsByKey[key]) assignmentsByKey[key] = [];
      assignmentsByKey[key].push({
        subjectId: a.subject_id,
        subjectName: a.subject_name,
        subjectCode: a.subject_code,
        subjectType: a.subject_type,
        units: a.units,
        experimentsCount: a.experiments_count,
        credits: a.credits,
        faculty: facultyBySubject[a.subject_id] || []
      });
    });
    res.json({
      success: true,
      data: {
        branch: { id: branch.id, name: branch.name, courseId: branch.course_id, collegeId: branch.college_id },
        yearSemList,
        assignmentsByKey: assignmentsByKey,
        subjects: (subjectsRows || []).map((s) => ({ id: s.id, name: s.name, code: s.code || '' }))
      }
    });
  } catch (error) {
    console.error('getBranchYearSemSubjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch year/sem subjects' });
  }
};

/**
 * POST /api/faculty/branches/:branchId/year-sem-subjects
 * Add a subject to a year/sem for the branch
 */
exports.addBranchSemesterSubject = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    const { year, semester, subjectId } = req.body;
    const y = parseInt(year, 10);
    const s = parseInt(semester, 10);
    const sid = parseInt(subjectId, 10);
    if (!branchId || Number.isNaN(branchId) || !y || !s || !sid) {
      return res.status(400).json({ success: false, message: 'branchId, year, semester, subjectId required' });
    }
    const [branchRows] = await masterPool.query(
      'SELECT id FROM course_branches WHERE id = ? AND is_active = 1',
      [branchId]
    );
    if (!branchRows || branchRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    await masterPool.query(
      `INSERT IGNORE INTO branch_semester_subjects (branch_id, year_of_study, semester_number, subject_id)
         VALUES (?, ?, ?, ?)`,
      [branchId, y, s, sid]
    );
    res.json({ success: true, message: 'Subject added to semester' });
  } catch (error) {
    console.error('addBranchSemesterSubject error:', error);
    res.status(500).json({ success: false, message: 'Failed to add subject' });
  }
};

/**
 * POST /api/faculty/assign-staff-to-subject
 * Assign a staff (faculty) to a subject. Body: { subjectId, rbacUserId }
 */
exports.assignStaffToSubject = async (req, res) => {
  try {
    const { subjectId, rbacUserId } = req.body;
    const sid = parseInt(subjectId, 10);
    const uid = parseInt(rbacUserId, 10);
    if (!sid || Number.isNaN(sid) || !uid || Number.isNaN(uid)) {
      return res.status(400).json({ success: false, message: 'subjectId and rbacUserId required' });
    }
    const [subjRows] = await masterPool.query('SELECT id FROM subjects WHERE id = ? AND is_active = 1', [sid]);
    if (!subjRows || subjRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    const [userRows] = await masterPool.query(
      'SELECT id FROM rbac_users WHERE id = ? AND is_active = 1',
      [uid]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    try {
      await ensureFacultySubjectsTable();
    } catch (_) { }
    await masterPool.query(
      'INSERT IGNORE INTO faculty_subjects (rbac_user_id, subject_id) VALUES (?, ?)',
      [uid, sid]
    );
    res.json({ success: true, message: 'Staff assigned to subject' });
  } catch (error) {
    console.error('assignStaffToSubject error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign staff' });
  }
};

/**
 * DELETE /api/faculty/unassign-staff-from-subject
 * Remove staff from a subject. Body: { subjectId, rbacUserId }
 */
exports.unassignStaffFromSubject = async (req, res) => {
  try {
    const { subjectId, rbacUserId } = req.body;
    const sid = parseInt(subjectId, 10);
    const uid = parseInt(rbacUserId, 10);
    if (!sid || Number.isNaN(sid) || !uid || Number.isNaN(uid)) {
      return res.status(400).json({ success: false, message: 'subjectId and rbacUserId required' });
    }
    await masterPool.query(
      'DELETE FROM faculty_subjects WHERE subject_id = ? AND rbac_user_id = ?',
      [sid, uid]
    );
    res.json({ success: true, message: 'Staff unassigned from subject' });
  } catch (error) {
    console.error('unassignStaffFromSubject error:', error);
    res.status(500).json({ success: false, message: 'Failed to unassign staff' });
  }
};

/**
 * DELETE /api/faculty/branches/:branchId/year-sem-subjects
 * Remove a subject from a year/sem (query: year, semester, subjectId)
 */
exports.removeBranchSemesterSubject = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    const { year, semester, subjectId } = req.query;
    const y = parseInt(year, 10);
    const s = parseInt(semester, 10);
    const sid = parseInt(subjectId, 10);
    if (!branchId || Number.isNaN(branchId) || !y || !s || !sid) {
      return res.status(400).json({ success: false, message: 'year, semester, subjectId query params required' });
    }
    try {
      const [r] = await masterPool.query(
        `DELETE FROM branch_semester_subjects
         WHERE branch_id = ? AND year_of_study = ? AND semester_number = ? AND subject_id = ?`,
        [branchId, y, s, sid]
      );
      res.json({ success: true, message: 'Subject removed', removed: r.affectedRows > 0 });
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        await ensureBranchSemesterSubjectsTable();
        res.json({ success: true, message: 'Subject removed', removed: false });
      } else throw tableErr;
    }
  } catch (error) {
    console.error('removeBranchSemesterSubject error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove subject' });
  }
};
