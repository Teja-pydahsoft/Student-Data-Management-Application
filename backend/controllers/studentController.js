const { pool } = require('../config/database');

// Helper function to safely parse JSON fields
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

// Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (admission_number LIKE ? OR student_data LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [students] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (admission_number LIKE ? OR student_data LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    // Parse JSON fields
    const parsedStudents = students.map(student => ({
      ...student,
      student_data: parseJSON(student.student_data)
    }));

    res.json({
      success: true,
      data: parsedStudents,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching students' 
    });
  }
};

// Get student by admission number
exports.getStudentByAdmission = async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    const [students] = await pool.query(
      'SELECT * FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    const student = {
      ...students[0],
      student_data: parseJSON(students[0].student_data)
    };

    res.json({
      success: true,
      data: student
    });

  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching student' 
    });
  }
};

// Update student data
exports.updateStudent = async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { studentData } = req.body;

    if (!studentData || typeof studentData !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Student data is required' 
      });
    }

    const [result] = await pool.query(
      'UPDATE students SET student_data = ? WHERE admission_number = ?',
      [JSON.stringify(studentData), admissionNumber]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE', 'STUDENT', admissionNumber, req.admin.id, JSON.stringify(studentData)]
    );

    res.json({
      success: true,
      message: 'Student data updated successfully'
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating student' 
    });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    const [result] = await pool.query(
      'DELETE FROM students WHERE admission_number = ?',
      [admissionNumber]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id) 
       VALUES (?, ?, ?, ?)`,
      ['DELETE', 'STUDENT', admissionNumber, req.admin.id]
    );

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting student' 
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total students
    const [studentCount] = await pool.query('SELECT COUNT(*) as total FROM students');
    
    // Get total forms
    const [formCount] = await pool.query('SELECT COUNT(*) as total FROM forms');
    
    // Get pending submissions
    const [pendingCount] = await pool.query(
      'SELECT COUNT(*) as total FROM form_submissions WHERE status = "pending"'
    );
    
    // Get approved submissions today
    const [approvedToday] = await pool.query(
      `SELECT COUNT(*) as total FROM form_submissions 
       WHERE status = "approved" AND DATE(reviewed_at) = CURDATE()`
    );

    // Get recent submissions
    const [recentSubmissions] = await pool.query(
      `SELECT fs.submission_id, fs.admission_number, fs.status, fs.submitted_at, f.form_name
       FROM form_submissions fs
       LEFT JOIN forms f ON fs.form_id = f.form_id
       ORDER BY fs.submitted_at DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalStudents: studentCount[0].total,
        totalForms: formCount[0].total,
        pendingSubmissions: pendingCount[0].total,
        approvedToday: approvedToday[0].total,
        recentSubmissions
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching dashboard statistics' 
    });
  }
};
