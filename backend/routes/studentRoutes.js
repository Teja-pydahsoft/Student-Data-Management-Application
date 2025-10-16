const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/auth');

// All routes are protected (admin only)
router.get('/', authMiddleware, studentController.getAllStudents);
router.get('/stats', authMiddleware, studentController.getDashboardStats);
router.get('/dashboard-stats', authMiddleware, studentController.getDashboardStats);
router.post('/bulk-update-roll-numbers', authMiddleware, studentController.uploadMiddleware, studentController.bulkUpdateRollNumbers);
router.post('/', authMiddleware, studentController.createStudent);
router.get('/:admissionNumber', authMiddleware, studentController.getStudentByAdmission);
router.put('/:admissionNumber', authMiddleware, studentController.updateStudent);
router.put('/:admissionNumber/roll-number', authMiddleware, studentController.updateRollNumber);
router.delete('/:admissionNumber', authMiddleware, studentController.deleteStudent);

module.exports = router;
