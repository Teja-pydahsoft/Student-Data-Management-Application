const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/auth');

// Public routes (if any needed for students to fill forms without login, though feedback might require login)
// router.get('/public/:formId', feedbackController.getPublicForm);

// Protected routes (admin only for management)
router.post('/', authMiddleware, feedbackController.createFeedbackForm);
router.get('/', authMiddleware, feedbackController.getAllFeedbackForms);
router.get('/:formId', authMiddleware, feedbackController.getFeedbackFormById);
router.put('/:formId', authMiddleware, feedbackController.updateFeedbackForm);
router.delete('/:formId', authMiddleware, feedbackController.deleteFeedbackForm);

// Analytics route
router.get('/analytics', authMiddleware, feedbackController.getAnalytics);

// Student routes
router.get('/student/pending', authMiddleware, feedbackController.getMyPendingFeedback);
router.post('/student/submit', authMiddleware, feedbackController.submitFeedback);

module.exports = router;
