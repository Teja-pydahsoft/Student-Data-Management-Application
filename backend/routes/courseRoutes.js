const express = require('express');
const router = express.Router();

const courseController = require('../controllers/courseController');
const authMiddleware = require('../middleware/auth');

// Public configuration route (used by forms and public consumers)
router.get('/options', courseController.getCourseOptions);

// All routes below require admin authentication
router.use(authMiddleware);

router.get('/', courseController.getCourses);
router.post('/', courseController.createCourse);
router.put('/:courseId', courseController.updateCourse);
router.delete('/:courseId', courseController.deleteCourse);

router.get('/:courseId/branches', courseController.getBranches);
router.post('/:courseId/branches', courseController.createBranch);
router.put('/:courseId/branches/:branchId', courseController.updateBranch);
router.delete('/:courseId/branches/:branchId', courseController.deleteBranch);

module.exports = router;

