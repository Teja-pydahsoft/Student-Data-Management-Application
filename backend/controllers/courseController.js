const { masterPool } = require('../config/database');
const { filterCoursesByScope, filterBranchesByScope } = require('../utils/scoping');

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

  // Check for per-year semester configuration
  const yearSemesterConfig = branchConfig?.year_semester_config 
    ? (typeof branchConfig.year_semester_config === 'string' 
        ? JSON.parse(branchConfig.year_semester_config) 
        : branchConfig.year_semester_config)
    : courseConfig?.year_semester_config
      ? (typeof courseConfig.year_semester_config === 'string'
          ? JSON.parse(courseConfig.year_semester_config)
          : courseConfig.year_semester_config)
      : null;

  const years = Array.from({ length: yearsConfig.totalYears }, (_, index) => {
    const yearNumber = index + 1;
    
    // Get semester count for this year
    let semesterCount = yearsConfig.semestersPerYear; // Default fallback
    
    if (Array.isArray(yearSemesterConfig)) {
      const yearConfig = yearSemesterConfig.find(y => y.year === yearNumber);
      if (yearConfig && yearConfig.semesters) {
        semesterCount = yearConfig.semesters;
      }
    }
    
    const semesters = Array.from(
      { length: semesterCount },
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

const serializeBranchRow = (branchRow) => ({
  id: branchRow.id,
  courseId: branchRow.course_id,
  name: branchRow.name,
  isActive: branchRow.is_active === 1 || branchRow.is_active === true,
  totalYears: branchRow.total_years ?? null,
  semestersPerYear: branchRow.semesters_per_year ?? null,
  yearSemesterConfig: branchRow.year_semester_config 
    ? (typeof branchRow.year_semester_config === 'string' 
        ? JSON.parse(branchRow.year_semester_config) 
        : branchRow.year_semester_config)
    : null,
  academicYearId: branchRow.academic_year_id ?? null,
  academicYearLabel: branchRow.academic_year_label ?? null,
  metadata: branchRow.metadata ? JSON.parse(branchRow.metadata) : null
});

const formatCourse = (courseRow, branchRows = []) => {
  const branches = branchRows.map((branch) => ({
    ...serializeBranchRow(branch),
    structure: buildStructure(courseRow, branch)
  }));

  return {
    id: courseRow.id,
    collegeId: courseRow.college_id || null,
    name: courseRow.name,
    isActive: courseRow.is_active === 1 || courseRow.is_active === true,
    totalYears: courseRow.total_years,
    semestersPerYear: courseRow.semesters_per_year,
    yearSemesterConfig: courseRow.year_semester_config 
      ? (typeof courseRow.year_semester_config === 'string' 
          ? JSON.parse(courseRow.year_semester_config) 
          : courseRow.year_semester_config)
      : null,
    metadata: courseRow.metadata ? JSON.parse(courseRow.metadata) : null,
    structure: buildStructure(courseRow),
    branches
  };
};

const fetchCoursesWithBranches = async ({ includeInactive = false, collegeId = null } = {}) => {
  const whereConditions = [];
  const queryParams = [];

  if (!includeInactive) {
    whereConditions.push('is_active = 1');
  }

  if (collegeId !== null && collegeId !== undefined) {
    const parsedCollegeId = parseInt(collegeId, 10);
    if (!Number.isNaN(parsedCollegeId)) {
      whereConditions.push('college_id = ?');
      queryParams.push(parsedCollegeId);
    }
  }

  const courseWhereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const branchQuery = includeInactive
    ? `SELECT cb.*, ay.year_label as academic_year_label 
       FROM course_branches cb 
       LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id 
       WHERE cb.course_id IN (?) ORDER BY cb.name ASC`
    : `SELECT cb.*, ay.year_label as academic_year_label 
       FROM course_branches cb 
       LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id 
       WHERE cb.is_active = 1 AND cb.course_id IN (?) ORDER BY cb.name ASC`;

  const [courses] = await masterPool.query(
    `SELECT * FROM courses ${courseWhereClause} ORDER BY name ASC`,
    queryParams
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
  const code = payload.code?.trim();

  if (!isUpdate || name !== undefined) {
    if (!name) {
      errors.push('Course name is required');
    } else if (name.length > 255) {
      errors.push('Course name must be less than 255 characters');
    }
  }

  if (!isUpdate || code !== undefined) {
    if (!code) {
      errors.push('Course code is required');
    } else if (code.length > 50) {
      errors.push('Course code must be less than 50 characters');
    }
  }

  const totalYears = toInt(payload.totalYears ?? payload.total_years, 0);
  const semestersPerYear = toInt(
    payload.semestersPerYear ?? payload.semesters_per_year,
    DEFAULT_SEMESTERS_PER_YEAR
  );

  // Validate yearSemesterConfig if provided
  let yearSemesterConfig = null;
  if (payload.yearSemesterConfig || payload.year_semester_config) {
    const config = payload.yearSemesterConfig || payload.year_semester_config;
    if (Array.isArray(config)) {
      // Validate each year config
      for (const yearConfig of config) {
        if (!yearConfig.year || !yearConfig.semesters) {
          errors.push('Each year in yearSemesterConfig must have year and semesters');
          break;
        }
        if (yearConfig.year < 1 || yearConfig.year > MAX_YEARS) {
          errors.push(`Year number must be between 1 and ${MAX_YEARS}`);
          break;
        }
        if (yearConfig.semesters < 1 || yearConfig.semesters > MAX_SEMESTERS_PER_YEAR) {
          errors.push(`Semesters per year must be between 1 and ${MAX_SEMESTERS_PER_YEAR}`);
          break;
        }
      }
      yearSemesterConfig = config;
    } else {
      errors.push('yearSemesterConfig must be an array');
    }
  }

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
      yearSemesterConfig,
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
      ? branchPayload.code?.trim()
      : undefined;

  if (!isUpdate || name !== undefined) {
    if (!name) {
      errors.push('Branch name is required');
    } else if (name.length > 255) {
      errors.push('Branch name must be less than 255 characters');
    }
  }

  if (!isUpdate || code !== undefined) {
    if (!code) {
      errors.push('Branch code is required');
    } else if (code.length > 50) {
      errors.push('Branch code must be less than 50 characters');
    }
  }

  const totalYears = toInt(
    branchPayload.totalYears ?? branchPayload.total_years,
    defaultYears
  );
  const semestersPerYear = toInt(
    branchPayload.semestersPerYear ?? branchPayload.semesters_per_year,
    defaultSemesters
  );

  // Parse academic year ID(s) - support both single and array
  const academicYearId = branchPayload.academicYearId ?? branchPayload.academic_year_id;
  const academicYearIds = branchPayload.academicYearIds ?? branchPayload.academic_year_ids;
  // If array is provided, use it; otherwise fall back to single ID
  const finalAcademicYearIds = academicYearIds 
    ? (Array.isArray(academicYearIds) ? academicYearIds : [academicYearIds])
    : (academicYearId ? [academicYearId] : []);

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
      academicYearId: academicYearId ? parseInt(academicYearId, 10) : null,
      academicYearIds: finalAcademicYearIds.map(id => parseInt(id, 10)).filter(id => !Number.isNaN(id)),
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
    const collegeId = req.query.collegeId ? parseInt(req.query.collegeId, 10) : null;
    
    let courses = await fetchCoursesWithBranches({ 
      includeInactive,
      collegeId: Number.isNaN(collegeId) ? null : collegeId
    });

    // Apply user scope filtering for courses
    if (req.userScope && !req.userScope.unrestricted && !req.userScope.allCourses) {
      courses = filterCoursesByScope(courses, req.userScope);
    }

    // Apply user scope filtering for branches within each course
    if (req.userScope && !req.userScope.unrestricted && !req.userScope.allBranches) {
      courses = courses.map(course => ({
        ...course,
        branches: filterBranchesByScope(course.branches || [], req.userScope)
      }));
    }

    // No caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

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
      isActive: course.isActive,
      structure: course.structure,
      metadata: course.metadata || null,
      branches: (course.branches || []).map((branch) => ({
        name: branch.name,
        isActive: branch.isActive,
        structure: branch.structure,
        metadata: branch.metadata || null
      }))
    }));

    // No caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
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
    // Validate collegeId
    const collegeId = req.body.collegeId ? parseInt(req.body.collegeId, 10) : null;
    if (!collegeId || Number.isNaN(collegeId)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'collegeId is required and must be a valid number'
      });
    }

    // Validate college exists
    const collegeService = require('../services/collegeService');
    const collegeExists = await collegeService.validateCollegeExists(collegeId);
    if (!collegeExists) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

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

    const yearSemesterConfigJson = sanitized.yearSemesterConfig 
      ? JSON.stringify(sanitized.yearSemesterConfig) 
      : null;

    const [courseResult] = await connection.query(
      `INSERT INTO courses (name, code, college_id, total_years, semesters_per_year, year_semester_config, metadata, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitized.name,
        sanitized.code,
        collegeId,
        sanitized.totalYears,
        sanitized.semestersPerYear,
        yearSemesterConfigJson,
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
          branch.code,
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
    let errorMessage = 'Failed to create course';
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('unique_course_name')) {
        errorMessage = 'Course with the same name already exists';
      } else if (error.message.includes('unique_course_code')) {
        errorMessage = 'Course with the same code already exists';
      } else {
        errorMessage = 'Course with the same name or code already exists';
      }
    }
    res.status(500).json({
      success: false,
      message: errorMessage
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
    // Fetch existing course to get old name for cascade update
    const [existingCourse] = await masterPool.query(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    if (!existingCourse || existingCourse.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const oldCourseName = existingCourse[0].name;

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
    let newCourseName = null;

    if (sanitized.name !== undefined) {
      fields.push('name = ?');
      newCourseName = sanitized.name;
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

    if (
      req.body.yearSemesterConfig !== undefined ||
      req.body.year_semester_config !== undefined
    ) {
      fields.push('year_semester_config = ?');
      values.push(sanitized.yearSemesterConfig ? JSON.stringify(sanitized.yearSemesterConfig) : null);
    }

    if (req.body.collegeId !== undefined) {
      const collegeId = parseInt(req.body.collegeId, 10);
      if (Number.isNaN(collegeId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid collegeId'
        });
      }
      // Validate college exists
      const collegeService = require('../services/collegeService');
      const collegeExists = await collegeService.validateCollegeExists(collegeId);
      if (!collegeExists) {
        return res.status(404).json({
          success: false,
          message: 'College not found'
        });
      }
      fields.push('college_id = ?');
      values.push(collegeId);
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

    // Update course in courses table
    await masterPool.query(
      `UPDATE courses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    // If course name was changed, cascade update to students table
    let studentsUpdated = 0;
    if (newCourseName && newCourseName !== oldCourseName) {
      const [updateResult] = await masterPool.query(
        `UPDATE students SET course = ?, updated_at = CURRENT_TIMESTAMP WHERE course = ?`,
        [newCourseName, oldCourseName]
      );
      studentsUpdated = updateResult.affectedRows || 0;
      console.log(`Course rename cascade: Updated ${studentsUpdated} students from "${oldCourseName}" to "${newCourseName}"`);
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
      message: studentsUpdated > 0
        ? `Course updated successfully. ${studentsUpdated} student record(s) updated.`
        : 'Course updated successfully',
      data: formatCourse(courseRows[0], branchRows),
      studentsUpdated
    });
  } catch (error) {
    console.error('updateCourse error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Course with the same name already exists'
        : 'Failed to update course'
    });
  }
};

