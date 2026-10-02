import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { mySubscription, claimPaid } from '../controllers/shared/subscription.controller.js';

// The plan and its bills are the owner's business — staff don't see what the shop pays Whoply.
const router = Router();
router.use(authenticate, requireRole('owner'));

router.get('/', mySubscription);
router.post('/bills/:id/claim', claimPaid);

export default router;
