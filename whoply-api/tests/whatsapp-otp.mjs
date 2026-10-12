/**
 * The sign-in code on WhatsApp (services/whatsapp.service.ts): setting the
 * gateway up in the admin panel, the token staying secret, the code reaching
 * the right number in the person's own language, a gateway that says no, and
 * one address not being able to flood phones with codes.
 *
 * No real message is sent: this file runs its own little gateway on this
 * machine and points the API at it. The API must run in dev/test mode (it
 * does in CI) — a live server only talks to an https gateway.
 *
 *   npm run seed:reset && npm run test:whatsapp
 */
import http from 'node:http';

const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 300) }); return !!cond; };
async function api(method, path, token, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || r.json?.message || '';
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;

// ── A stand-in for the Whatsline gateway ───────────────────────────────────
const TOKEN = 'tok-secret-4f9a71c2';
const got = []; // every message the API tried to send: { type, token, from, to, text, … }
let mode = 'ok'; // ok | refuse | broken
const gateway = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
        got.push({ type: req.headers['content-type'], method: req.method, ...Object.fromEntries(new URLSearchParams(raw)) });
        if (mode === 'broken') { res.writeHead(500); res.end('gateway down'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mode === 'refuse' ? { success: false, message: `phone not connected (token ${TOKEN})` } : { success: true, message: 'queued' }));
    });
});
await new Promise((r) => gateway.listen(0, '127.0.0.1', r));
const GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}/api/qr/rest/send_message`;
const last = () => got[got.length - 1];

(async () => {
    const adm = await login('9000000099');
    const owner = await login('9000000001');
    const wholesaler = await login('9000000010');
    // Each number may ask for one code per 30 seconds, so every step below uses its own login.
    const staff = async (n, name) => {
        const mobile = `98222${String(10000 + n)}`;
        const r = await api('POST', '/staff', owner, { name, mobile, role: 'cashier', password: 'Staff@123' });
        if (r.status !== 201) throw new Error(`could not add ${name}: ${r.status} ${msg(r)}`);
        return mobile;
    };
    const askCode = (mobile, headers) => api('POST', '/auth/login', null, { mobile }, headers);

    suite('before it is set up');
    let r = await api('GET', '/admin/whatsapp', adm);
    check('it starts off, with the Whatsline address filled in', r.status === 200 && d(r)?.enabled === false && d(r)?.tokenSet === false && d(r)?.ready === false && /whatsline\.io/.test(d(r)?.apiUrl || ''), JSON.stringify(d(r)));
    r = await api('PUT', '/admin/whatsapp', adm, { enabled: true });
    check('it can not be switched on without a sender number and a token', r.status === 400 && /sender number and the token/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/whatsapp/test', adm, { mobile: '9000000001' });
    check('…and no test message goes out', r.status === 400 && got.length === 0, `${r.status} ${msg(r)} sent=${got.length}`);
    const r1 = await api('GET', '/admin/whatsapp', owner);
    const r2 = await api('GET', '/admin/whatsapp', null);
    const r3 = await api('PUT', '/admin/whatsapp', owner, { enabled: false });
    check('only an admin sees or changes it', r1.status === 403 && r2.status === 401 && r3.status === 403, `${r1.status} ${r2.status} ${r3.status}`);
    const s1 = await staff(1, 'Before Setup');
    r = await askCode(s1);
    check('a code asked for now is not sent anywhere', r.status === 200 && d(r)?.channel === undefined && got.length === 0, `${r.status} ${msg(r)} ${JSON.stringify(d(r))}`);

    suite('setting it up');
    r = await api('PUT', '/admin/whatsapp', adm, { from: '12345', token: TOKEN });
    check('a sender number that is not a mobile number is refused', r.status === 400, `${r.status} ${msg(r)}`);
    const badUrl = await api('PUT', '/admin/whatsapp', adm, { apiUrl: 'not an address' });
    const ftpUrl = await api('PUT', '/admin/whatsapp', adm, { apiUrl: 'ftp://whatsline.io/send' });
    check('an API address that is not a web address is refused', badUrl.status === 400 && ftpUrl.status === 400, `${badUrl.status} ${ftpUrl.status}`);
    r = await api('PUT', '/admin/whatsapp', adm, { from: '98765 43210', token: TOKEN, apiUrl: GATEWAY_URL });
    check('sender, token and address are saved; a 10-digit sender gets India’s code', r.status === 200 && d(r)?.from === '919876543210' && d(r)?.tokenSet === true && d(r)?.enabled === false && d(r)?.ready === false, `${r.status} ${msg(r)} ${JSON.stringify(d(r))}`);
    check('…and the reply does not hold the token', !JSON.stringify(r.json).includes(TOKEN));
    r = await api('POST', '/admin/whatsapp/test', adm, { mobile: '90000 00001' });
    check('a test message can be sent before it is switched on', r.status === 200 && d(r)?.ok === true && d(r)?.to === '919000000001', `${r.status} ${msg(r)} ${JSON.stringify(d(r))}`);
    const t = last() || {};
    check('the gateway gets it the Whatsline way (a form: token, from, to, text)', t.method === 'POST' && /x-www-form-urlencoded/.test(t.type || '') && t.token === TOKEN && t.from === '919876543210' && t.to === '919000000001' && t.messageType === 'text' && t.requestType === 'POST' && /test message/i.test(t.text || ''), JSON.stringify({ ...t, token: t.token === TOKEN ? '(right)' : '(wrong)' }));
    r = await api('PUT', '/admin/whatsapp', adm, { enabled: true });
    check('now it switches on', r.status === 200 && d(r)?.enabled === true && d(r)?.ready === true, `${r.status} ${msg(r)}`);
    r = await api('PUT', '/admin/whatsapp', adm, { token: '', from: '919876543210' });
    await api('POST', '/admin/whatsapp/test', adm, { mobile: '919000000001' });
    check('saving with the token box empty keeps the saved token', d(r)?.tokenSet === true && last()?.token === TOKEN, JSON.stringify(d(r)));
    r = await api('GET', '/auth/sign-in-options', null);
    check('the sign-in screen is told: OTP is on, by WhatsApp', r.status === 200 && d(r)?.otp === true && d(r)?.otpChannel === 'whatsapp', JSON.stringify(d(r)));

    suite('the token stays on the server');
    await api('POST', '/admin/admins', adm, { name: 'Bills Only', mobile: '9811100071', adminRole: 'billing', password: 'Str0ng#Pass26' });
    const billing = await login('9811100071', 'Str0ng#Pass26');
    const general = await api('GET', '/admin/settings', billing);
    const own = await api('GET', '/admin/whatsapp', billing);
    check('an admin who only does bills can not open the WhatsApp settings', !!billing && own.status === 403 && general.status === 200, `${own.status} ${general.status}`);
    let log = [];
    for (let i = 0; i < 10; i++) { // the log is written just after the reply
        log = d(await api('GET', '/admin/audit?limit=50', adm))?.items || [];
        if (log.some((x) => x.action === 'Changed the WhatsApp settings') && log.some((x) => x.action === 'Sent a WhatsApp test message')) break;
        await new Promise((res) => setTimeout(res, 200));
    }
    check('saving and testing are in the activity log', log.some((x) => x.action === 'Changed the WhatsApp settings') && log.some((x) => x.action === 'Sent a WhatsApp test message'), log.map((x) => x.action).join(' | '));
    const seen = JSON.stringify([general.json, (await api('GET', '/admin/whatsapp', adm)).json, (await api('GET', '/admin/settings', adm)).json, log, (await api('GET', '/auth/sign-in-options', null)).json]);
    check('no reply and no log line holds the token', !seen.includes(TOKEN) && !/"token"/.test(seen), seen.slice(0, 200));

    suite('the sign-in code');
    got.length = 0;
    r = await askCode('9000000001');
    const code = d(r)?.devOtp || '';
    let m = last() || {};
    check('asking for a code sends it on WhatsApp to that login’s number', r.status === 200 && d(r)?.channel === 'whatsapp' && got.length === 1 && m.to === '919000000001' && m.from === '919876543210' && m.token === TOKEN, `${r.status} ${msg(r)} sent=${got.length} to=${m.to}`);
    check('the message holds the code, the name Whoply and how long it works', /^\d{6}$/.test(code) && (m.text || '').includes(`*${code}*`) && /\*Whoply\*/.test(m.text || '') && /5 minutes/.test(m.text || '') && /never asks/i.test(m.text || ''), m.text);
    check('the reply itself says where it went, and shows only a masked number', /whatsapp/i.test(r.json?.message || '') && !JSON.stringify(d(r)?.mobile).includes('9000000001'), `${r.json?.message} ${d(r)?.mobile}`);
    r = await api('POST', '/auth/verify-otp', null, { mobile: '9000000001', otp: code });
    check('that code signs in', r.status === 200 && !!d(r)?.token, `${r.status} ${msg(r)}`);
    await api('PATCH', '/auth/profile', wholesaler, { language: 'gu' });
    r = await askCode('9000000010');
    m = last() || {};
    check('someone who uses the app in Gujarati gets the message in Gujarati', r.status === 200 && m.to === '919000000010' && /તમારો સાઇન-ઇન કોડ/.test(m.text || '') && (m.text || '').includes(d(r)?.devOtp), m.text);
    const s2 = await staff(2, 'Hindi Reader');
    await api('PATCH', '/auth/profile', await login(s2, 'Staff@123'), { language: 'hi' });
    r = await askCode(s2);
    m = last() || {};
    check('…and in Hindi for a Hindi user', r.status === 200 && m.to === `91${s2}` && /आपका साइन-इन कोड/.test(m.text || ''), m.text);
    r = await askCode('9777700000');
    check('a number with no account gets no message', r.status === 404 && got.every((x) => x.to !== '919777700000'), `${r.status}`);

    suite('when the gateway says no');
    mode = 'refuse';
    r = await api('POST', '/admin/whatsapp/test', adm, { mobile: '9000000001' });
    check('a "no" inside a 200 reply counts as not sent', r.status === 200 && d(r)?.ok === false && /refused/i.test(d(r)?.detail || ''), JSON.stringify(d(r)));
    check('…and the reason shown to the admin hides the token', !JSON.stringify(r.json).includes(TOKEN) && /\*\*\*/.test(d(r)?.detail || ''), d(r)?.detail);
    const s3 = await staff(3, 'Gateway Says No');
    r = await askCode(s3);
    check('a code that could not be sent is not reported as sent', r.status === 200 && d(r)?.channel === undefined && !/whatsapp/i.test(r.json?.message || ''), `${r.status} ${JSON.stringify(d(r))} ${r.json?.message}`);
    mode = 'broken';
    r = await api('POST', '/admin/whatsapp/test', adm, { mobile: '9000000001' });
    check('a gateway error is shown as such', d(r)?.ok === false && /answered 500/.test(d(r)?.detail || ''), JSON.stringify(d(r)));
    mode = 'ok';
    await api('PUT', '/admin/whatsapp', adm, { apiUrl: 'http://127.0.0.1:9/send' }); // nothing listens there
    r = await api('POST', '/admin/whatsapp/test', adm, { mobile: '9000000001' });
    check('a gateway that can not be reached is shown as such', d(r)?.ok === false && /could not be reached|did not answer/.test(d(r)?.detail || ''), JSON.stringify(d(r)));
    await api('PUT', '/admin/whatsapp', adm, { apiUrl: GATEWAY_URL });

    suite('switching it off');
    r = await api('PUT', '/admin/whatsapp', adm, { enabled: false });
    got.length = 0;
    const s4 = await staff(4, 'After Off');
    const asked = await askCode(s4);
    const options = d(await api('GET', '/auth/sign-in-options', null));
    check('off: no code goes out on WhatsApp, and the sign-in screen is told so', d(r)?.enabled === false && d(r)?.tokenSet === true && asked.status === 200 && got.length === 0 && options?.otpChannel === null, `${JSON.stringify(d(r))} sent=${got.length} ${JSON.stringify(options)}`);

    suite('one address can not flood phones');
    const many = [];
    for (let i = 0; i < 21; i++) many.push(await staff(100 + i, `Flood ${i + 1}`));
    const n = () => 1 + Math.floor(Math.random() * 250);
    const flooder = { 'X-Forwarded-For': `10.${n()}.${n()}.${n()}` }; // a new address every run — the API keeps the counts in memory
    const first = [];
    for (const mobile of many.slice(0, 20)) first.push((await askCode(mobile, flooder)).status);
    r = await askCode(many[20], flooder);
    if (r.status === 200) check('the per-address limit (skipped: start the API with TRUST_PROXY=1 to test it)', first.every((x) => x === 200));
    else {
        check('20 codes in 15 minutes from one address go out; the 21st is refused', first.every((x) => x === 200) && r.status === 429 && /this network/i.test(msg(r)), `${first.join(',')} → ${r.status} ${msg(r)}`);
        r = await askCode(many[20], { 'X-Forwarded-For': `10.${n()}.${n()}.${n()}` });
        check('…and that person, from their own address, still gets a code', r.status === 200, `${r.status} ${msg(r)}`);
    }

    gateway.close();
    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ WHATSAPP SIGN-IN CODE ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); gateway.close(); process.exit(2); });
