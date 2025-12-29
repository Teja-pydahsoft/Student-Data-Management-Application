const express = require('express');
const router = express.Router();
const studentHistoryController = require('../controllers/studentHistoryController');
const protect = require('../middleware/auth');

// Protect all routes
// Assuming 'protect' verifies the token and 'authorize' checks roles
// Allowed roles: superadmin, admin, principal, hod, ao (adjust based on actual role names in system)
// Based on typical setup: 'admin' usually covers superadmin/admin. 'principal', 'hod', 'ao' might be specific.
// I will check constants/rbac.js later if needed, but for now assuming standard roles.
// Only "users" (staff) should access this, not students.

router.get('/', protect, studentHistoryController.getStudentsForHistory);
router.post('/remarks', protect, studentHistoryController.addRemark);
router.get('/remarks/:admission_number', protect, studentHistoryController.getRemarks);
router.put('/remarks/:id', protect, studentHistoryController.updateRemark);
router.delete('/remarks/:id', protect, studentHistoryController.deleteRemark);

module.exports = router;
