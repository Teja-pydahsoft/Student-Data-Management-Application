const { masterPool } = require('../config/database');

const DEFAULT_SEMESTERS_PER_YEAR = 2;
const MAX_YEARS = 10;
const MAX_SEMESTERS_PER_YEAR = 4;

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
  }
  return fallback;
};

const toInt = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const sanitizeStageConfig = ({ totalYears, semestersPerYear }) => {
  const years = Math.min(Math.max(toInt(totalYears, 0), 0), MAX_YEARS);
  const sems = Math.min(
    Math.max(toInt(semestersPerYear, DEFAULT_SEMESTERS_PER_YEAR), 1),
    MAX_SEMESTERS_PER_YEAR
  );
  return {
    totalYears: years,
    semestersPerYear: sems
  };
};

const buildStructure = (courseConfig, branchConfig) => {
  const yearsConfig = sanitizeStageConfig({
    totalYears: branchConfig?.total_years ?? courseConfig.total_years,
    semestersPerYear:
      branchConfig?.semesters_per_year ?? courseConfig.semesters_per_year
  });

  const years = Array.from({ length: yearsConfig.totalYears }, (_, index) => {
    const yearNumber = index + 1;
    const semesters = Array.from(
      { length: yearsConfig.semestersPerYear },
      (__unused, semIndex) => {
        const semesterNumber = semIndex + 1;
        return {
          semesterNumber,
          label: `Semester ${semesterNumber}`
        };
      }
    );
    return {
      yearNumber,
      label: `Year ${yearNumber}`,
      semesters
    };
  });

  return {
    totalYears: yearsConfig.totalYears,
    semestersPerYear: yearsConfig.semestersPerYear,
    years
  };
};

const formatCourse = (courseRow, branchRows = []) => {
  const branches = branchRows.map((branch) => ({
    id: branch.id,
    courseId: branch.course_id,
    name: branch.name,
    code: branch.code,
    isActive: branch.is_active === 1 || branch.is_active === true,
    totalYears: branch.total_years ?? null,
    semestersPerYear: branch.semesters_per_year ?? null,
    metadata: branch.metadata ? JSON.parse(branch.metadata) : null,
    structure: buildStructure(courseRow, branch)
  }));

  return {
    id: courseRow.id,
    name: courseRow.name,
    code: courseRow.code,
    isActive: courseRow.is_active === 1 || courseRow.is_active === true,
    totalYears: courseRow.total_years,
    semestersPerYear: courseRow.semesters_per_year,
    metadata: courseRow.metadata ? JSON.parse(courseRow.metadata) : null,
    structure: buildStructure(courseRow),
    branches
  };
};

const fetchCoursesWithBranches = async ({ includeInactive = false } = {}) => {
  const courseWhereClause = includeInactive ? '' : 'WHERE is_active = 1';
  const branchQuery = includeInactive
    ? 'SELECT * FROM course_branches WHERE course_id IN (?) ORDER BY name ASC'
    : 'SELECT * FROM course_branches WHERE is_active = 1 AND course_id IN (?) ORDER BY name ASC';

  const [courses] = await masterPool.query(
    `SELECT * FROM courses ${courseWhereClause} ORDER BY name ASC`
  );

  if (!courses || courses.length === 0) {
    return [];
  }

  const courseIds = courses.map((course) => course.id);
  const [branches] = await masterPool.query(branchQuery, [courseIds]);

  return courses.map((course) =>
    formatCourse(
      course,
      branches
        ? branches.filter((branch) => branch.course_id === course.id)
        : []
    )
  );
};

const validateCoursePayload = (payload, { isUpdate = false } = {}) => {
  const errors = [];

  const name = payload.name?.trim();
  const code = payload.code?.trim() || null;

  if (!isUpdate || name !== undefined) {
    if (!name) {
      errors.push('Course name is required');
    } else if (name.length > 255) {
      errors.push('Course name must be less than 255 characters');
    }
  }

  if (code && code.length > 50) {
    errors.push('Course code must be less than 50 characters');
  }

  const totalYears = toInt(payload.totalYears ?? payload.total_years, 0);
  const semestersPerYear = toInt(
    payload.semestersPerYear ?? payload.semesters_per_year,
    DEFAULT_SEMESTERS_PER_YEAR
  );

  if (!isUpdate || payload.totalYears !== undefined || payload.total_years !== undefined) {
    if (totalYears <= 0 || totalYears > MAX_YEARS) {
      errors.push(
        `totalYears must be between 1 and ${MAX_YEARS}`
      );
    }
  }

  if (
    !isUpdate ||
    payload.semestersPerYear !== undefined ||
    payload.semesters_per_year !== undefined
  ) {
    if (
      semestersPerYear <= 0 ||
      semestersPerYear > MAX_SEMESTERS_PER_YEAR
    ) {
      errors.push(
        `semestersPerYear must be between 1 and ${MAX_SEMESTERS_PER_YEAR}`
      );
    }
  }

  const branches = Array.isArray(payload.branches)
    ? payload.branches
    : [];

  return {
    errors,
    sanitized: {
      name,
      code,
      totalYears,
      semestersPerYear,
      isActive: parseBoolean(payload.isActive ?? payload.is_active, true),
      metadata: payload.metadata ?? null,
      branches
    }
  };
};

