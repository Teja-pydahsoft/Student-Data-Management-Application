const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { verifyPermission, attachUserScope } = require('../middleware/rbac');
const { MODULES } = require('../constants/rbac');
const serviceController = require('../controllers/serviceController');

// All routes require authentication
router.use(authMiddleware);

// --- Services Configuration (Admin) ---
// View all services: permission 'view'
router.get('/', verifyPermission(MODULES.SERVICES, 'view'), serviceController.getServices);

// Create service: permission 'manage_config'
router.post('/', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.createService);

// Update service: permission 'manage_config'
router.put('/:id', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.updateService);

// Delete/Deactivate service: permission 'manage_config'
router.delete('/:id', verifyPermission(MODULES.SERVICES, 'manage_config'), serviceController.deleteService);


// --- Service Requests ---

// Student Request (Student Role Only) - Keeping as is or could be permission based if students had RBAC
// Currently students are handled by role check in controller or middleware, assuming simplified role check for now check controller
// Student Request (Student Role Only)
router.post('/requests', serviceController.requestService);

// Get Service Requests (Student sees own, Admin sees all with permission)
router.get('/requests', (req, res, next) => {
    // If student, allow access
    if (req.user && req.user.role === 'student') {
        return next();
    }
    // If admin/staff, check permission and attach scope
    const middleware = [verifyPermission(MODULES.SERVICES, 'view'), attachUserScope];
    // Execute middleware chain manually or simplify route structure
    // Since we are inside a handler, better to just call them sequentially or restructure
    // BUT since we are in a callback, we can't easily chain standard middleware.
    // Better approach: Define the route with middleware array at routing level.

    // However, since we have conditional logic, we have to invoke them.
    // Let's rely on standard routing instead.

    return verifyPermission(MODULES.SERVICES, 'view')(req, res, () => {
        attachUserScope(req, res, next);
    });
}, serviceController.getServiceRequests);

// Update Request Status (Admin/Staff with permission)
router.put('/requests/:id/status', verifyPermission(MODULES.SERVICES, 'manage_requests'), serviceController.updateRequestStatus);

module.exports = router;
