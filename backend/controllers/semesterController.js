const { masterPool } = require('../config/database');

/**
 * GET /api/semesters
 * Get all semesters with optional filters
 */
exports.getSemesters = async (req, res) => {
  try {
    const { collegeId, courseId, academicYearId, semester } = req.query;
    
    let query = `
      SELECT 
        s.id,
        s.college_id,
        s.course_id,
        s.academic_year_id,
        s.year_of_study,
        s.semester_number,
        s.start_date,
        s.end_date,
        s.created_at,
        s.updated_at,
        c.name AS college_name,
        co.name AS course_name,
        ay.year_label AS academic_year_label
      FROM semesters s
      LEFT JOIN colleges c ON s.college_id = c.id
      INNER JOIN courses co ON s.course_id = co.id
      INNER JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (collegeId) {
      query += ' AND s.college_id = ?';
      params.push(collegeId);
    }
    
    if (courseId) {
      query += ' AND s.course_id = ?';
      params.push(courseId);
    }
    
    if (academicYearId) {
      query += ' AND s.academic_year_id = ?';
      params.push(academicYearId);
    }
    
    if (semester) {
      query += ' AND s.semester_number = ?';
      params.push(semester);
    }
    
    query += ' ORDER BY s.start_date DESC, s.course_id, s.year_of_study, s.semester_number';
    
    const [rows] = await masterPool.query(query, params);
    
    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        collegeId: row.college_id,
        collegeName: row.college_name,
        courseId: row.course_id,
        courseName: row.course_name,
        academicYearId: row.academic_year_id,
        academicYearLabel: row.academic_year_label,
        yearOfStudy: row.year_of_study,
        semesterNumber: row.semester_number,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('getSemesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semesters'
    });
  }
};

/**
 * GET /api/semesters/:semesterId
 * Get single semester by ID
 */
exports.getSemester = async (req, res) => {
  try {
    const semesterId = parseInt(req.params.semesterId, 10);
    
    if (!semesterId || Number.isNaN(semesterId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester ID'
      });
    }
    
    const [rows] = await masterPool.query(
      `SELECT 
        s.id,
        s.college_id,
        s.course_id,
        s.academic_year_id,
        s.year_of_study,
        s.semester_number,
        s.start_date,
        s.end_date,
        s.created_at,
        s.updated_at,
        c.name AS college_name,
        co.name AS course_name,
        ay.year_label AS academic_year_label
      FROM semesters s
      LEFT JOIN colleges c ON s.college_id = c.id
      INNER JOIN courses co ON s.course_id = co.id
      INNER JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.id = ?`,
      [semesterId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found'
      });
    }
    
    const row = rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        collegeId: row.college_id,
        collegeName: row.college_name,
        courseId: row.course_id,
        courseName: row.course_name,
        academicYearId: row.academic_year_id,
        academicYearLabel: row.academic_year_label,
        yearOfStudy: row.year_of_study,
        semesterNumber: row.semester_number,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    console.error('getSemester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semester'
    });
  }
};

/**
 * POST /api/semesters
 * Create a new semester
 */
exports.createSemester = async (req, res) => {
  try {
    const { collegeId, courseId, academicYearId, yearOfStudy, semesterNumber, startDate, endDate } = req.body;
    
    // Validation
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course is required'
      });
    }
    
    if (!academicYearId) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    if (!yearOfStudy || yearOfStudy < 1) {
      return res.status(400).json({
        success: false,
        message: 'Year of study must be at least 1'
      });
    }
    
    if (!semesterNumber || semesterNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Semester number must be at least 1'
      });
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }
    
    // Check for duplicate semester
    const [existing] = await masterPool.query(
      `SELECT id FROM semesters 
       WHERE (college_id = ? OR (college_id IS NULL AND ? IS NULL))
         AND course_id = ? 
         AND academic_year_id = ? 
         AND year_of_study = ? 
         AND semester_number = ?`,
      [collegeId || null, collegeId || null, courseId, academicYearId, yearOfStudy, semesterNumber]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Semester already exists for this course, academic year, year of study, and semester number'
      });
    }
    
    // Insert new semester
    const [result] = await masterPool.query(
      `INSERT INTO semesters 
       (college_id, course_id, academic_year_id, year_of_study, semester_number, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [collegeId || null, courseId, academicYearId, yearOfStudy, semesterNumber, startDate, endDate]
    );
    
    // Fetch the created semester
    const [rows] = await masterPool.query(
      `SELECT 
        s.id,
        s.college_id,
        s.course_id,
        s.academic_year_id,
        s.year_of_study,
        s.semester_number,
        s.start_date,
        s.end_date,
        s.created_at,
        s.updated_at,
        c.name AS college_name,
        co.name AS course_name,
        ay.year_label AS academic_year_label
      FROM semesters s
      LEFT JOIN colleges c ON s.college_id = c.id
      INNER JOIN courses co ON s.course_id = co.id
      INNER JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.id = ?`,
      [result.insertId]
    );
    
    const row = rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        collegeId: row.college_id,
        collegeName: row.college_name,
        courseId: row.course_id,
        courseName: row.course_name,
        academicYearId: row.academic_year_id,
        academicYearLabel: row.academic_year_label,
        yearOfStudy: row.year_of_study,
        semesterNumber: row.semester_number,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      message: 'Semester created successfully'
    });
  } catch (error) {
    console.error('createSemester error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Semester already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create semester'
    });
  }
};