exports.deleteCourse = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const hard = req.query.hard === 'true' || req.body.hard === true;
  const cascade = req.query.cascade === 'true' || req.body.cascade === true;

  if (!courseId || Number.isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course ID'
    });
  }

  const connection = await masterPool.getConnection();

  try {
    await connection.beginTransaction();

    // Get course name
    const [courseRow] = await connection.query(
      'SELECT name FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    if (courseRow.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const courseName = courseRow[0].name;
    let deletedStudents = 0;
    let deletedBranches = 0;

    if (cascade) {
      // Get all branches for this course
      const [branches] = await connection.query(
        'SELECT id, name FROM course_branches WHERE course_id = ?',
        [courseId]
      );

      deletedBranches = branches.length;

      // Delete students for each branch
      for (const branch of branches) {
        const [studentResult] = await connection.query(
          'DELETE FROM students WHERE course = ? AND branch = ?',
          [courseName, branch.name]
        );
        deletedStudents += studentResult.affectedRows;
      }

      // Delete all branches for this course
      await connection.query(
        'DELETE FROM course_branches WHERE course_id = ?',
        [courseId]
      );

      // Delete all students by course (in case branch matching didn't catch all)
      const [courseStudentResult] = await connection.query(
        'DELETE FROM students WHERE course = ?',
        [courseName]
      );
      deletedStudents += courseStudentResult.affectedRows;

      // Delete the course
      const [result] = await connection.query(
        'DELETE FROM courses WHERE id = ?',
        [courseId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      await connection.commit();

      res.json({
        success: true,
        deletedStudents,
        deletedBranches,
        message: 'Course and all related data deleted successfully.'
      });
    } else {
      // Non-cascade: Check if course has branches
      const [branchRows] = await connection.query(
        'SELECT COUNT(*) as count FROM course_branches WHERE course_id = ?',
        [courseId]
      );

      if (branchRows[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Cannot delete course: it still has branches assigned. Please delete branches first.'
        });
      }

      // Check if course has students
      const [studentRows] = await connection.query(
        'SELECT COUNT(*) as count FROM students WHERE course = ?',
        [courseName]
      );

      if (studentRows[0].count > 0 && !hard) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Cannot delete course: it has ${studentRows[0].count} student(s) assigned. Use hard delete to force deletion.`
        });
      }

      if (hard) {
        // Hard delete - actually remove from database
        const [result] = await connection.query(
          'DELETE FROM courses WHERE id = ?',
          [courseId]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: 'Course not found'
          });
        }

        await connection.commit();
        connection.release();

        res.json({
          success: true,
          message: 'Course deleted successfully'
        });
      } else {
        // Soft delete - deactivate
        const [result] = await connection.query(
          'UPDATE courses SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [courseId]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: 'Course not found'
          });
        }

        await connection.commit();
        connection.release();

        res.json({
          success: true,
          message: 'Course deactivated successfully'
        });
      }
    }
  } catch (error) {
    await connection.rollback();
    connection.release();
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

    // Validate that at least one academic year is provided
    if (!sanitized.academicYearIds || sanitized.academicYearIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one academic year (batch) must be selected'
      });
    }

    const branchMetadata =
      sanitized.metadata && typeof sanitized.metadata === 'object'
        ? JSON.stringify(sanitized.metadata)
        : sanitized.metadata;

    // Create branch for each selected academic year
    const createdBranches = [];
    const connection = await masterPool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const academicYearId of sanitized.academicYearIds) {
        // Check if branch with same code already exists for this course and academic year
        // Also check for branches with NULL academic_year_id that might conflict
        const [existing] = await connection.query(
          `SELECT id FROM course_branches 
           WHERE course_id = ? AND code = ? AND (academic_year_id = ? OR academic_year_id IS NULL)`,
          [courseId, sanitized.code, academicYearId]
        );

        if (existing.length > 0) {
          // If there's a branch with NULL academic_year_id, update it instead of creating new
          const [nullYearBranch] = await connection.query(
            `SELECT id FROM course_branches 
             WHERE course_id = ? AND code = ? AND academic_year_id IS NULL
             LIMIT 1`,
            [courseId, sanitized.code]
          );

          if (nullYearBranch.length > 0) {
            // Update the NULL branch to have the academic year
            await connection.query(
              `UPDATE course_branches 
               SET academic_year_id = ?, name = ?, total_years = ?, semesters_per_year = ?, is_active = ?
               WHERE id = ?`,
              [
                academicYearId,
                sanitized.name?.trim(),
                sanitized.totalYears,
                sanitized.semestersPerYear,
                sanitized.isActive,
                nullYearBranch[0].id
              ]
            );

            // Fetch the updated branch
            const [updatedBranchRows] = await connection.query(
              `SELECT cb.*, ay.year_label as academic_year_label 
               FROM course_branches cb 
               LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id 
               WHERE cb.id = ? LIMIT 1`,
              [nullYearBranch[0].id]
            );

            if (updatedBranchRows.length > 0) {
              createdBranches.push(serializeBranchRow(updatedBranchRows[0]));
            }
            continue; // Skip creating new branch, we updated the existing one
          }

          // Branch already exists for this specific academic year, skip
          continue;
        }

        const [result] = await connection.query(
          `INSERT INTO course_branches
            (course_id, name, code, total_years, semesters_per_year, academic_year_id, metadata, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            courseId,
            sanitized.name?.trim(),
            sanitized.code,
            sanitized.totalYears,
            sanitized.semestersPerYear,
            academicYearId,
            branchMetadata || null,
            sanitized.isActive
          ]
        );

        const branchId = result.insertId;

        const [branchRows] = await connection.query(
          `SELECT cb.*, ay.year_label as academic_year_label 
           FROM course_branches cb 
           LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id 
           WHERE cb.id = ? LIMIT 1`,
          [branchId]
        );

        if (branchRows.length > 0) {
          createdBranches.push(serializeBranchRow(branchRows[0]));
        }
      }

      await connection.commit();
      connection.release();

      if (createdBranches.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Branch with the same code already exists for all selected academic years'
        });
      }

      res.status(201).json({
        success: true,
        message: `Branch created successfully for ${createdBranches.length} batch(es)`,
        data: createdBranches.length === 1 ? createdBranches[0] : createdBranches,
        count: createdBranches.length
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('createBranch error:', error);
    let errorMessage = 'Failed to create branch';
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('unique_branch_per_course_year')) {
        errorMessage = 'Branch with the same name already exists for this course and academic year';
      } else if (error.message.includes('unique_branch_code_per_course_year')) {
        errorMessage = 'Branch with the same code already exists for this course and academic year';
      } else if (error.message.includes('unique_branch_per_course')) {
        errorMessage = 'Branch with the same name already exists for this course';
      } else if (error.message.includes('unique_branch_code_per_course')) {
        // This is the old constraint - suggest running migration
        errorMessage = 'Branch with the same code already exists. Please run the migration script to update the database constraint: node scripts/fix_branch_code_constraint.js';
      } else {
        errorMessage = 'Branch with the same name or code already exists for this course';
      }
    }
    res.status(500).json({
      success: false,
      message: errorMessage
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
      ? 'WHERE cb.course_id = ?'
      : 'WHERE cb.course_id = ? AND cb.is_active = 1';

    const [rows] = await masterPool.query(
      `SELECT cb.*, ay.year_label as academic_year_label 
       FROM course_branches cb 
       LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id 
       ${whereClause} ORDER BY cb.name ASC`,
      [courseId]
    );

    let branches = rows.map(serializeBranchRow);

    // Apply user scope filtering for branches
    if (req.userScope && !req.userScope.unrestricted && !req.userScope.allBranches) {
      branches = filterBranchesByScope(branches, req.userScope);
    }

    // No caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    res.json({
      success: true,
      data: branches
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
    const oldBranchName = existingBranchRows[0].name;

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
    let newBranchName = null;

    if (sanitized.name !== undefined) {
      fields.push('name = ?');
      newBranchName = sanitized.name?.trim();
      values.push(newBranchName);
    }

    if (sanitized.code !== undefined) {
      fields.push('code = ?');
      values.push(sanitized.code);
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

    if (req.body.academicYearId !== undefined || req.body.academic_year_id !== undefined) {
      fields.push('academic_year_id = ?');
      values.push(sanitized.academicYearId || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No branch fields provided for update'
      });
    }

    values.push(courseId, branchId);

    // Update branch in course_branches table
    await masterPool.query(
      `UPDATE course_branches
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE course_id = ? AND id = ?`,
      values
    );

    // If branch name was changed, cascade update to students table
    let studentsUpdated = 0;
    if (newBranchName && newBranchName !== oldBranchName) {
      const [updateResult] = await masterPool.query(
        `UPDATE students SET branch = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE branch = ? AND course = ?`,
        [newBranchName, oldBranchName, course.name]
      );
      studentsUpdated = updateResult.affectedRows || 0;
      console.log(`Branch rename cascade: Updated ${studentsUpdated} students from "${oldBranchName}" to "${newBranchName}"`);
    }

    const [branchRows] = await masterPool.query(
      `SELECT cb.*, ay.year_label as academic_year_label 
       FROM course_branches cb 
       LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id 
       WHERE cb.course_id = ? AND cb.id = ? LIMIT 1`,
      [courseId, branchId]
    );

    res.json({
      success: true,
      message: studentsUpdated > 0 
        ? `Branch updated successfully. ${studentsUpdated} student record(s) updated.`
        : 'Branch updated successfully',
      data: serializeBranchRow(branchRows[0]),
      studentsUpdated
    });
  } catch (error) {
    console.error('updateBranch error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? (error.message.includes('unique_branch_code_per_course')
            ? 'Branch with the same code already exists for this course'
            : 'Branch with the same name or code already exists for this course')
        : 'Failed to update branch'
    });
  }
};

