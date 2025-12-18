const express = require('express');
const router = express.Router();
const pollController = require('../controllers/pollController');
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');

// Student Routes
router.get(
    '/student',
    authMiddleware,
    pollController.getStudentPolls
);

router.post(
    '/:id/vote',
    authMiddleware,
    pollController.votePoll
);

// Admin Routes (Using 'announcements' permission for now as it's part of that module)
router.get(
    '/admin',
    authMiddleware,
    verifyPermission('announcements', 'view'),
    pollController.getPolls
);

router.post(
    '/',
    authMiddleware,
    verifyPermission('announcements', 'create'),
    pollController.createPoll
);

router.patch(
    '/:id/status',
    authMiddleware,
    verifyPermission('announcements', 'edit'),
    pollController.toggleStatus
);

router.put(
    '/:id',
    authMiddleware,
    verifyPermission('announcements', 'edit'),
    pollController.updatePoll
);

router.delete(
    '/:id',
    authMiddleware,
    verifyPermission('announcements', 'delete'),
    pollController.deletePoll
);

module.exports = router;
