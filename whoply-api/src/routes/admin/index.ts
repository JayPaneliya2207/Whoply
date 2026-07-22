import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import {
    platformStats,
    listBusinesses,
    createBusiness,
    businessDetail,
    updateBusiness,
    deleteBusiness,
    listUsers,
    updateUser,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
} from '../../controllers/admin/admin.controller.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', platformStats);

// Businesses
router.get('/businesses', listBusinesses);
router.post('/businesses', createBusiness);
router.get('/businesses/:id', businessDetail);
router.patch('/businesses/:id', updateBusiness);
router.delete('/businesses/:id', deleteBusiness);

// Users
router.get('/users', listUsers);
router.patch('/users/:id', updateUser);

// Plans / subscriptions
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

export default router;
