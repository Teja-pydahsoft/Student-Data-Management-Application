const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const periodSlotsController = require('../controllers/periodSlotsController');

router.use(authMiddleware);
router.use(attachUserScope);

router.get('/', periodSlotsController.list);
router.post('/', verifyPermission('faculty_management', 'view'), periodSlotsController.create);
router.put('/:id', verifyPermission('faculty_management', 'view'), periodSlotsController.update);
router.delete('/:id', verifyPermission('faculty_management', 'view'), periodSlotsController.remove);

module.exports = router;
