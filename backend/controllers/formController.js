const { supabase } = require('../config/supabase');
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
    // Use the primary frontend URL for QR codes (first one in the list)
    const frontendUrl = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',')[0].trim()
      : (process.env.NODE_ENV === 'production'
          ? 'https://student-data-management-application.vercel.app'
          : 'http://localhost:3000');

    const formUrl = `${frontendUrl}/form/${formId}`;

    // Generate QR code
    const qrCodeData = await QRCode.toDataURL(formUrl);

    // Insert form
    const { error: insertErr } = await supabase
      .from('forms')
      .insert({
        form_id: formId,
        form_name: formName,
        form_description: formDescription || '',
        form_fields: formFields,
        qr_code_data: qrCodeData,
        created_by: req.admin.id
      });
    if (insertErr) throw insertErr;

    // Log action
    await supabase.from('audit_logs').insert({
      action_type: 'CREATE', entity_type: 'FORM', entity_id: formId,
      admin_id: req.admin.id, details: { formName }
    });

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
    const { data: forms, error } = await supabase
      .from('forms')
      .select('*, admins!forms_created_by_fkey(username)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Parse JSON fields
    const parsedForms = (forms || []).map(form => ({
      ...form,
      created_by_name: form.admins?.username || null,
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

    const { data: forms, error } = await supabase
      .from('forms')
      .select('*, admins!forms_created_by_fkey(username)')
      .eq('form_id', formId)
      .limit(1);
    if (error) throw error;

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
    const { data: forms, error: e1 } = await supabase
      .from('forms')
      .select('*')
      .eq('form_id', formId)
      .limit(1);
    if (e1) throw e1;

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

    const updatePayload = {};
    if (formName !== undefined) updatePayload.form_name = formName;
    if (formDescription !== undefined) updatePayload.form_description = formDescription;
    if (formFields !== undefined) updatePayload.form_fields = formFields;
    if (isActive !== undefined) updatePayload.is_active = isActive;
    const { error: e2 } = await supabase
      .from('forms')
      .update(updatePayload)
      .eq('form_id', formId);
    if (e2) throw e2;

    // Log action
    await supabase.from('audit_logs').insert({
      action_type: 'UPDATE', entity_type: 'FORM', entity_id: formId,
      admin_id: req.admin.id, details: req.body
    });

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

    const { error: delErr, count } = await supabase
      .from('forms')
      .delete()
      .eq('form_id', formId)
      .select('form_id', { count: 'exact' });
    if (delErr) throw delErr;
    if (!count) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    // Log action
    await supabase.from('audit_logs').insert({
      action_type: 'DELETE', entity_type: 'FORM', entity_id: formId,
      admin_id: req.admin.id
    });

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

    const { data: forms, error: e3 } = await supabase
      .from('forms')
      .select('form_id, form_name, form_description, form_fields, is_active')
      .eq('form_id', formId)
      .limit(1);
    if (e3) throw e3;

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
