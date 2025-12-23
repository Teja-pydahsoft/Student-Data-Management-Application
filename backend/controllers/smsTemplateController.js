const { masterPool } = require('../config/database');

// Create a new template
exports.createTemplate = async (req, res) => {
    try {
        const { name, template_id, content, variable_mappings } = req.body;

        if (!name || !template_id || !content) {
            return res.status(400).json({ success: false, message: 'Name, Template ID and Content are required' });
        }

        const createdBy = req.user.id;
        const createdByName = req.user.username;

        const [result] = await masterPool.query(
            `INSERT INTO sms_templates (name, template_id, content, variable_mappings, created_by, created_by_name) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, template_id, content, JSON.stringify(variable_mappings), createdBy, createdByName]
        );

        res.status(201).json({
            success: true,
            message: 'Template created successfully',
            data: { id: result.insertId, ...req.body }
        });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ success: false, message: 'Failed to create template' });
    }
};

// Get all templates
exports.getTemplates = async (req, res) => {
    try {
        const [rows] = await masterPool.query('SELECT * FROM sms_templates ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch templates' });
    }
};

// Update a template
exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, template_id, content, variable_mappings } = req.body;

        await masterPool.query(
            `UPDATE sms_templates 
             SET name = ?, template_id = ?, content = ?, variable_mappings = ? 
             WHERE id = ?`,
            [name, template_id, content, JSON.stringify(variable_mappings), id]
        );

        res.json({ success: true, message: 'Template updated successfully' });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ success: false, message: 'Failed to update template' });
    }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await masterPool.query('DELETE FROM sms_templates WHERE id = ?', [id]);
        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete template' });
    }
};
