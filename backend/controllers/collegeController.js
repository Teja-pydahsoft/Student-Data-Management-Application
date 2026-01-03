const collegeService = require('../services/collegeService');
const { masterPool } = require('../config/database');
const { filterCollegesByScope } = require('../utils/scoping');
const upload = require('../config/uploadConfig');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/colleges/public
 * Get all active colleges (public route for forms - no auth required)
 */
exports.getPublicColleges = async (req, res) => {
  try {
    const colleges = await collegeService.fetchColleges({ includeInactive: false });

    // Add cache headers for better performance (cache for 5 minutes)
    res.set('Cache-Control', 'public, max-age=300');

    res.json({
      success: true,
      data: colleges
    });
  } catch (error) {
    console.error('getPublicColleges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch colleges'
    });
  }
};

/**
 * GET /api/colleges
 * Get all colleges (filtered by user scope)
 */
exports.getColleges = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === true;

    let colleges = await collegeService.fetchColleges({ includeInactive });

    // Apply user scope filtering
    if (req.userScope && !req.userScope.unrestricted) {
      colleges = filterCollegesByScope(colleges, req.userScope);
    }

    res.json({
      success: true,
      data: colleges
    });
  } catch (error) {
    console.error('getColleges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch colleges'
    });
  }
};

/**
 * GET /api/colleges/:collegeId
 * Get single college by ID
 */
exports.getCollege = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.collegeId, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    const college = await collegeService.fetchCollegeById(collegeId);

    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    res.json({
      success: true,
      data: college
    });
  } catch (error) {
    console.error('getCollege error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch college'
    });
  }
};

/**
 * POST /api/colleges/:id/upload-header
 * Upload header image for college (stores in database)
 */
exports.uploadHeaderImage = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if college exists
    const college = await collegeService.fetchCollegeById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    // Read file buffer
    const imageBuffer = req.file.buffer;
    const imageType = req.file.mimetype;

    // Update college with new header image (stored as BLOB)
    await masterPool.execute(
      'UPDATE colleges SET header_image = ?, header_image_type = ? WHERE id = ?',
      [imageBuffer, imageType, collegeId]
    );

    res.json({
      success: true,
      message: 'Header image uploaded successfully',
      imageUrl: `/api/colleges/${collegeId}/header-image`
    });
  } catch (error) {
    console.error('uploadHeaderImage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload header image'
    });
  }
};

/**
 * POST /api/colleges/:id/upload-footer
 * Upload footer image for college (stores in database)
 */
exports.uploadFooterImage = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if college exists
    const college = await collegeService.fetchCollegeById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    // Read file buffer
    const imageBuffer = req.file.buffer;
    const imageType = req.file.mimetype;

    // Update college with new footer image (stored as BLOB)
    await masterPool.execute(
      'UPDATE colleges SET footer_image = ?, footer_image_type = ? WHERE id = ?',
      [imageBuffer, imageType, collegeId]
    );

    res.json({
      success: true,
      message: 'Footer image uploaded successfully',
      imageUrl: `/api/colleges/${collegeId}/footer-image`
    });
  } catch (error) {
    console.error('uploadFooterImage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload footer image'
    });
  }
};

/**
 * GET /api/colleges/:id/header-image
 * Get header image for college
 */
exports.getHeaderImage = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    const [rows] = await masterPool.execute(
      'SELECT header_image, header_image_type FROM colleges WHERE id = ?',
      [collegeId]
    );

    if (rows.length === 0 || !rows[0].header_image) {
      return res.status(404).json({
        success: false,
        message: 'Header image not found'
      });
    }

    res.set('Content-Type', rows[0].header_image_type || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(rows[0].header_image);
  } catch (error) {
    console.error('getHeaderImage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve header image'
    });
  }
};

/**
 * GET /api/colleges/:id/footer-image
 * Get footer image for college
 */
exports.getFooterImage = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    const [rows] = await masterPool.execute(
      'SELECT footer_image, footer_image_type FROM colleges WHERE id = ?',
      [collegeId]
    );

    if (rows.length === 0 || !rows[0].footer_image) {
      return res.status(404).json({
        success: false,
        message: 'Footer image not found'
      });
    }

    res.set('Content-Type', rows[0].footer_image_type || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(rows[0].footer_image);
  } catch (error) {
    console.error('getFooterImage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve footer image'
    });
  }
};

