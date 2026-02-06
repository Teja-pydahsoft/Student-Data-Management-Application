const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const chatController = require('../controllers/chatController');

router.use(authMiddleware);
router.use(attachUserScope);

router.get('/channels', chatController.listChannels);
router.post('/channels', verifyPermission('faculty_academics', 'moderate_chat'), chatController.createChannel);
router.get('/channels/:id/messages', chatController.getMessages);
router.post('/channels/:id/messages', chatController.postMessage);
router.patch('/messages/:id/moderate', verifyPermission('faculty_academics', 'moderate_chat'), chatController.moderateMessage);

module.exports = router;
