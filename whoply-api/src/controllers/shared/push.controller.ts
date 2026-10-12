/**
 * Phone notifications: a device signs up, signs off, or asks for a test.
 * Sending happens in services/push.service.ts.
 */
import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import PushSubscription from '../../models/PushSubscription.js';
import { pushConfig, sendPush } from '../../services/push.service.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** One login keeps at most this many devices; the oldest make room. */
const MAX_DEVICES = 10;

/**
 * The API will POST to the address a browser gives us, so it must be a real
 * push service — never an address of the caller's choosing (that would let a
 * login make the server call any machine it can reach).
 */
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/i;
const isPushService = (endpoint: string): boolean => {
    try {
        const u = new URL(endpoint);
        return u.protocol === 'https:' && !u.username && !u.port && PUSH_HOSTS.test(u.hostname);
    } catch { return false; }
};

const b64url = (min: number, max: number) => z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(min).max(max);
const subscribeSchema = z.object({
    subscription: z.object({
        endpoint: z.string().max(1000),
        keys: z.object({ p256dh: b64url(80, 100), auth: b64url(16, 32) }),
    }),
});

/** GET /push/config — is it switched on here, and the public key a device needs to sign up */
export const getPushConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
    const config = pushConfig();
    const devices = config.enabled ? await PushSubscription.countDocuments({ userId: req.user!._id }) : 0;
    sendSuccess(res, { ...config, devices });
});

/** POST /push/subscribe { subscription } — this device wants notifications for this login */
export const subscribePush = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!pushConfig().enabled) throw AppError.badRequest('Phone notifications are not switched on yet');
    const { subscription } = subscribeSchema.parse(req.body);
    if (!isPushService(subscription.endpoint)) throw AppError.badRequest('This browser’s notification service is not supported');
    // The same device signing in as someone else moves over to them.
    await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        { $set: { userId: req.user!._id, businessId: req.user!.businessId, keys: subscription.keys, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const extra = await PushSubscription.find({ userId: req.user!._id }).sort({ updatedAt: -1 }).skip(MAX_DEVICES).select('_id').lean();
    if (extra.length) await PushSubscription.deleteMany({ _id: { $in: extra.map((x) => x._id) } });
    sendSuccess(res, { ok: true }, 'Notifications are on for this device');
});

/** POST /push/unsubscribe { endpoint } — this device no longer wants them (also called on log out) */
export const unsubscribePush = asyncHandler(async (req: AuthRequest, res: Response) => {
    const endpoint = typeof req.body.endpoint === 'string' ? req.body.endpoint : '';
    if (endpoint) await PushSubscription.deleteOne({ endpoint, userId: req.user!._id });
    sendSuccess(res, { ok: true });
});

/** POST /push/test — a test notification to this login's own devices */
export const testPush = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!pushConfig().enabled) throw AppError.badRequest('Phone notifications are not switched on yet');
    const subs = await PushSubscription.find({ userId: req.user!._id }).select('endpoint keys').lean();
    if (!subs.length) throw AppError.badRequest('Turn notifications on for this device first');
    const sent = await sendPush(subs, { title: '🔔 Whoply notifications are on', body: 'This is how reminders and alerts will reach this device.', url: '/notifications', tag: 'whoply-test' });
    sendSuccess(res, { sent, devices: subs.length });
});