/**
 * POST /api/colleges
 * Create new college
 */
exports.createCollege = async (req, res) => {
  try {
    const { name, code, isActive, metadata } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'College name is required'
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'College code is required'
      });
    }

    const college = await collegeService.createCollege({
      name,
      code,
      isActive: isActive !== undefined ? isActive : true,
      metadata
    });

    res.status(201).json({
      success: true,
      data: college,
      message: 'College created successfully'
    });
  } catch (error) {
    console.error('createCollege error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create college'
    });
  }
};

/**
 * PUT /api/colleges/:collegeId
 * Update college
 */
exports.updateCollege = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.collegeId, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    const { name, code, isActive, metadata } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (isActive !== undefined) updates.isActive = isActive;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const result = await collegeService.updateCollege(collegeId, updates);
    const { studentsUpdated, ...college } = result;

    res.json({
      success: true,
      data: college,
      studentsUpdated: studentsUpdated || 0,
      message: studentsUpdated > 0
        ? `College updated successfully. ${studentsUpdated} student record(s) updated.`
        : 'College updated successfully'
    });
  } catch (error) {
    console.error('updateCollege error:', error);

    if (error.message === 'College not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update college'
    });
  }
};

/**
 * DELETE /api/colleges/:collegeId
 * Delete college (soft delete by default)
 */
exports.deleteCollege = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.collegeId, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    const hard = req.query.hard === 'true' || req.query.hard === true;
    const cascade = req.query.cascade === 'true' || req.query.cascade === true;

    const result = await collegeService.deleteCollege(collegeId, { hard, cascade });

    if (cascade) {
      res.json({
        success: true,
        deletedStudents: result.deletedStudents || 0,
        deletedBranches: result.deletedBranches || 0,
        deletedCourses: result.deletedCourses || 0,
        message: 'College and all related data deleted successfully.'
      });
    } else {
      res.json({
        success: true,
        message: hard ? 'College deleted permanently' : 'College deleted successfully'
      });
    }
  } catch (error) {
    console.error('deleteCollege error:', error);

    if (error.message === 'College not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('still has courses')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete college'
    });
  }
};

/**
 * GET /api/colleges/:collegeId/courses
 * Get all courses for a college
 */
exports.getCollegeCourses = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.collegeId, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    // Check if college exists
    const college = await collegeService.fetchCollegeById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === true;

    let courses = await collegeService.getCollegeCourses(collegeId, { includeInactive });

    // Apply user scope filtering for courses
    if (req.userScope && !req.userScope.unrestricted && !req.userScope.allCourses) {
      const { filterCoursesByScope, filterBranchesByScope } = require('../utils/scoping');
      courses = filterCoursesByScope(courses, req.userScope);

      // Also filter branches within each course
      if (!req.userScope.allBranches) {
        courses = courses.map(course => ({
          ...course,
          branches: filterBranchesByScope(course.branches || [], req.userScope)
        }));
      }
    } else if (req.userScope && !req.userScope.unrestricted && !req.userScope.allBranches) {
      // Even if all courses are allowed, still filter branches
      const { filterBranchesByScope } = require('../utils/scoping');
      courses = courses.map(course => ({
        ...course,
        branches: filterBranchesByScope(course.branches || [], req.userScope)
      }));
    }

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('getCollegeCourses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch college courses'
    });
  }
};

/**
 * GET /api/colleges/:collegeId/affected-students
 * Preview students that will be affected when deleting a college
 */
exports.getAffectedStudentsByCollege = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.collegeId, 10);

    if (!collegeId || Number.isNaN(collegeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college ID'
      });
    }

    // Get college name
    const college = await collegeService.fetchCollegeById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    // Get all students under this college (limit to 100 for preview)
    const [students] = await masterPool.query(
      `SELECT admission_number, student_name, course, branch, batch, current_year, current_semester 
       FROM students 
       WHERE college = ?
       ORDER BY student_name ASC
       LIMIT 100`,
      [college.name]
    );

    // Get total count
    const [countResult] = await masterPool.query(
      'SELECT COUNT(*) as total FROM students WHERE college = ?',
      [college.name]
    );

    res.json({
      success: true,
      data: {
        collegeName: college.name,
        students,
        totalCount: countResult[0].total,
        hasMore: countResult[0].total > 100
      }
    });
  } catch (error) {
    console.error('getAffectedStudentsByCollege error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch affected students'
    });
  }
};
