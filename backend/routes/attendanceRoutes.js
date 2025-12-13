const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/auth');
const { attachUserScope } = require('../middleware/rbac');

const router = express.Router();

router.use(authMiddleware);

// All attendance routes should be scoped
router.get('/filters', attachUserScope, attendanceController.getFilterOptions);
router.get('/summary', attachUserScope, attendanceController.getAttendanceSummary);
router.get('/student/:studentId/history', attachUserScope, attendanceController.getStudentAttendanceHistory);
router.get('/download', attachUserScope, attendanceController.downloadAttendanceReport);
router.get('/', attachUserScope, attendanceController.getAttendance);
router.post('/', attachUserScope, attendanceController.markAttendance);
router.delete('/', attachUserScope, attendanceController.deleteAttendanceForDate);
router.post('/retry-sms', attendanceController.retrySms);
router.post('/send-day-end-reports', attachUserScope, attendanceController.sendDayEndReports);

module.exports = router;
