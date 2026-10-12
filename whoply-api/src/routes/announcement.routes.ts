import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { activeAnnouncements } from '../controllers/shared/announcement.controller.js';

// Popups from the Whoply team, for any signed-in login (the controller decides which ones it gets).
const router = Router();
router.use(authenticate);

router.get('/', activeAnnouncements);

export default router;
