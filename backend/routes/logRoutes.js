const express = require('express');
const router = express.Router();

const logController = require('../controllers/logController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, logController.getAuditLogs);
router.get('/actions', authMiddleware, logController.getAuditLogActions);
router.get('/entities', authMiddleware, logController.getAuditLogEntities);
router.get('/:id', authMiddleware, logController.getAuditLogById);

module.exports = router;

