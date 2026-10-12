import { api } from './api';

/**
 * Phone notifications (Web Push) for this device.
 *
 * - `unsupported`  this browser can't do it, or the app isn't running from its
 *                  installed / live build (the service worker is what receives
 *                  a push; a dev server has none)
 * - `off-server`   the Whoply server has no push keys yet — nothing to offer
 * - `blocked`      the person said "Block" in the browser; only they can undo it
 * - `off` / `on`   can be switched here
 */
export type PushState = 'unsupported' | 'off-server' | 'blocked' | 'off' | 'on';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** The push service wants the server's public key as bytes, not as text. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
    const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

export async function pushState(): Promise<{ state: PushState; publicKey: string }> {
    if (!supported()) return { state: 'unsupported', publicKey: '' };
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { state: 'unsupported', publicKey: '' };
    const cfg = (await api.get('/push/config')).data.data as { enabled: boolean; publicKey: string };
    if (!cfg.enabled) return { state: 'off-server', publicKey: '' };
    if (Notification.permission === 'denied') return { state: 'blocked', publicKey: cfg.publicKey };
    const sub = await reg.pushManager.getSubscription();
    return { state: sub && Notification.permission === 'granted' ? 'on' : 'off', publicKey: cfg.publicKey };
}

/** Ask the person, sign this device up at the browser's push service, and tell the API. */
export async function enablePush(publicKey: string): Promise<PushState> {
    if (!supported()) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'unsupported';
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    await api.post('/push/subscribe', { subscription: sub.toJSON() });
    return 'on';
}

/** Stop notifications on this device (also done on log out, so the next login doesn't get the last one's). */
export async function disablePush(): Promise<void> {
    if (!supported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => { /* the device side still goes */ });
    await sub.unsubscribe().catch(() => { /* already gone */ });
}

/** A device that is signed up tells the API again on every app start — cheap, and it heals a lost record. */
export async function syncPush(): Promise<void> {
    if (!supported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api.post('/push/subscribe', { subscription: sub.toJSON() }).catch(() => { /* off on the server, or offline */ });
}

export const sendTestPush = async (): Promise<{ sent: number; devices: number }> => (await api.post('/push/test')).data.data;

/**
 * A short two-note chime for a new notification while the app is open. (A
 * push on a closed app rings with the phone's own notification sound — a web
 * app can't choose that one.) Browsers stay silent until the person has
 * touched the page once; that is fine, it simply doesn't play.
 */
export function chime(): void {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx || document.visibilityState !== 'visible') return;
        const ctx = new Ctx();
        void ctx.resume();
        const t0 = ctx.currentTime;
        [[880, 0], [1320, 0.16]].forEach(([freq, at]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t0 + at);
            gain.gain.exponentialRampToValueAtTime(0.22, t0 + at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.32);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t0 + at);
            osc.stop(t0 + at + 0.34);
        });
        setTimeout(() => void ctx.close().catch(() => {}), 900);
    } catch { /* no sound is not a problem */ }
}
