import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole, requirePerm } from '../middleware/role.middleware.js';
import { listStaff, createStaff, updateStaff, deleteStaff, staffDetail } from '../controllers/shared/staff.controller.js';

const router = Router();
// Staff logins and salaries are the owner's; a manager may only open a sales rep's detail.
router.use(authenticate, requireRole('owner', 'manager'));

router.get('/:id/detail', requirePerm('staff.manage', 'team.view'), staffDetail);
router.use(requirePerm('staff.manage'));
router.get('/', listStaff);
router.post('/', createStaff);
router.patch('/:id', updateStaff);
router.delete('/:id', deleteStaff);

export default router;
