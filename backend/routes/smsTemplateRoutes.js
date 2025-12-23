const express = require('express');
const router = express.Router();
const smsTemplateController = require('../controllers/smsTemplateController');
const protect = require('../middleware/auth');

router.get('/', protect, smsTemplateController.getTemplates);
router.post('/', protect, smsTemplateController.createTemplate);
router.put('/:id', protect, smsTemplateController.updateTemplate);
router.delete('/:id', protect, smsTemplateController.deleteTemplate);

module.exports = router;
