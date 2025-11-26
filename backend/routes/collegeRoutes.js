const express = require('express');
const router = express.Router();

const collegeController = require('../controllers/collegeController');
const authMiddleware = require('../middleware/auth');

// All routes require admin authentication
router.use(authMiddleware);

// College CRUD operations
router.get('/', collegeController.getColleges);
router.post('/', collegeController.createCollege);
router.get('/:collegeId', collegeController.getCollege);
router.put('/:collegeId', collegeController.updateCollege);
router.delete('/:collegeId', collegeController.deleteCollege);

// College courses
router.get('/:collegeId/courses', collegeController.getCollegeCourses);

// Preview affected students
router.get('/:collegeId/affected-students', collegeController.getAffectedStudentsByCollege);

module.exports = router;

