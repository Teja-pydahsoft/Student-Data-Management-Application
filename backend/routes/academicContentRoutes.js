const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const academicContentController = require('../controllers/academicContentController');

router.use(authMiddleware);
router.use(attachUserScope);

router.get('/', academicContentController.list);
router.post('/', verifyPermission('faculty_academics', 'upload_content'), academicContentController.create);
router.get('/:id', academicContentController.getById);
router.put('/:id', verifyPermission('faculty_academics', 'upload_content'), academicContentController.update);
router.delete('/:id', verifyPermission('faculty_academics', 'upload_content'), academicContentController.remove);
router.post('/:id/submit', academicContentController.submit);

module.exports = router;
