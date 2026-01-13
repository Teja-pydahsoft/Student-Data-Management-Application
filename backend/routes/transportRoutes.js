const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');
const verifyToken = require('../middleware/auth');

// Get all routes (Public or Authenticated?) - Let's keep it authenticated for students
router.get('/routes', verifyToken, transportController.getAllRoutes);

// Get all buses
router.get('/buses', verifyToken, transportController.getBuses);

// Create Request
router.post('/request', verifyToken, transportController.createTransportRequest);

// Get My Requests
router.get('/my-requests', verifyToken, transportController.getMyTransportRequests);

module.exports = router;
