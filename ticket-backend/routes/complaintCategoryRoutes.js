const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/complaintCategoryController');
const authMiddleware = require('../middleware/auth');
const { verifyRole } = require('../middleware/rbac');
const { USER_ROLES } = require('../constants/rbac');

// Public route (for student portal drop-downs) - still needs auth? 
// Actually, student needs to be logged in to see categories probably.
router.use(authMiddleware);

// Student Routes
router.get('/active', categoryController.getActiveCategories);

// Admin Routes
router.get(
    '/',
    categoryController.getCategories
);

router.get(
    '/:id',
    categoryController.getCategory
);

router.post(
    '/',
    verifyRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.COLLEGE_PRINCIPAL, USER_ROLES.COLLEGE_AO),
    categoryController.createCategory
);

router.put(
    '/:id',
    verifyRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.COLLEGE_PRINCIPAL, USER_ROLES.COLLEGE_AO),
    categoryController.updateCategory
);

router.delete(
    '/:id',
    verifyRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.COLLEGE_PRINCIPAL),
    categoryController.deleteCategory
);

module.exports = router;