const validateBranchPayload = (
  branchPayload = {},
  {
    defaultYears = 0,
    defaultSemesters = DEFAULT_SEMESTERS_PER_YEAR,
    isUpdate = false
  } = {}
) => {
  const errors = [];

  const name =
    branchPayload.name !== undefined
      ? branchPayload.name?.trim()
      : undefined;
  const code =
    branchPayload.code !== undefined
      ? branchPayload.code?.trim() || null
      : undefined;

  if (!isUpdate || name !== undefined) {
    if (!name) {
      errors.push('Branch name is required');
    } else if (name.length > 255) {
      errors.push('Branch name must be less than 255 characters');
    }
  }

  if (code && code.length > 50) {
    errors.push('Branch code must be less than 50 characters');
  }

  const totalYears = toInt(
    branchPayload.totalYears ?? branchPayload.total_years,
    defaultYears
  );
  const semestersPerYear = toInt(
    branchPayload.semestersPerYear ?? branchPayload.semesters_per_year,
    defaultSemesters
  );

  if (!isUpdate || branchPayload.totalYears !== undefined || branchPayload.total_years !== undefined) {
    if (totalYears <= 0 || totalYears > MAX_YEARS) {
      errors.push(`Branch totalYears must be between 1 and ${MAX_YEARS}`);
    }
  }

  if (
    !isUpdate ||
    branchPayload.semestersPerYear !== undefined ||
    branchPayload.semesters_per_year !== undefined
  ) {
    if (
      semestersPerYear <= 0 ||
      semestersPerYear > MAX_SEMESTERS_PER_YEAR
    ) {
      errors.push(
        `Branch semestersPerYear must be between 1 and ${MAX_SEMESTERS_PER_YEAR}`
      );
    }
  }

  return {
    errors,
    sanitized: {
      name,
      code,
      totalYears,
      semestersPerYear,
      metadata: branchPayload.metadata ?? null,
      isActive: parseBoolean(
        branchPayload.isActive ?? branchPayload.is_active,
        true
      )
    }
  };
};

exports.getCourses = async (req, res) => {
  try {
    const includeInactive = parseBoolean(req.query.includeInactive, false);
    const courses = await fetchCoursesWithBranches({ includeInactive });

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('getCourses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses'
    });
  }
};

exports.getCourseOptions = async (_req, res) => {
  try {
    const courses = await fetchCoursesWithBranches({ includeInactive: false });

    const sanitized = courses.map((course) => ({
      name: course.name,
      code: course.code,
      isActive: course.isActive,
      structure: course.structure,
      metadata: course.metadata || null,
      branches: (course.branches || []).map((branch) => ({
        name: branch.name,
        code: branch.code,
        isActive: branch.isActive,
        structure: branch.structure,
        metadata: branch.metadata || null
      }))
    }));

    res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    console.error('getCourseOptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course configuration'
    });
  }
};

