/**
 * Phone notifications (Web Push): a device signs up with the address its
 * browser was given by a real push service, and only that. Without keys in
 * the environment the feature is simply off.
 *
 *   npm run seed:reset && npm run test:push
 *   (start the API with VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to test signing up — CI does)
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 240) }); return !!cond; };
async function api(method, path, token, body) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;
// What a browser hands over: an address at its push service and two keys (these are made up, nothing is sent to them).
const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const sub = (endpoint) => ({ subscription: { endpoint, keys: KEYS } });
const FCM = (id) => `https://fcm.googleapis.com/fcm/send/${id}`;

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');

    suite('sign-in needed');
    let r = await api('GET', '/push/config', null);
    check('nobody reads the push settings without a login', r.status === 401, `${r.status}`);
    r = await api('POST', '/push/subscribe', null, sub(FCM('anon')));
    check('…or signs a device up', r.status === 401, `${r.status}`);

    r = await api('GET', '/push/config', st);
    const on = d(r)?.enabled === true;
    if (!on) {
        suite('switched off (no keys on this server)');
        check('the app is told it is off, with no key', r.status === 200 && d(r)?.enabled === false && d(r)?.publicKey === '', JSON.stringify(d(r)));
        r = await api('POST', '/push/subscribe', st, sub(FCM('device-1')));
        check('signing up is refused with a clear message', r.status === 400 && /not switched on/i.test(msg(r)), `${r.status} ${msg(r)}`);
        r = await api('POST', '/push/test', st);
        check('…and so is a test', r.status === 400, `${r.status} ${msg(r)}`);
        r = await api('POST', '/push/unsubscribe', st, { endpoint: FCM('device-1') });
        check('signing off is always fine', r.status === 200, `${r.status}`);
        console.log('   (sign-up checks skipped: start the API with VAPID keys to run them)');
    } else {
        suite('a device signs up');
        check('the app gets the public key', typeof d(r)?.publicKey === 'string' && d(r).publicKey.length > 80 && d(r)?.devices === 0, JSON.stringify(d(r)));
        r = await api('POST', '/push/subscribe', st, sub(FCM('device-1')));
        check('a phone signs up', r.status === 200, `${r.status} ${msg(r)}`);
        r = await api('POST', '/push/subscribe', st, sub(FCM('device-1')));
        check('signing up twice keeps one device', r.status === 200 && d(await api('GET', '/push/config', st))?.devices === 1, `${r.status}`);
        r = await api('POST', '/push/subscribe', st, sub('https://updates.push.services.mozilla.com/wpush/v2/abc'));
        check('a second browser (Firefox) signs up too', r.status === 200 && d(await api('GET', '/push/config', st))?.devices === 2, `${r.status} ${msg(r)}`);

        suite('only real push services');
        for (const [label, endpoint] of [
            ['the server’s own machine', 'https://localhost:7000/api/admin/users'],
            ['a private network address', 'https://10.0.0.5/steal'],
            ['plain http', 'http://fcm.googleapis.com/fcm/send/x'],
            ['a look-alike host', 'https://fcm.googleapis.com.evil.example/fcm/send/x'],
            ['a host hidden behind a login part', 'https://fcm.googleapis.com@evil.example/x'],
            ['another port', 'https://fcm.googleapis.com:8443/fcm/send/x'],
            ['not an address at all', 'push-me'],
        ]) {
            r = await api('POST', '/push/subscribe', st, sub(endpoint));
            check(`refused: ${label}`, r.status === 400, `${r.status} ${msg(r)}`);
        }
        r = await api('POST', '/push/subscribe', st, { subscription: { endpoint: FCM('device-9'), keys: { p256dh: 'short', auth: KEYS.auth } } });
        check('refused: keys that are not keys', r.status === 400, `${r.status} ${msg(r)}`);
        r = await api('POST', '/push/subscribe', st, { subscription: { endpoint: { $ne: '' }, keys: KEYS } });
        check('refused: an object where the address should be', r.status === 400, `${r.status} ${msg(r)}`);
        check('none of those was saved', d(await api('GET', '/push/config', st))?.devices === 2, '');

        suite('each login has its own devices');
        check('another business starts with none', d(await api('GET', '/push/config', ws))?.devices === 0, '');
        r = await api('POST', '/push/unsubscribe', ws, { endpoint: FCM('device-1') });
        check('one login can not sign another’s device off', r.status === 200 && d(await api('GET', '/push/config', st))?.devices === 2, `${r.status}`);
        r = await api('POST', '/push/subscribe', ws, sub(FCM('device-1')));
        check('the same phone signing in as someone else moves over to them', r.status === 200 && d(await api('GET', '/push/config', ws))?.devices === 1 && d(await api('GET', '/push/config', st))?.devices === 1, `${r.status}`);
        r = await api('POST', '/push/unsubscribe', ws, { endpoint: FCM('device-1') });
        check('a login signs its own device off', r.status === 200 && d(await api('GET', '/push/config', ws))?.devices === 0, `${r.status}`);
        for (let i = 0; i < 12; i++) await api('POST', '/push/subscribe', ws, sub(FCM(`many-${i}`)));
        check('one login keeps at most 10 devices', d(await api('GET', '/push/config', ws))?.devices === 10, `${d(await api('GET', '/push/config', ws))?.devices}`);

        suite('nothing breaks when a notification is made');
        // A support reply creates a notification, which is pushed to the owner's (made-up) devices:
        // the push service refuses them, and the request must still succeed.
        const adm = await login('9000000099');
        await api('POST', '/support/messages', st, { text: 'Please call me about notifications.' });
        const thread = d(await api('GET', '/admin/support/threads', adm))?.items?.[0];
        r = await api('POST', `/admin/support/threads/${thread?._id}/messages`, adm, { text: 'Calling you in five minutes.' });
        check('the reply is saved even though the push can not be delivered', r.status < 300, `${r.status} ${msg(r)}`);
        r = await api('GET', '/shopkeeper/notifications', st);
        check('…and the notification is in the app', (d(r)?.items || []).some((n) => n.type === 'support'), JSON.stringify((d(r)?.items || []).map((n) => n.type)));
    }

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ PHONE NOTIFICATIONS ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
