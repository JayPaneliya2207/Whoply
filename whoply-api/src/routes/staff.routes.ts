import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { listStaff, createStaff, updateStaff, deleteStaff, staffDetail } from '../controllers/shared/staff.controller.js';

const router = Router();
// Both shopkeeper and wholesaler owners/managers manage staff
router.use(authenticate, requireRole('owner', 'manager'));

router.get('/', listStaff);
router.post('/', createStaff);
router.get('/:id/detail', staffDetail);
router.patch('/:id', updateStaff);
router.delete('/:id', deleteStaff);

export default router;
