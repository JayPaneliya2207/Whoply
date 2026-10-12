/**
 * Phone notifications (Web Push). Every notification the app already shows
 * under the bell is also pushed to the devices that asked for it, so it
 * arrives — with the phone's own notification sound — when Whoply is closed.
 *
 * Needs a VAPID key pair in the environment (`npm run push:keys` prints one).
 * Without it everything here is a quiet no-op and the app hides the switch.
 */
import webpush from 'web-push';
import { env } from '../config/env.js';
import PushSubscription, { type IPushSubscriptionDocument } from '../models/PushSubscription.js';
import User from '../models/User.js';
import { roleMaySee } from '../utils/notificationKinds.js';

let ready: boolean | null = null;

/** True once the keys are loaded; false (for good) if they are missing or broken. */
function setup(): boolean {
    if (ready !== null) return ready;
    ready = false;
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return ready;
    try {
        webpush.setVapidDetails(env.VAPID_SUBJECT || `mailto:push@${new URL(env.FRONT_URL).hostname}`, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
        ready = true;
    } catch (e) {
        console.warn('[push] VAPID keys are not valid — phone notifications are off:', (e as Error).message);
    }
    return ready;
}

/** What the app needs to subscribe a device. */
export const pushConfig = () => (setup() ? { enabled: true, publicKey: env.VAPID_PUBLIC_KEY! } : { enabled: false, publicKey: '' });

export interface PushPayload {
    title: string;
    body: string;
    url?: string; // where a tap takes the person, inside the app
    tag?: string; // a newer one with the same tag replaces the older on the phone
}

/** Send one message to these devices. A device that has gone (uninstalled, permission taken back) is forgotten. Returns how many were delivered to the push service. */
export async function sendPush(subs: Pick<IPushSubscriptionDocument, '_id' | 'endpoint' | 'keys'>[], payload: PushPayload): Promise<number> {
    if (!subs.length || !setup()) return 0;
    const body = JSON.stringify(payload);
    const gone: IPushSubscriptionDocument['_id'][] = [];
    let sent = 0;
    await Promise.all(
        subs.map(async (s) => {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 24 * 60 * 60, urgency: 'high' });
                sent++;
            } catch (e: any) {
                if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s._id);
                else console.warn(`[push] not delivered (${e?.statusCode || e?.code || 'error'})`);
            }
        })
    );
    if (gone.length) await PushSubscription.deleteMany({ _id: { $in: gone } }).catch(() => {});
    return sent;
}

const PAGE: Record<string, string> = { summary: '/dashboard', low_stock: '/products?lowStock=true', expiry: '/products', udhar: '/notifications', order: '/notifications', payable: '/purchases', subscription: '/subscription', support: '/support' };

/**
 * Push freshly saved notifications (called from the Notification model's own
 * hooks, so every place that creates one is covered). Each goes only to the
 * logins of that business whose role may read that kind.
 */
export async function pushNotifications(docs: { businessId?: unknown; type?: string; title?: string; body?: string }[]): Promise<void> {
    if (!docs.length || !setup()) return;
    const byBusiness = new Map<string, typeof docs>();
    for (const d of docs) {
        if (!d.businessId || !d.title) continue;
        const k = String(d.businessId);
        if (!byBusiness.has(k)) byBusiness.set(k, []);
        byBusiness.get(k)!.push(d);
    }
    for (const [businessId, list] of byBusiness) {
        const subs = await PushSubscription.find({ businessId }).select('userId endpoint keys').lean();
        if (!subs.length) continue;
        const users = await User.find({ _id: { $in: subs.map((s) => s.userId) }, isActive: true }).select('role').lean();
        const roleOf = new Map(users.map((u) => [String(u._id), u.role]));
        // A burst (the morning's payment reminders) becomes one line per kind, not twenty buzzes.
        const byKind = new Map<string, typeof docs>();
        for (const d of list) { const k = d.type || 'general'; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(d); }
        for (const [kind, group] of byKind) {
            const to = subs.filter((s) => { const role = roleOf.get(String(s.userId)); return !!role && roleMaySee(role as any, kind); });
            const first = group[0];
            await sendPush(to, {
                title: first.title!,
                body: group.length > 1 ? `${first.body || ''}\n+ ${group.length - 1} more` : first.body || '',
                url: PAGE[kind] || '/notifications',
                tag: `whoply-${kind}`,
            });
        }
    }
}