// Export formatCourse for use in other modules
exports.formatCourse = formatCourse;

exports.deleteBranch = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const branchId = parseInt(req.params.branchId, 10);
  const cascade = req.query.cascade === 'true' || req.body.cascade === true;

  if (!courseId || Number.isNaN(courseId) || !branchId || Number.isNaN(branchId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course or branch ID'
    });
  }

  const connection = await masterPool.getConnection();

  try {
    await connection.beginTransaction();

    // Get branch and course names
    const [branchRow] = await connection.query(
      'SELECT name FROM course_branches WHERE course_id = ? AND id = ? LIMIT 1',
      [courseId, branchId]
    );

    if (branchRow.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Branch not found for this course'
      });
    }

    const branchName = branchRow[0].name;

    // Get course name
    const [courseRow] = await connection.query(
      'SELECT name FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    const courseName = courseRow.length > 0 ? courseRow[0].name : null;
    let deletedStudents = 0;

    if (cascade) {
      // Delete all students for this branch
      if (courseName) {
        const [studentResult] = await connection.query(
          'DELETE FROM students WHERE course = ? AND branch = ?',
          [courseName, branchName]
        );
        deletedStudents = studentResult.affectedRows;
      } else {
        // Fallback: delete by branch name only
        const [studentResult] = await connection.query(
          'DELETE FROM students WHERE branch = ?',
          [branchName]
        );
        deletedStudents = studentResult.affectedRows;
      }

      // Delete the branch
      const [result] = await connection.query(
        'DELETE FROM course_branches WHERE course_id = ? AND id = ?',
        [courseId, branchId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Branch not found for this course'
        });
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        deletedStudents,
        message: 'Branch and all related data deleted successfully.'
      });
    } else {
      // Non-cascade: Hard delete (existing behavior)
      const hardDelete = parseBoolean(req.query.hard, false);

      if (hardDelete) {
        const [result] = await connection.query(
          'DELETE FROM course_branches WHERE course_id = ? AND id = ?',
          [courseId, branchId]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: 'Branch not found for this course'
          });
        }

        await connection.commit();
        connection.release();

        return res.json({
          success: true,
          message: 'Branch deleted successfully'
        });
      }

      // Soft delete - deactivate
      const [result] = await connection.query(
        `UPDATE course_branches
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE course_id = ? AND id = ?`,
        [courseId, branchId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Branch not found for this course'
        });
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Branch deactivated successfully'
      });
    }
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('deleteBranch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete branch'
    });
  }
};

