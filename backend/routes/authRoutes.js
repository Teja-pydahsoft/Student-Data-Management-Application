const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const rbacUserController = require('../controllers/rbacUserController');

const { attachUserScope } = require('../middleware/rbac');

// Public routes
router.post('/login', authController.login);
router.post('/unified-login', authController.unifiedLogin);
router.post('/rbac/forgot-password', rbacUserController.forgotPassword);


// Protected routes
router.get('/verify', authMiddleware, authController.verifyToken);
router.post('/change-password', authMiddleware, authController.changePassword);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/profile/stats', authMiddleware, attachUserScope, rbacUserController.getStudentStats);

module.exports = router;
