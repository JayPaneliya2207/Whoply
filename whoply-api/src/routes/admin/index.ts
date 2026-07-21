import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { platformStats, listBusinesses, listUsers, updateBusiness } from '../../controllers/admin/admin.controller.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', platformStats);
router.get('/businesses', listBusinesses);
router.patch('/businesses/:id', updateBusiness);
router.get('/users', listUsers);

export default router;
