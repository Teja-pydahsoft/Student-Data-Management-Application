const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const authMiddleware = require('../middleware/auth');

// Public key
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Subscribe (Protected)
router.post('/subscribe', authMiddleware, pushController.subscribe);

// Note: Broadcast is usually admin only, but keeping it simple for now.

module.exports = router;
