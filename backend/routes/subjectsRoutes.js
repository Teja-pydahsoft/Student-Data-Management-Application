const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const subjectsController = require('../controllers/subjectsController');

router.use(authMiddleware);
router.use(attachUserScope);

router.get('/', subjectsController.list);
router.post('/', verifyPermission('faculty_management', 'view'), subjectsController.create);
router.put('/:id', verifyPermission('faculty_management', 'view'), subjectsController.update);
router.delete('/:id', verifyPermission('faculty_management', 'view'), subjectsController.remove);

module.exports = router;
