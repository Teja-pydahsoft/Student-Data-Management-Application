const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/auth');
const { verifyRole } = require('../middleware/rbac');
const { USER_ROLES } = require('../constants/rbac');

// Protect all routes
router.use(authMiddleware);

// Get modules structure (helper for UI)
router.get('/modules', roleController.getModulesStructure);

// Get all roles
router.get('/', roleController.getRoles);

// Get single role
router.get('/:id', roleController.getRole);

// Create new role (Admin only)
router.post(
    '/',
    verifyRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    roleController.createRole
);

// Update role (Admin only)
router.put(
    '/:id',
    verifyRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    roleController.updateRole
);

// Delete role (Admin only)
router.delete(
    '/:id',
    verifyRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    roleController.deleteRole
);

module.exports = router;
