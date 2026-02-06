const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/studentController');
const categoryReportController = require('../../controllers/reports/categoryReportController');
const authMiddleware = require('../../middleware/auth');
const { attachUserScope, verifyPermission } = require('../../middleware/rbac');
const { MODULES } = require('../../constants/rbac');

// Registration reports (delegate to studentController)
router.get(
  '/registration/abstract',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getRegistrationAbstract
);
router.get(
  '/registration',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.getRegistrationReport
);
router.get(
  '/registration/export',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  studentController.exportRegistrationReport
);

// Category (Caste) report - counts per category with Excel/PDF export
router.get(
  '/category',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  categoryReportController.getCategoryReport
);
router.get(
  '/category/export',
  authMiddleware,
  verifyPermission(MODULES.STUDENT_MANAGEMENT, 'view'),
  attachUserScope,
  categoryReportController.exportCategoryReport
);

module.exports = router;
