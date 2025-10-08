const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.get('/public/:formId', formController.getPublicForm);

// Protected routes (admin only)
router.post('/', authMiddleware, formController.createForm);
router.get('/', authMiddleware, formController.getAllForms);
router.get('/:formId', authMiddleware, formController.getFormById);
router.put('/:formId', authMiddleware, formController.updateForm);
router.delete('/:formId', authMiddleware, formController.deleteForm);

module.exports = router;
