import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getPushConfig, subscribePush, unsubscribePush, testPush } from '../controllers/shared/push.controller.js';

// Phone notifications for any signed-in login (what each role receives is decided when sending).
const router = Router();
router.use(authenticate);

router.get('/config', getPushConfig);
router.post('/subscribe', subscribePush);
router.post('/unsubscribe', unsubscribePush);
router.post('/test', testPush);

export default router;
