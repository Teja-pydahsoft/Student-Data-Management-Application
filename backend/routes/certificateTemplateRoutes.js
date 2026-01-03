const express = require('express');
const router = express.Router();
const certificateTemplateController = require('../controllers/certificateTemplateController');
const upload = require('../config/uploadConfig');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(requireAdmin);

// Get available variables
router.get('/variables', certificateTemplateController.getAvailableVariables);

// Template CRUD
router.get('/', certificateTemplateController.getTemplates);
router.get('/:id', certificateTemplateController.getTemplateById);
router.post('/', certificateTemplateController.createTemplate);
router.put('/:id', certificateTemplateController.updateTemplate);
router.delete('/:id', certificateTemplateController.deleteTemplate);

// Image uploads
router.post('/:id/upload-header', upload.single('header'), certificateTemplateController.uploadHeaderImage);
router.post('/:id/upload-footer', upload.single('footer'), certificateTemplateController.uploadFooterImage);

module.exports = router;
