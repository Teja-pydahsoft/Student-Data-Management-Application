const express = require('express');
const authMiddleware = require('../middleware/auth');
const userController = require('../controllers/userController');
const { requireAdmin } = require('../middleware/authorize');

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get('/operations', userController.getAvailableOperations);
router.get('/', userController.getStaffUsers);
router.post('/', userController.createStaffUser);
router.put('/:id', userController.updateStaffUser);
router.patch('/:id/deactivate', userController.deactivateStaffUser);

module.exports = router;


