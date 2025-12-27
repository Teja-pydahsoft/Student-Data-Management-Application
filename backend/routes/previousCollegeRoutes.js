const express = require('express');
const router = express.Router();
const previousCollegeController = require('../controllers/previousCollegeController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/', previousCollegeController.getAllPreviousColleges);
router.post('/', previousCollegeController.addPreviousCollege);
router.post('/bulk', upload.single('file'), previousCollegeController.bulkAddPreviousColleges);

module.exports = router;
