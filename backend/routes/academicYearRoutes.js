const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYearController');
const authMiddleware = require('../middleware/auth');

// Public route for forms (no auth required)
router.get('/public', academicYearController.getPublicActiveAcademicYears);

// Get all academic years (admin only)
router.get('/', authMiddleware, academicYearController.getAcademicYears);

// Get only active academic years (for student forms - admin only)
router.get('/active', authMiddleware, academicYearController.getActiveAcademicYears);

// Create new academic year
router.post('/', authMiddleware, academicYearController.createAcademicYear);

// Update academic year
router.put('/:yearId', authMiddleware, academicYearController.updateAcademicYear);

// Delete academic year
router.delete('/:yearId', authMiddleware, academicYearController.deleteAcademicYear);

module.exports = router;

