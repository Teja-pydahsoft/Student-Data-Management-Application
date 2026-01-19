const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/auth');

// Protect all routes
router.use(authMiddleware);

// Get all employees
router.get('/', employeeController.getEmployees);

// Get available users (not yet assigned as employees)
router.get('/available-users', employeeController.getAvailableUsers);

// Create new employee assignment
router.post('/', employeeController.createEmployee);

// Update employee role
router.put('/:id', employeeController.updateEmployee);

// Get employee history
router.get('/:id/history', employeeController.getEmployeeHistory);

// Delete employee (soft delete)
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
