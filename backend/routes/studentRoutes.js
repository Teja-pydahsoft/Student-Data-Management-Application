const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/auth');
const { attachUserScope } = require('../middleware/rbac');
const multer = require('multer');

// Configure multer for photo uploads
const photoUpload = multer({ dest: 'uploads/' });

// Configure multer for document uploads (multiple files)
const documentUpload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// All routes are protected and scoped by user's assigned colleges/courses/branches
router.get('/', authMiddleware, attachUserScope, studentController.getAllStudents);
router.get('/filter-fields', authMiddleware, attachUserScope, studentController.getFilterFields);
router.get('/filter-options', authMiddleware, attachUserScope, studentController.getFilterOptions);
router.get('/quick-filters', authMiddleware, attachUserScope, studentController.getQuickFilterOptions);
router.put('/filter-fields/:fieldName', authMiddleware, studentController.updateFilterField);
router.get('/stats', authMiddleware, attachUserScope, studentController.getDashboardStats);
router.get('/dashboard-stats', authMiddleware, attachUserScope, studentController.getDashboardStats);
router.post(
  '/bulk-upload/preview',
  authMiddleware,
  attachUserScope,
  studentController.uploadMiddleware,
  studentController.previewBulkUploadStudents
);
router.post(
  '/bulk-upload/commit',
  authMiddleware,
  attachUserScope,
  studentController.commitBulkUploadStudents
);
router.post('/bulk-update-pin-numbers', authMiddleware, attachUserScope, studentController.uploadMiddleware, studentController.bulkUpdatePinNumbers);
router.post('/bulk-delete', authMiddleware, attachUserScope, studentController.bulkDeleteStudents);
router.post('/upload-photo', authMiddleware, photoUpload.single('photo'), studentController.uploadStudentPhoto);
router.post('/promotions/bulk', authMiddleware, attachUserScope, studentController.bulkPromoteStudents);
router.post('/', authMiddleware, attachUserScope, documentUpload.any(), studentController.createStudent);
router.post('/:admissionNumber/promote', authMiddleware, attachUserScope, studentController.promoteStudent);
router.get('/:admissionNumber', authMiddleware, attachUserScope, studentController.getStudentByAdmission);
router.put('/:admissionNumber', authMiddleware, attachUserScope, studentController.updateStudent);
router.put('/:admissionNumber/pin-number', authMiddleware, attachUserScope, studentController.updatePinNumber);
router.get('/:admissionNumber/password', authMiddleware, attachUserScope, studentController.viewStudentPassword);
router.post('/:admissionNumber/reset-password', authMiddleware, attachUserScope, studentController.resetStudentPassword);
router.delete('/:admissionNumber', authMiddleware, attachUserScope, studentController.deleteStudent);

module.exports = router;
