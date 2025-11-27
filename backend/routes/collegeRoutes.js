const express = require('express');
const router = express.Router();

const collegeController = require('../controllers/collegeController');
const authMiddleware = require('../middleware/auth');
const { attachUserScope } = require('../middleware/rbac');

// Public route for forms (no auth required) - must be BEFORE auth middleware
router.get('/public', collegeController.getPublicColleges);

// All routes below require admin authentication
router.use(authMiddleware);

// College CRUD operations - with scope filtering for list
router.get('/', attachUserScope, collegeController.getColleges);
router.post('/', collegeController.createCollege);
router.get('/:collegeId', collegeController.getCollege);
router.put('/:collegeId', collegeController.updateCollege);
router.delete('/:collegeId', collegeController.deleteCollege);

// College courses - with scope filtering
router.get('/:collegeId/courses', attachUserScope, collegeController.getCollegeCourses);

// Preview affected students
router.get('/:collegeId/affected-students', collegeController.getAffectedStudentsByCollege);

module.exports = router;
