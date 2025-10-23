const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authMiddleware = require('../middleware/auth');

// Protected routes (admin only) - Order matters! More specific routes first
router.post('/bulk-approve', authMiddleware, submissionController.bulkApproveSubmissions);
router.get('/template/:formId', authMiddleware, submissionController.downloadExcelTemplate);
router.post('/generate-admission-series', authMiddleware, submissionController.generateAdmissionSeries);
router.get('/', authMiddleware, submissionController.getAllSubmissions);

// More specific route for UUID pattern
router.get('/:submissionId([0-9a-fA-F-]{36})', authMiddleware, submissionController.getSubmissionById);

// Alternative route pattern for debugging
router.get('/submission/:submissionId', authMiddleware, submissionController.getSubmissionById);
router.get('/:submissionId/field-status', authMiddleware, submissionController.getFieldCompletionStatus);
router.get('/student/:admissionNumber/completion-status', authMiddleware, submissionController.getStudentCompletionStatus);
router.post('/:submissionId/approve', authMiddleware, submissionController.approveSubmission);
router.post('/:submissionId/reject', authMiddleware, submissionController.rejectSubmission);
router.delete('/:submissionId', authMiddleware, submissionController.deleteSubmission);

// CRITICAL: Bulk upload route must come BEFORE any generic routes that could match it
router.post('/bulk-upload', (req, res, next) => {
  console.log('🔄 Bulk upload request received at route level');
  console.log('📋 Request headers:', req.headers.authorization ? 'Token present' : 'No token');
  console.log('📁 Content-Type:', req.headers['content-type']);
  next();
}, authMiddleware, submissionController.uploadMiddleware, submissionController.bulkUploadSubmissions);

// Public routes - Order matters! More specific routes first
router.post('/:formId([0-9a-fA-F-]{36})', submissionController.submitForm);
router.post('/:formId', submissionController.submitForm);
router.post('/', submissionController.submitForm);

// Debug route to test form submission
router.post('/test/:formId', submissionController.submitForm);

module.exports = router;