/**
 * GET /api/courses/:courseId/affected-students
 * Preview students that will be affected when deleting a course
 */
exports.getAffectedStudentsByCourse = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);

  if (!courseId || Number.isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course ID'
    });
  }

  try {
    // Get course name
    const [courseRow] = await masterPool.query(
      'SELECT name FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );

    if (courseRow.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const courseName = courseRow[0].name;

    // Get all students under this course (limit to 100 for preview)
    const [students] = await masterPool.query(
      `SELECT admission_number, student_name, branch, batch, current_year, current_semester 
       FROM students 
       WHERE course = ?
       ORDER BY student_name ASC
       LIMIT 100`,
      [courseName]
    );

    // Get total count
    const [countResult] = await masterPool.query(
      'SELECT COUNT(*) as total FROM students WHERE course = ?',
      [courseName]
    );

    res.json({
      success: true,
      data: {
        courseName,
        students,
        totalCount: countResult[0].total,
        hasMore: countResult[0].total > 100
      }
    });
  } catch (error) {
    console.error('getAffectedStudentsByCourse error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch affected students'
    });
  }
};

/**
 * GET /api/courses/:courseId/branches/:branchId/affected-students
 * Preview students that will be affected when deleting a branch
 */
exports.getAffectedStudentsByBranch = async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const branchId = parseInt(req.params.branchId, 10);

  if (!courseId || Number.isNaN(courseId) || !branchId || Number.isNaN(branchId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course or branch ID'
    });
  }

  try {
    // Get branch and course names
    const [branchRow] = await masterPool.query(
      `SELECT cb.name as branch_name, cb.academic_year_id, ay.year_label as academic_year, c.name as course_name
       FROM course_branches cb
       JOIN courses c ON cb.course_id = c.id
       LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id
       WHERE cb.course_id = ? AND cb.id = ?
       LIMIT 1`,
      [courseId, branchId]
    );

    if (branchRow.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found for this course'
      });
    }

    const { branch_name: branchName, course_name: courseName, academic_year: academicYear } = branchRow[0];

    // Get all students under this branch (limit to 100 for preview)
    // Filter by batch (academic year) if available
    let query = `SELECT admission_number, student_name, batch, current_year, current_semester 
                 FROM students 
                 WHERE course = ? AND branch = ?`;
    const params = [courseName, branchName];
    
    if (academicYear) {
      query += ' AND batch = ?';
      params.push(academicYear);
    }
    
    query += ' ORDER BY student_name ASC LIMIT 100';

    const [students] = await masterPool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM students WHERE course = ? AND branch = ?';
    const countParams = [courseName, branchName];
    
    if (academicYear) {
      countQuery += ' AND batch = ?';
      countParams.push(academicYear);
    }

    const [countResult] = await masterPool.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        branchName,
        courseName,
        academicYear,
        students,
        totalCount: countResult[0].total,
        hasMore: countResult[0].total > 100
      }
    });
  } catch (error) {
    console.error('getAffectedStudentsByBranch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch affected students'
    });
  }
};

