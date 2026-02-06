const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const internalMarksController = require('../controllers/internalMarksController');

router.use(authMiddleware);
router.use(attachUserScope);

router.get('/', verifyPermission('faculty_academics', 'manage_tests'), internalMarksController.list);
router.post('/', verifyPermission('faculty_academics', 'manage_tests'), internalMarksController.upsert);
router.get('/student/:studentId', internalMarksController.getByStudent);

module.exports = router;
