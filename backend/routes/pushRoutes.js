const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const verifyToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

// Public key does not need auth, but better to have it open
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Subscribe
router.post('/subscribe', verifyToken, pushController.subscribe);

// Broadcast (Admin only)
router.post('/broadcast', verifyToken, requireAdmin, pushController.broadcastNotification);

module.exports = router;
