const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const chatController = require('../controllers/chatController');
const uploadChat = require('../config/uploadChat');

router.use(authMiddleware);
router.use(attachUserScope);

router.get('/channels', chatController.listChannels);
router.get('/channels/by-club/:clubId', chatController.getChannelByClub);
router.post('/channels', verifyPermission('faculty_academics', 'moderate_chat'), chatController.createChannel);
router.get('/channels/:id/messages', chatController.getMessages);
router.post('/channels/:id/upload', uploadChat.single('file'), chatController.uploadAttachment);
router.post('/channels/:id/messages', chatController.postMessage);
router.patch('/messages/:id', chatController.editMessage);
router.patch('/messages/:id/poll', chatController.editPoll);
router.patch('/messages/:id/moderate', verifyPermission('faculty_academics', 'moderate_chat'), chatController.moderateMessage);
router.delete('/messages/:id', verifyPermission('faculty_academics', 'moderate_chat'), chatController.deleteMessage);
router.post('/messages/:id/vote', chatController.votePoll);
router.get('/channels/:id/settings', chatController.getChannelSettings);
router.put('/channels/:id/settings', verifyPermission('faculty_academics', 'moderate_chat'), chatController.updateChannelSettings);
router.post('/channels/:id/scheduled', chatController.createScheduledMessage);
router.get('/channels/:id/scheduled', chatController.listScheduledMessages);

module.exports = router;
