const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');

// Configure multer for photo uploads
const photoUpload = multer({ dest: 'uploads/' });

// All routes are protected (admin only)
router.get('/', authMiddleware, studentController.getAllStudents);
router.get('/filter-fields', authMiddleware, studentController.getFilterFields);
router.put('/filter-fields/:fieldName', authMiddleware, studentController.updateFilterField);
router.get('/stats', authMiddleware, studentController.getDashboardStats);
router.get('/dashboard-stats', authMiddleware, studentController.getDashboardStats);
router.post(
  '/bulk-upload/preview',
  authMiddleware,
  studentController.uploadMiddleware,
  studentController.previewBulkUploadStudents
);
router.post(
  '/bulk-upload/commit',
  authMiddleware,
  studentController.commitBulkUploadStudents
);
router.post('/bulk-update-pin-numbers', authMiddleware, studentController.uploadMiddleware, studentController.bulkUpdatePinNumbers);
router.post('/bulk-delete', authMiddleware, studentController.bulkDeleteStudents);
router.post('/upload-photo', authMiddleware, photoUpload.single('photo'), studentController.uploadStudentPhoto);
router.post('/promotions/bulk', authMiddleware, studentController.bulkPromoteStudents);
router.post('/', authMiddleware, studentController.createStudent);
router.post('/:admissionNumber/promote', authMiddleware, studentController.promoteStudent);
router.get('/:admissionNumber', authMiddleware, studentController.getStudentByAdmission);
router.put('/:admissionNumber', authMiddleware, studentController.updateStudent);
router.put('/:admissionNumber/pin-number', authMiddleware, studentController.updatePinNumber);
router.delete('/:admissionNumber', authMiddleware, studentController.deleteStudent);

module.exports = router;
