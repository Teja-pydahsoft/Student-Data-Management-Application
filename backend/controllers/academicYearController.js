const { masterPool } = require('../config/database');

/**
 * Get all academic years
 */
exports.getAcademicYears = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
    
    const [rows] = await masterPool.query(
      `SELECT * FROM academic_years ${whereClause} ORDER BY year_label DESC`
    );

    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        yearLabel: row.year_label,
        startDate: row.start_date,
        endDate: row.end_date,
        isActive: row.is_active === 1 || row.is_active === true,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('getAcademicYears error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic years'
    });
  }
};

/**
 * Create a new academic year
 */
exports.createAcademicYear = async (req, res) => {
  try {
    const { yearLabel, startDate, endDate, isActive } = req.body;

    if (!yearLabel || !yearLabel.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Year label is required'
      });
    }

    // Check if year already exists
    const [existing] = await masterPool.query(
      'SELECT id FROM academic_years WHERE year_label = ?',
      [yearLabel.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Academic year already exists'
      });
    }

    const [result] = await masterPool.query(
      `INSERT INTO academic_years (year_label, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?)`,
      [
        yearLabel.trim(),
        startDate || null,
        endDate || null,
        isActive !== false
      ]
    );

    const [newYear] = await masterPool.query(
      'SELECT * FROM academic_years WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Academic year created successfully',
      data: {
        id: newYear[0].id,
        yearLabel: newYear[0].year_label,
        startDate: newYear[0].start_date,
        endDate: newYear[0].end_date,
        isActive: newYear[0].is_active === 1 || newYear[0].is_active === true
      }
    });
  } catch (error) {
    console.error('createAcademicYear error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Academic year already exists'
        : 'Failed to create academic year'
    });
  }
};

/**
 * Update an academic year
 */
exports.updateAcademicYear = async (req, res) => {
  try {
    const yearId = parseInt(req.params.yearId, 10);
    if (!yearId || Number.isNaN(yearId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid academic year ID'
      });
    }

    const { yearLabel, startDate, endDate, isActive } = req.body;

    const fields = [];
    const values = [];

    if (yearLabel !== undefined) {
      if (!yearLabel.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Year label cannot be empty'
        });
      }
      fields.push('year_label = ?');
      values.push(yearLabel.trim());
    }

    if (startDate !== undefined) {
      fields.push('start_date = ?');
      values.push(startDate || null);
    }

    if (endDate !== undefined) {
      fields.push('end_date = ?');
      values.push(endDate || null);
    }

    if (isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(isActive);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided for update'
      });
    }

    values.push(yearId);

    const [result] = await masterPool.query(
      `UPDATE academic_years SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found'
      });
    }

    const [updated] = await masterPool.query(
      'SELECT * FROM academic_years WHERE id = ?',
      [yearId]
    );

    res.json({
      success: true,
      message: 'Academic year updated successfully',
      data: {
        id: updated[0].id,
        yearLabel: updated[0].year_label,
        startDate: updated[0].start_date,
        endDate: updated[0].end_date,
        isActive: updated[0].is_active === 1 || updated[0].is_active === true
      }
    });
  } catch (error) {
    console.error('updateAcademicYear error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ER_DUP_ENTRY'
        ? 'Academic year with this label already exists'
        : 'Failed to update academic year'
    });
  }
};

/**
 * Delete an academic year
 */
exports.deleteAcademicYear = async (req, res) => {
  try {
    const yearId = parseInt(req.params.yearId, 10);
    if (!yearId || Number.isNaN(yearId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid academic year ID'
      });
    }

    // Check if any branches are using this academic year
    const [branches] = await masterPool.query(
      'SELECT COUNT(*) as count FROM course_branches WHERE academic_year_id = ?',
      [yearId]
    );

    if (branches[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${branches[0].count} branch(es) are using this academic year`
      });
    }

    const [result] = await masterPool.query(
      'DELETE FROM academic_years WHERE id = ?',
      [yearId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found'
      });
    }

    res.json({
      success: true,
      message: 'Academic year deleted successfully'
    });
  } catch (error) {
    console.error('deleteAcademicYear error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete academic year'
    });
  }
};

/**
 * Get academic years that are available for student addition
 * (Only active years)
 */
exports.getActiveAcademicYears = async (req, res) => {
  try {
    const [rows] = await masterPool.query(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label DESC'
    );

    // Add cache headers for better performance (cache for 5 minutes)
    res.set('Cache-Control', 'public, max-age=300');
    
    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        yearLabel: row.year_label,
        startDate: row.start_date,
        endDate: row.end_date
      }))
    });
  } catch (error) {
    console.error('getActiveAcademicYears error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active academic years'
    });
  }
};

/**
 * Public endpoint for active academic years (no auth required)
 * Used by public forms
 */
exports.getPublicActiveAcademicYears = async (req, res) => {
  try {
    const [rows] = await masterPool.query(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label DESC'
    );

    // Add cache headers for better performance (cache for 5 minutes)
    res.set('Cache-Control', 'public, max-age=300');
    
    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        yearLabel: row.year_label,
        startDate: row.start_date,
        endDate: row.end_date
      }))
    });
  } catch (error) {
    console.error('getPublicActiveAcademicYears error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic years'
    });
  }
};

