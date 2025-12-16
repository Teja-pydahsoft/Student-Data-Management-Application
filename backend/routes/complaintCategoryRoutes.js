const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');
const complaintCategoryController = require('../controllers/complaintCategoryController');

// All routes require authentication
router.use(authMiddleware);

// Get active categories (for student portal - no permission check needed for students)
router.get('/active', complaintCategoryController.getActiveCategories);

// Admin routes - require ticket management permission
router.get(
  '/',
  verifyPermission('ticket_management', 'read'),
  complaintCategoryController.getCategories
);

router.get(
  '/:id',
  verifyPermission('ticket_management', 'read'),
  complaintCategoryController.getCategory
);

router.post(
  '/',
  verifyPermission('ticket_management', 'write'),
  complaintCategoryController.createCategory
);

router.put(
  '/:id',
  verifyPermission('ticket_management', 'write'),
  complaintCategoryController.updateCategory
);

router.delete(
  '/:id',
  verifyPermission('ticket_management', 'write'),
  complaintCategoryController.deleteCategory
);

module.exports = router;

