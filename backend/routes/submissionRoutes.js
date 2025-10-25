const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authMiddleware = require('../middleware/auth');
const upload = submissionController.upload;

// Protected routes (admin only) - Order matters! More specific routes first
router.post('/bulk-delete', authMiddleware, submissionController.bulkDeleteSubmissions);
router.post('/bulk-approve', authMiddleware, submissionController.bulkApproveSubmissions);
router.get('/template/:formId', authMiddleware, submissionController.downloadExcelTemplate);
router.post('/generate-admission-series', authMiddleware, submissionController.generateAdmissionSeries);
router.post('/toggle-auto-assign', authMiddleware, submissionController.toggleAutoAssignSeries);
router.get('/auto-assign-status', authMiddleware, submissionController.getAutoAssignSeries);
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
router.post('/bulk-upload', authMiddleware, submissionController.uploadMiddleware, submissionController.bulkUploadSubmissions);

// Public routes - Order matters! More specific routes first
router.post('/:formId([0-9a-fA-F-]{36})', upload.any(), submissionController.submitForm);
router.post('/:formId', upload.any(), submissionController.submitForm);
router.post('/', upload.any(), submissionController.submitForm);

// Debug route to test form submission
router.post('/test/:formId', submissionController.submitForm);

module.exports = router;
