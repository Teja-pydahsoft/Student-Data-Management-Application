const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Verify token (Protected route)
router.get('/verify', authMiddleware, authController.verifyToken);

// Login (Public route - currently placeholder)
router.post('/unified-login', authController.unifiedLogin);

module.exports = router;
