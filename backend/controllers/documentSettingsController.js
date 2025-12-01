/**
 * Document Settings Controller
 * Manages document requirements configuration for student registration forms
 * Uses document_requirements table in MySQL
 */

const { masterPool } = require('../config/database');

// Helper to parse JSON safely
const parseJSON = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
  return data;
};

/**
 * GET /api/settings/documents
 * Get all document requirements
 */
exports.getAllDocumentRequirements = async (req, res) => {
  let conn = null;
  try {
    conn = await masterPool.getConnection();
    
    const [rows] = await conn.query(
      `SELECT * FROM document_requirements 
       ORDER BY course_type ASC, academic_stage ASC`
    );

    const parsedData = rows.map(item => ({
      ...item,
      required_documents: parseJSON(item.required_documents)
    }));

    res.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Error fetching document requirements:', error);
    res.status(500).json({ success: false, message: 'Server error fetching document requirements' });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * GET /api/settings/documents/:courseType/:academicStage
 * Get document requirements by course type and academic stage
 */
exports.getDocumentRequirements = async (req, res) => {
  let conn = null;
  try {
    const { courseType, academicStage } = req.params;
    conn = await masterPool.getConnection();

    const [rows] = await conn.query(
      `SELECT * FROM document_requirements 
       WHERE course_type = ? AND academic_stage = ? 
       LIMIT 1`,
      [courseType, academicStage]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document requirements not found for this type and stage' 
      });
    }

    const data = rows[0];
    res.json({
      success: true,
      data: {
        ...data,
        required_documents: parseJSON(data.required_documents)
      }
    });
  } catch (error) {
    console.error('Error fetching specific document requirements:', error);
    res.status(500).json({ success: false, message: 'Server error fetching document requirements' });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * POST /api/settings/documents
 * Create or update document requirements
 */
exports.upsertDocumentRequirements = async (req, res) => {
  let conn = null;
  try {
    const { course_type, academic_stage, required_documents, is_enabled } = req.body;

    if (!course_type || !academic_stage || !Array.isArray(required_documents)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course type, academic stage, and required documents array are mandatory.' 
      });
    }

    // Validate course_type and academic_stage
    if (!['UG', 'PG'].includes(course_type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course type must be UG or PG' 
      });
    }

    if (!['10th', 'Inter', 'Diploma', 'UG'].includes(academic_stage)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Academic stage must be 10th, Inter, Diploma, or UG' 
      });
    }

    conn = await masterPool.getConnection();
    
    // Check if record exists
    const [existing] = await conn.query(
      `SELECT id FROM document_requirements 
       WHERE course_type = ? AND academic_stage = ? 
       LIMIT 1`,
      [course_type, academic_stage]
    );

    const requiredDocsJson = JSON.stringify(required_documents);
    const isEnabled = is_enabled !== undefined ? is_enabled : true;

    if (existing.length > 0) {
      // Update existing record
      await conn.query(
        `UPDATE document_requirements 
         SET required_documents = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE course_type = ? AND academic_stage = ?`,
        [requiredDocsJson, isEnabled, course_type, academic_stage]
      );
    } else {
      // Insert new record
      await conn.query(
        `INSERT INTO document_requirements 
         (course_type, academic_stage, required_documents, is_enabled) 
         VALUES (?, ?, ?, ?)`,
        [course_type, academic_stage, requiredDocsJson, isEnabled]
      );
    }

    // Fetch the updated/inserted record
    const [rows] = await conn.query(
      `SELECT * FROM document_requirements 
       WHERE course_type = ? AND academic_stage = ? 
       LIMIT 1`,
      [course_type, academic_stage]
    );

    const data = rows[0];
    res.status(200).json({ 
      success: true, 
      message: 'Document requirements saved successfully', 
      data: {
        ...data,
        required_documents: parseJSON(data.required_documents)
      }
    });
  } catch (error) {
    console.error('Error upserting document requirements:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error saving document requirements' 
    });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * DELETE /api/settings/documents/:courseType/:academicStage
 * Delete document requirements
 */
exports.deleteDocumentRequirements = async (req, res) => {
  let conn = null;
  try {
    const { courseType, academicStage } = req.params;
    conn = await masterPool.getConnection();

    const [result] = await conn.query(
      `DELETE FROM document_requirements 
       WHERE course_type = ? AND academic_stage = ?`,
      [courseType, academicStage]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document requirements not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Document requirements deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting document requirements:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error deleting document requirements' 
    });
  } finally {
    if (conn) conn.release();
  }
};

// Legacy endpoints for backward compatibility (kept but not used by new frontend)
exports.getDocumentRequirementsLegacy = async (req, res) => {
  return exports.getAllDocumentRequirements(req, res);
};

exports.updateDocumentRequirements = async (req, res) => {
  // Legacy endpoint - not used by new frontend
  res.status(400).json({
    success: false,
    message: 'This endpoint is deprecated. Use POST /api/settings/documents instead.'
  });
};

exports.getDocumentRequirementsByCourseType = async (req, res) => {
  // Legacy endpoint - not used by new frontend
  res.status(400).json({
    success: false,
    message: 'This endpoint is deprecated. Use GET /api/settings/documents/:courseType/:academicStage instead.'
  });
};
