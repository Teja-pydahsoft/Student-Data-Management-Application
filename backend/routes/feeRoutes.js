const express = require('express');
const feeController = require('../controllers/feeController');
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission, allowStudentOwnProfileOrPermission } = require('../middleware/rbac');

const router = express.Router();

router.use(authMiddleware);

// All fee routes should be scoped
router.get('/filters', attachUserScope, feeController.getFilterOptions);
router.get('/headers', attachUserScope, feeController.getFeeHeaders);
router.get('/students', attachUserScope, feeController.getStudentsWithFees);

// Fee header management (requires write permission)
router.post('/headers', attachUserScope, verifyPermission('fee_management', 'write'), feeController.createFeeHeader);
router.put('/headers/:id', attachUserScope, verifyPermission('fee_management', 'write'), feeController.updateFeeHeader);
router.delete('/headers/:id', attachUserScope, verifyPermission('fee_management', 'write'), feeController.deleteFeeHeader);

// Student fee updates (requires write permission)
router.get('/students/:studentId/details', attachUserScope, allowStudentOwnProfileOrPermission('fee_management', 'read'), feeController.getStudentFeeDetails);
router.post('/students/:studentId', attachUserScope, verifyPermission('fee_management', 'write'), feeController.updateStudentFees);
router.put('/students/:studentId', attachUserScope, verifyPermission('fee_management', 'write'), feeController.updateStudentFees);

module.exports = router;
