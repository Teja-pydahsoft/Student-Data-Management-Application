/**
 * Faculty Management Routes (Pydah v2.0)
 * Admin: list faculty, get faculty by id, assign subjects.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attachUserScope, verifyPermission } = require('../middleware/rbac');
const facultyController = require('../controllers/facultyController');

router.use(authMiddleware);
router.use(attachUserScope);

router.get(
  '/',
  verifyPermission('faculty_management', 'view'),
  facultyController.getFaculty
);

router.get(
  '/employees',
  verifyPermission('faculty_management', 'view'),
  facultyController.getEmployees
);

router.post(
  '/assign-hod',
  verifyPermission('faculty_management', 'view'),
  facultyController.assignHod
);

router.get(
  '/branches/:branchId/year-sem-subjects',
  verifyPermission('faculty_management', 'view'),
  facultyController.getBranchYearSemSubjects
);
router.post(
  '/branches/:branchId/year-sem-subjects',
  verifyPermission('faculty_management', 'view'),
  facultyController.addBranchSemesterSubject
);
router.delete(
  '/branches/:branchId/year-sem-subjects',
  verifyPermission('faculty_management', 'view'),
  facultyController.removeBranchSemesterSubject
);

router.get(
  '/:id',
  verifyPermission('faculty_management', 'view'),
  facultyController.getFacultyById
);

router.put(
  '/:id/subjects',
  verifyPermission('faculty_management', 'assign_subjects'),
  facultyController.assignSubjects
);

module.exports = router;
