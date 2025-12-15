const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const { MODULES } = require('../constants/rbac');
const multer = require('multer');

// Configure multer for photo uploads
const photoUpload = multer({ dest: 'uploads/' });

// Configure multer for document uploads (multiple files)
// Also allow larger text fields (for base64 photos in student_data)
const documentUpload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024,      // 10MB per file
    fieldSize: 15 * 1024 * 1024      // Allow larger text fields like base64 images
  }
});

// Public student login
router.post('/login', studentController.login);

// All routes are protected and scoped by user's assigned colleges/courses/branches
// View-only access
router.get(
  '/',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getAllStudents
);
router.get(
  '/filter-fields',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getFilterFields
);
router.get(
  '/filter-options',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getFilterOptions
);
router.get(
  '/quick-filters',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getQuickFilterOptions
);
router.put(
  '/filter-fields/:fieldName',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  studentController.updateFilterField
);
router.get(
  '/stats',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getDashboardStats
);
router.get(
  '/dashboard-stats',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getDashboardStats
);
router.post(
  '/bulk-upload/preview',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'bulk_upload'),
  attachUserScope,
  studentController.uploadMiddleware,
  studentController.previewBulkUploadStudents
);
router.post(
  '/bulk-upload/commit',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'bulk_upload'),
  attachUserScope,
  studentController.commitBulkUploadStudents
);
router.post(
  '/bulk-update-pin-numbers',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'update_pin'),
  attachUserScope,
  studentController.uploadMiddleware,
  studentController.bulkUpdatePinNumbers
);
router.post(
  '/bulk-delete',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'delete_student'),
  attachUserScope,
  studentController.bulkDeleteStudents
);
router.post(
  '/upload-photo',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  photoUpload.single('photo'),
  studentController.uploadStudentPhoto
);
router.post(
  '/promotions/bulk',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.bulkPromoteStudents
);
router.post(
  '/',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'add_student'),
  attachUserScope,
  documentUpload.any(),
  studentController.createStudent
);
router.post(
  '/:admissionNumber/promote',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.promoteStudent
);
router.get(
  '/:admissionNumber',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getStudentByAdmission
);
router.put(
  '/:admissionNumber',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.updateStudent
);
router.put(
  '/:admissionNumber/pin-number',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'update_pin'),
  attachUserScope,
  studentController.updatePinNumber
);
router.get(
  '/:admissionNumber/password',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.viewStudentPassword
);
router.post(
  '/:admissionNumber/reset-password',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.resetStudentPassword
);
router.put(
  '/:admissionNumber/fee-status',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.updateFeeStatus
);
router.put(
  '/:admissionNumber/registration-status',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.updateRegistrationStatus
);
router.post(
  '/check-expired-permits',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'edit_student'),
  attachUserScope,
  studentController.checkExpiredPermits
);
router.post('/otp/send', authMiddleware, studentController.sendOtp);
router.post('/otp/verify', authMiddleware, studentController.verifyOtp);
router.delete(
  '/:admissionNumber',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'delete_student'),
  attachUserScope,
  studentController.deleteStudent
);

module.exports = router;