exports.createCourse = async (req, res) => {
  const connection = await masterPool.getConnection();

  try {
    const { errors, sanitized } = validateCoursePayload(req.body || {});

    const branchValidationResults = (sanitized.branches || []).map((branch, index) => {
      const result = validateBranchPayload(branch, {
        defaultYears: sanitized.totalYears,
        defaultSemesters: sanitized.semestersPerYear,
        isUpdate: false
      });
      return { index, ...result };
    });

    branchValidationResults.forEach((result) => {
      result.errors.forEach((err) =>
        errors.push(`Branch ${result.index + 1}: ${err}`)
      );
    });

    if (errors.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: errors.join(', ')
      });
    }

    const metadataJson =
      sanitized.metadata && typeof sanitized.metadata === 'object'
        ? JSON.stringify(sanitized.metadata)
        : sanitized.metadata;

    await connection.beginTransaction();

    const [courseResult] = await connection.query(
      `INSERT INTO courses (name, code, total_years, semesters_per_year, metadata, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sanitized.name,
        sanitized.code,
        sanitized.totalYears,
        sanitized.semestersPerYear,
        metadataJson || null,
        sanitized.isActive
      ]
    );

    const courseId = courseResult.insertId;

    if (branchValidationResults.length > 0) {
      const branchValues = branchValidationResults.map(({ sanitized: branch }) => {
        const branchMetadata =
          branch.metadata && typeof branch.metadata === 'object'
            ? JSON.stringify(branch.metadata)
            : branch.metadata;
        return [
          courseId,
          branch.name.trim(),
          branch.code?.trim() || null,
          branch.totalYears,
          branch.semestersPerYear,
          branchMetadata || null,
          branch.isActive
        ];
      });

      await connection.query(
        `INSERT INTO course_branches
          (course_id, name, code, total_years, semesters_per_year, metadata, is_active)
         VALUES ?`,
        [branchValues]
      );
    }

    await connection.commit();

    const [createdCourseRows] = await connection.query(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    const [branchRows] = await connection.query(
      'SELECT * FROM course_branches WHERE course_id = ? ORDER BY name ASC',
      [courseId]
    );

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: formatCourse(createdCourseRows[0], branchRows)
    });
  } catch (error) {
    await connection.rollback();
    console.error('createCourse error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Course with the same name or code already exists'
        : 'Failed to create course'
    });
  } finally {
    connection.release();
  }
};

exports.updateCourse = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);

  if (!courseId || Number.isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course ID'
    });
  }

  try {
    const { errors, sanitized } = validateCoursePayload(req.body || {}, {
      isUpdate: true
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', ')
      });
    }

    const fields = [];
    const values = [];

    if (sanitized.name !== undefined) {
      fields.push('name = ?');
      values.push(sanitized.name);
    }

    if (sanitized.code !== undefined) {
      fields.push('code = ?');
      values.push(sanitized.code);
    }

    if (
      req.body.totalYears !== undefined ||
      req.body.total_years !== undefined
    ) {
      fields.push('total_years = ?');
      values.push(sanitized.totalYears);
    }

    if (
      req.body.semestersPerYear !== undefined ||
      req.body.semesters_per_year !== undefined
    ) {
      fields.push('semesters_per_year = ?');
      values.push(sanitized.semestersPerYear);
    }

    if (req.body.metadata !== undefined) {
      fields.push('metadata = ?');
      const metadataJson =
        sanitized.metadata && typeof sanitized.metadata === 'object'
          ? JSON.stringify(sanitized.metadata)
          : sanitized.metadata;
      values.push(metadataJson || null);
    }

    if (
      req.body.isActive !== undefined ||
      req.body.is_active !== undefined
    ) {
      fields.push('is_active = ?');
      values.push(sanitized.isActive);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No course fields provided for update'
      });
    }

    values.push(courseId);

    const [result] = await masterPool.query(
      `UPDATE courses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const [courseRows] = await masterPool.query(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    const [branchRows] = await masterPool.query(
      'SELECT * FROM course_branches WHERE course_id = ? ORDER BY name ASC',
      [courseId]
    );

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: formatCourse(courseRows[0], branchRows)
    });
  } catch (error) {
    console.error('updateCourse error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Course with the same name or code already exists'
        : 'Failed to update course'
    });
  }
};

exports.deleteCourse = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);

  if (!courseId || Number.isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course ID'
    });
  }

  try {
    const [result] = await masterPool.query(
      'UPDATE courses SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [courseId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      message: 'Course deactivated successfully'
    });
  } catch (error) {
    console.error('deleteCourse error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course'
    });
  }
};

