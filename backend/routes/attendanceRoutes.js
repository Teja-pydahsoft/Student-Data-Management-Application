const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/filters', attendanceController.getFilterOptions);
router.get('/summary', attendanceController.getAttendanceSummary);
router.get('/student/:studentId/history', attendanceController.getStudentAttendanceHistory);
router.get('/', attendanceController.getAttendance);
router.post('/', attendanceController.markAttendance);

module.exports = router;

