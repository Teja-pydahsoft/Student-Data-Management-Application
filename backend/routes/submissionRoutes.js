const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/:formId', submissionController.submitForm);

// Protected routes (admin only)
router.get('/', authMiddleware, submissionController.getAllSubmissions);
router.post('/bulk-upload', authMiddleware, submissionController.uploadMiddleware, submissionController.bulkUploadSubmissions);
router.get('/:submissionId', authMiddleware, submissionController.getSubmissionById);
router.post('/:submissionId/approve', authMiddleware, submissionController.approveSubmission);
router.post('/:submissionId/reject', authMiddleware, submissionController.rejectSubmission);
router.delete('/:submissionId', authMiddleware, submissionController.deleteSubmission);

module.exports = router;
