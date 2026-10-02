import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import {
    listBusinesses,
    createBusiness,
    businessDetail,
    updateBusiness,
    deleteBusiness,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
} from '../../controllers/admin/admin.controller.js';
import { platformStats } from '../../controllers/admin/stats.controller.js';
import { listUsers, createUser, updateUser, deleteUser } from '../../controllers/admin/users.controller.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', platformStats);

// Businesses
router.get('/businesses', listBusinesses);
router.post('/businesses', createBusiness);
router.get('/businesses/:id', businessDetail);
router.patch('/businesses/:id', updateBusiness);
router.delete('/businesses/:id', deleteBusiness);

// Users (logins across every business)
router.get('/users', listUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Plans / subscriptions
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

export default router;
