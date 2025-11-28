const express = require('express');
const router = express.Router();
const semesterController = require('../controllers/semesterController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Semester CRUD operations
router.get('/', semesterController.getSemesters);
router.get('/:semesterId', semesterController.getSemester);
router.post('/', semesterController.createSemester);
router.put('/:semesterId', semesterController.updateSemester);
router.delete('/:semesterId', semesterController.deleteSemester);

module.exports = router;

