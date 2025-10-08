const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

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

// Create new form
exports.createForm = async (req, res) => {
  try {
    const { formName, formDescription, formFields } = req.body;

    if (!formName || !formFields || !Array.isArray(formFields)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Form name and fields are required' 
      });
    }

    const formId = uuidv4();
    const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${formId}`;
    
    // Generate QR code
    const qrCodeData = await QRCode.toDataURL(formUrl);

    // Insert form
    await pool.query(
      `INSERT INTO forms (form_id, form_name, form_description, form_fields, qr_code_data, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [formId, formName, formDescription || '', JSON.stringify(formFields), qrCodeData, req.admin.id]
    );

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['CREATE', 'FORM', formId, req.admin.id, JSON.stringify({ formName })]
    );

    res.status(201).json({
      success: true,
      message: 'Form created successfully',
      data: {
        formId,
        formName,
        formUrl,
        qrCodeData
      }
    });

  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating form' 
    });
  }
};

// Get all forms
exports.getAllForms = async (req, res) => {
  try {
    const [forms] = await pool.query(
      `SELECT f.*, a.username as created_by_name,
       (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.form_id AND status = 'pending') as pending_count,
       (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.form_id AND status = 'approved') as approved_count
       FROM forms f
       LEFT JOIN admins a ON f.created_by = a.id
       ORDER BY f.created_at DESC`
    );

    // Parse JSON fields
    const parsedForms = forms.map(form => ({
      ...form,
      form_fields: parseJSON(form.form_fields)
    }));

    res.json({
      success: true,
      data: parsedForms
    });

  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching forms' 
    });
  }
};

// Get single form by ID
exports.getFormById = async (req, res) => {
  try {
    const { formId } = req.params;

    const [forms] = await pool.query(
      `SELECT f.*, a.username as created_by_name
       FROM forms f
       LEFT JOIN admins a ON f.created_by = a.id
       WHERE f.form_id = ?`,
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    const form = {
      ...forms[0],
      form_fields: parseJSON(forms[0].form_fields)
    };

    res.json({
      success: true,
      data: form
    });

  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching form' 
    });
  }
};

// Update form (fields can be updated, QR code remains same)
exports.updateForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const { formName, formDescription, formFields, isActive } = req.body;

    // Check if form exists
    const [forms] = await pool.query(
      'SELECT * FROM forms WHERE form_id = ?',
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (formName !== undefined) {
      updates.push('form_name = ?');
      values.push(formName);
    }
    if (formDescription !== undefined) {
      updates.push('form_description = ?');
      values.push(formDescription);
    }
    if (formFields !== undefined) {
      updates.push('form_fields = ?');
      values.push(JSON.stringify(formFields));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }

    values.push(formId);

    await pool.query(
      `UPDATE forms SET ${updates.join(', ')} WHERE form_id = ?`,
      values
    );

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE', 'FORM', formId, req.admin.id, JSON.stringify(req.body)]
    );

    res.json({
      success: true,
      message: 'Form updated successfully'
    });

  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating form' 
    });
  }
};

// Delete form
exports.deleteForm = async (req, res) => {
  try {
    const { formId } = req.params;

    const [result] = await pool.query(
      'DELETE FROM forms WHERE form_id = ?',
      [formId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id) 
       VALUES (?, ?, ?, ?)`,
      ['DELETE', 'FORM', formId, req.admin.id]
    );

    res.json({
      success: true,
      message: 'Form deleted successfully'
    });

  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting form' 
    });
  }
};

// Get form for public submission (no auth required)
exports.getPublicForm = async (req, res) => {
  try {
    const { formId } = req.params;

    const [forms] = await pool.query(
      'SELECT form_id, form_name, form_description, form_fields, is_active FROM forms WHERE form_id = ?',
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    const form = forms[0];

    if (!form.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'This form is no longer active' 
      });
    }

    res.json({
      success: true,
      data: {
        ...form,
        form_fields: parseJSON(form.form_fields)
      }
    });

  } catch (error) {
    console.error('Get public form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching form' 
    });
  }
};