exports.createBranch = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);

  if (!courseId || Number.isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course ID'
    });
  }

  try {
    const [courseRows] = await masterPool.query(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    if (!courseRows || courseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const course = courseRows[0];

    const { errors, sanitized } = validateBranchPayload(req.body || {}, {
      defaultYears: course.total_years,
      defaultSemesters: course.semesters_per_year,
      isUpdate: false
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', ')
      });
    }

    const branchMetadata =
      sanitized.metadata && typeof sanitized.metadata === 'object'
        ? JSON.stringify(sanitized.metadata)
        : sanitized.metadata;

    const [result] = await masterPool.query(
      `INSERT INTO course_branches
        (course_id, name, code, total_years, semesters_per_year, metadata, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        sanitized.name?.trim(),
        sanitized.code?.trim() || null,
        sanitized.totalYears,
        sanitized.semestersPerYear,
        branchMetadata || null,
        sanitized.isActive
      ]
    );

    const branchId = result.insertId;

    const [branchRows] = await masterPool.query(
      'SELECT * FROM course_branches WHERE id = ? LIMIT 1',
      [branchId]
    );

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: branchRows[0]
    });
  } catch (error) {
    console.error('createBranch error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Branch with the same name or code already exists for this course'
        : 'Failed to create branch'
    });
  }
};

exports.getBranches = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  if (!courseId || Number.isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course ID'
    });
  }

  try {
    const includeInactive = parseBoolean(req.query.includeInactive, true);
    const whereClause = includeInactive
      ? 'WHERE course_id = ?'
      : 'WHERE course_id = ? AND is_active = 1';

    const [rows] = await masterPool.query(
      `SELECT * FROM course_branches ${whereClause} ORDER BY name ASC`,
      [courseId]
    );

    res.json({
      success: true,
      data: rows.map((branch) => ({
        id: branch.id,
        courseId: branch.course_id,
        name: branch.name,
        code: branch.code,
        isActive: branch.is_active === 1 || branch.is_active === true,
        totalYears: branch.total_years ?? null,
        semestersPerYear: branch.semesters_per_year ?? null,
        metadata: branch.metadata ? JSON.parse(branch.metadata) : null
      }))
    });
  } catch (error) {
    console.error('getBranches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branches for course'
    });
  }
};

exports.updateBranch = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const branchId = parseInt(req.params.branchId, 10);

  if (!courseId || Number.isNaN(courseId) || !branchId || Number.isNaN(branchId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course or branch ID'
    });
  }

  try {
    const [courseRows] = await masterPool.query(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    if (!courseRows || courseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const [existingBranchRows] = await masterPool.query(
      'SELECT * FROM course_branches WHERE course_id = ? AND id = ? LIMIT 1',
      [courseId, branchId]
    );

    if (!existingBranchRows || existingBranchRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found for this course'
      });
    }

    const course = courseRows[0];

    const { errors, sanitized } = validateBranchPayload(req.body || {}, {
      defaultYears: existingBranchRows[0].total_years ?? course.total_years,
      defaultSemesters:
        existingBranchRows[0].semesters_per_year ?? course.semesters_per_year,
      isUpdate: true
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', ')
      });
    }

    const fields = [];
    const values = [];

    if (sanitized.name !== undefined) {
      fields.push('name = ?');
      values.push(sanitized.name?.trim());
    }

    if (sanitized.code !== undefined) {
      fields.push('code = ?');
      values.push(sanitized.code?.trim() || null);
    }

    if (req.body.totalYears !== undefined || req.body.total_years !== undefined) {
      fields.push('total_years = ?');
      values.push(sanitized.totalYears);
    }

    if (
      req.body.semestersPerYear !== undefined ||
      req.body.semesters_per_year !== undefined
    ) {
      fields.push('semesters_per_year = ?');
      values.push(sanitized.semestersPerYear);
    }

    if (req.body.metadata !== undefined) {
      const metadataJson =
        sanitized.metadata && typeof sanitized.metadata === 'object'
          ? JSON.stringify(sanitized.metadata)
          : sanitized.metadata;
      fields.push('metadata = ?');
      values.push(metadataJson || null);
    }

    if (req.body.isActive !== undefined || req.body.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(sanitized.isActive);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No branch fields provided for update'
      });
    }

    values.push(courseId, branchId);

    const [result] = await masterPool.query(
      `UPDATE course_branches
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE course_id = ? AND id = ?`,
      values
    );

    const [branchRows] = await masterPool.query(
      'SELECT * FROM course_branches WHERE course_id = ? AND id = ? LIMIT 1',
      [courseId, branchId]
    );

    res.json({
      success: true,
      message: 'Branch updated successfully',
      data: branchRows[0]
    });
  } catch (error) {
    console.error('updateBranch error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Branch with the same name or code already exists for this course'
        : 'Failed to update branch'
    });
  }
};

exports.deleteBranch = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const branchId = parseInt(req.params.branchId, 10);

  if (!courseId || Number.isNaN(courseId) || !branchId || Number.isNaN(branchId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course or branch ID'
    });
  }

  try {
    const hardDelete = parseBoolean(req.query.hard, false);

    if (hardDelete) {
      const [result] = await masterPool.query(
        'DELETE FROM course_branches WHERE course_id = ? AND id = ?',
        [courseId, branchId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found for this course'
        });
      }

      return res.json({
        success: true,
        message: 'Branch deleted successfully'
      });
    }

    const [result] = await masterPool.query(
      `UPDATE course_branches
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE course_id = ? AND id = ?`,
      [courseId, branchId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found for this course'
      });
    }

    res.json({
      success: true,
      message: 'Branch deactivated successfully'
    });
  } catch (error) {
    console.error('deleteBranch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete branch'
    });
  }
};

