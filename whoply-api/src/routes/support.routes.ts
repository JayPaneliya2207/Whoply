import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePerm } from '../middleware/role.middleware.js';
import { myChat, sendMessage, unreadCount } from '../controllers/shared/support.controller.js';

// The owner and the manager talk to Whoply support for the business.
const router = Router();
router.use(authenticate, requirePerm('support.chat'));

router.get('/', myChat);
router.get('/unread', unreadCount);
router.post('/messages', sendMessage);

export default router;