/**
 * PUT /api/semesters/:semesterId
 * Update a semester
 */
exports.updateSemester = async (req, res) => {
  try {
    const semesterId = parseInt(req.params.semesterId, 10);
    
    if (!semesterId || Number.isNaN(semesterId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester ID'
      });
    }
    
    const { collegeId, courseId, academicYearId, yearOfStudy, semesterNumber, startDate, endDate } = req.body;
    
    // Check if semester exists
    const [existing] = await masterPool.query(
      'SELECT id FROM semesters WHERE id = ?',
      [semesterId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found'
      });
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    
    if (collegeId !== undefined) {
      updates.push('college_id = ?');
      params.push(collegeId || null);
    }
    
    if (courseId !== undefined) {
      updates.push('course_id = ?');
      params.push(courseId);
    }
    
    if (academicYearId !== undefined) {
      updates.push('academic_year_id = ?');
      params.push(academicYearId);
    }
    
    if (yearOfStudy !== undefined) {
      updates.push('year_of_study = ?');
      params.push(yearOfStudy);
    }
    
    if (semesterNumber !== undefined) {
      updates.push('semester_number = ?');
      params.push(semesterNumber);
    }
    
    if (startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(startDate);
    }
    
    if (endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(endDate);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    // Validate dates if both are provided
    const finalStartDate = startDate !== undefined ? startDate : null;
    const finalEndDate = endDate !== undefined ? endDate : null;
    
    if (finalStartDate && finalEndDate && new Date(finalStartDate) >= new Date(finalEndDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }
    
    params.push(semesterId);
    
    await masterPool.query(
      `UPDATE semesters SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Fetch updated semester
    const [rows] = await masterPool.query(
      `SELECT 
        s.id,
        s.college_id,
        s.course_id,
        s.academic_year_id,
        s.year_of_study,
        s.semester_number,
        s.start_date,
        s.end_date,
        s.created_at,
        s.updated_at,
        c.name AS college_name,
        co.name AS course_name,
        ay.year_label AS academic_year_label
      FROM semesters s
      LEFT JOIN colleges c ON s.college_id = c.id
      INNER JOIN courses co ON s.course_id = co.id
      INNER JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.id = ?`,
      [semesterId]
    );
    
    const row = rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        collegeId: row.college_id,
        collegeName: row.college_name,
        courseId: row.course_id,
        courseName: row.course_name,
        academicYearId: row.academic_year_id,
        academicYearLabel: row.academic_year_label,
        yearOfStudy: row.year_of_study,
        semesterNumber: row.semester_number,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      message: 'Semester updated successfully'
    });
  } catch (error) {
    console.error('updateSemester error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update semester'
    });
  }
};

/**
 * DELETE /api/semesters/:semesterId
 * Delete a semester
 */
exports.deleteSemester = async (req, res) => {
  try {
    const semesterId = parseInt(req.params.semesterId, 10);
    
    if (!semesterId || Number.isNaN(semesterId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester ID'
      });
    }
    
    // Check if semester exists
    const [existing] = await masterPool.query(
      'SELECT id FROM semesters WHERE id = ?',
      [semesterId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found'
      });
    }
    
    await masterPool.query('DELETE FROM semesters WHERE id = ?', [semesterId]);
    
    res.json({
      success: true,
      message: 'Semester deleted successfully'
    });
  } catch (error) {
    console.error('deleteSemester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete semester'
    });
  }
};

