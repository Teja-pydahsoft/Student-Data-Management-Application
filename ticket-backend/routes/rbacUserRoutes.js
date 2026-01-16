const express = require('express');
const router = express.Router();
const rbacUserController = require('../controllers/rbacUserController');
const authMiddleware = require('../middleware/auth');

// Protect all routes
router.use(authMiddleware);

router.get('/', rbacUserController.getUsers);
router.post('/', rbacUserController.createUser);
router.put('/:id', rbacUserController.updateUser);
router.delete('/:id', rbacUserController.deleteUser);

module.exports = router;
