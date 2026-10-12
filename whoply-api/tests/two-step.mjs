/**
 * Two-step sign-in for admin logins: after the password, a 6-digit code from
 * an authenticator app. Turning it on and off, signing in with a code or a
 * recovery code, a code working only once, a lost phone, and guessing.
 *
 * The codes here are made by this file's own few lines (RFC 4226 / 6238), not
 * by the API's code — so the API is checked against the standard, the way a
 * real authenticator app would.
 *
 *   npm run seed:reset && npm run test:twostep
 */
import { createHmac } from 'node:crypto';

const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 260) }); return !!cond; };
async function api(method, path, token, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const errCode = (r) => r.json?.error?.code || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── An authenticator app, in a few lines ───────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const unbase32 = (text) => {
    let bits = '';
    for (const ch of text) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
    const out = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(out);
};
const hotp = (key, counter) => {
    const c = Buffer.alloc(8);
    c.writeBigUInt64BE(BigInt(counter));
    const mac = createHmac('sha1', key).update(c).digest();
    return String((mac.readUInt32BE(mac[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0');
};
const STEP = 30_000;
/**
 * Codes for one secret, each from a later 30-second step than the one before
 * (a code works once, and so does everything before it). The API takes the
 * step now, the one before and the one after, so three come without waiting.
 */
function authenticator(secret) {
    const key = unbase32(secret);
    let used = 0;
    return {
        async next() {
            for (;;) {
                const now = Date.now();
                const current = Math.floor(now / STEP);
                const step = Math.max(used + 1, current - 1);
                if (step > current + 1) { await sleep(1000); continue; } // ahead of the clock: wait for it
                if (step === current - 1 && now % STEP > 27_000) { await sleep(STEP - (now % STEP) + 200); continue; } // about to be too old
                used = step;
                return hotp(key, step);
            }
        },
        last: () => hotp(key, used),
    };
}

const ADMIN = '9811100061';
const PASSWORD = 'Str0ng#Pass26';
const signIn = (code, headers) => api('POST', '/auth/admin-login', null, { mobile: ADMIN, password: PASSWORD, ...(code !== undefined && { code }) }, headers);

(async () => {
    suite('the code maths');
    const rfc = Buffer.from('12345678901234567890');
    const want = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
    check('this file makes the codes of the standard (RFC 4226)', want.every((code, i) => hotp(rfc, i) === code), want.map((_, i) => hotp(rfc, i)).join(' '));
    check('base32 reads back', unbase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString() === '12345678901234567890');

    const superTok = d(await api('POST', '/auth/admin-login', null, { mobile: '9000000099', password: 'whoply123' }))?.token;
    const owner = d(await api('POST', '/auth/password-login', null, { mobile: '9000000001', password: 'whoply123', code: '123456' }))?.token;
    let r = await api('POST', '/admin/admins', superTok, { name: 'Two Step Admin', mobile: ADMIN, adminRole: 'support', password: PASSWORD });
    if (r.status !== 201) throw new Error(`could not create the test admin: ${r.status} ${msg(r)}`);
    const adminId = d(r)._id;
    const a1 = d(await signIn())?.token;
    const a2 = d(await signIn())?.token;

    suite('turning it on');
    check('a shop login signs in as before (a code it sends is ignored)', !!owner);
    r = await api('GET', '/auth/two-step', a1);
    check('it starts off', r.status === 200 && d(r)?.on === false && d(r)?.recoveryLeft === 0, `${r.status} ${JSON.stringify(d(r))}`);
    r = await api('GET', '/auth/two-step', owner);
    const r2 = await api('POST', '/auth/two-step/start', owner, { password: 'whoply123' });
    check('it is for admin logins — a shop login is refused', r.status === 403 && r2.status === 403, `${r.status} ${r2.status}`);
    r = await api('POST', '/auth/two-step/start', null, { password: PASSWORD });
    check('nobody starts it without a login', r.status === 401, `${r.status}`);
    r = await api('POST', '/auth/two-step/start', a1, { password: 'not-my-password' });
    check('starting asks for the password again', r.status === 400 && /incorrect password/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/two-step/start', a1, { password: PASSWORD });
    const secret = d(r)?.secret || '';
    check('the right password gives a key and a link for the authenticator app', r.status === 200 && /^[A-Z2-7]{32}$/.test(secret) && String(d(r)?.url).startsWith('otpauth://totp/Whoply%20Admin%3A' + ADMIN) && d(r).url.includes(`secret=${secret}`), `${r.status} ${msg(r)} ${d(r)?.url}`);
    r = await signIn();
    check('until the code is confirmed, sign-in is as before', r.status === 200 && !!d(r)?.token && d(r)?.user?.twoStep === false, `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/two-step/confirm', a1, { code: '000000' });
    check('a wrong code does not turn it on', r.status === 400 && (await api('GET', '/auth/two-step', a1)).json?.data?.on === false, `${r.status} ${msg(r)}`);
    const app = authenticator(secret);
    r = await api('POST', '/auth/two-step/confirm', a1, { code: await app.next() });
    const recovery = d(r)?.recoveryCodes || [];
    check('the code from the app turns it on and gives 8 recovery codes', r.status === 200 && recovery.length === 8 && new Set(recovery).size === 8 && recovery.every((c) => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c)), `${r.status} ${msg(r)} ${recovery.join(' ')}`);
    r = await api('GET', '/auth/two-step', a1);
    check('it now says on, with 8 recovery codes left', d(r)?.on === true && d(r)?.recoveryLeft === 8 && !!d(r)?.since, JSON.stringify(d(r)));
    r = await api('GET', '/auth/me', a2);
    const mine = await api('GET', '/auth/me', a1);
    check('other devices signed in with the password alone are signed out; this one stays', r.status === 401 && mine.status === 200 && d(mine)?.user?.twoStep === true, `${r.status} ${mine.status} ${d(mine)?.user?.twoStep}`);
    r = await api('POST', '/auth/two-step/start', a1, { password: PASSWORD });
    check('it can not be set up twice', r.status === 409, `${r.status} ${msg(r)}`);

    suite('signing in');
    r = await signIn();
    check('the password alone no longer signs in — it asks for the code', r.status === 401 && errCode(r) === 'CODE_NEEDED' && !d(r)?.token, `${r.status} ${errCode(r)} ${msg(r)}`);
    r = await signIn('000000');
    check('a wrong code is refused and counted', r.status === 400 && /incorrect code — 4 tries left/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await signIn(app.last());
    check('the code used to turn it on does not work a second time', r.status === 400 && /already used/i.test(msg(r)), `${r.status} ${msg(r)}`);
    const code = await app.next();
    r = await signIn(code);
    const a3 = d(r)?.token;
    check('password + the next code signs in', r.status === 200 && !!a3 && d(r)?.user?.twoStep === true, `${r.status} ${msg(r)}`);
    r = await signIn(code);
    check('that code does not work again', r.status === 400 && /already used/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/admin-login', null, { mobile: ADMIN, password: 'not-my-password', code: recovery[7] });
    check('a wrong password is refused whatever the code', r.status === 400 && /incorrect password/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await signIn(recovery[0]);
    check('a recovery code signs in', r.status === 200 && !!d(r)?.token, `${r.status} ${msg(r)}`);
    r = await signIn(recovery[0]);
    check('…only once', r.status === 400 && /incorrect code/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await signIn(` ${recovery[1].replace('-', ' ').toUpperCase()} `);
    check('a recovery code typed in capitals, with a space for the dash, still works', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('GET', '/auth/two-step', a3);
    check('6 recovery codes are left (the one sent with a wrong password was not used up)', d(r)?.recoveryLeft === 6, JSON.stringify(d(r)));
    // An admin is not a user of the shop app: its doors (OTP, password) do not know the admin at all,
    // so there is no way round the code through them.
    const byOtp = await api('POST', '/auth/login', null, { mobile: ADMIN });
    const byPassword = await api('POST', '/auth/password-login', null, { mobile: ADMIN, password: PASSWORD, code: recovery[2] });
    check('the shop app’s sign-in (OTP or password) does not know the admin', byOtp.status === 404 && byPassword.status === 404 && !d(byPassword)?.token, `${byOtp.status} ${byPassword.status}`);

    suite('the key stays on the server');
    const admins = await api('GET', '/admin/admins', superTok);
    const seen = JSON.stringify([d(await api('GET', '/auth/me', a3)), d(admins), d(await api('GET', '/auth/two-step', a3)), d(await signIn(recovery[3]))]);
    check('no reply holds the key, the recovery codes or the stored fields', !seen.includes(secret) && !/twoFactor|"secret"|"recovery"|"pending"|lastStep/.test(seen) && !recovery.some((c) => seen.includes(c)), seen.slice(0, 200));

    suite('a lost phone');
    const row = (d(admins) || []).find((a) => a._id === adminId);
    const me = (d(admins) || []).find((a) => a.mobile === '9000000099');
    check('the admin list shows who has it on', row?.twoStep === true && me?.twoStep === false, JSON.stringify([row?.twoStep, me?.twoStep]));
    r = await api('DELETE', `/admin/admins/${me?._id}/two-step`, a3);
    check('an admin without the right can not switch it off for others', r.status === 403, `${r.status} ${msg(r)}`);
    r = await api('DELETE', `/admin/admins/${me?._id}/two-step`, superTok);
    check('a super admin can not use this on their own login', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('DELETE', `/admin/admins/${adminId}/two-step`, superTok);
    check('a super admin switches it off for another admin', r.status === 200 && d(r)?.twoStep === false, `${r.status} ${msg(r)}`);
    r = await api('GET', '/auth/me', a3);
    check('…which signs that admin out', r.status === 401, `${r.status}`);
    r = await signIn();
    const a4 = d(r)?.token;
    check('…and the password alone signs in again', r.status === 200 && !!a4 && d(r)?.user?.twoStep === false, `${r.status} ${msg(r)}`);
    r = await api('DELETE', `/admin/admins/${adminId}/two-step`, superTok);
    check('switching it off twice says it is not on', r.status === 400, `${r.status} ${msg(r)}`);
    let log = [];
    for (let i = 0; i < 10; i++) { // the log is written just after the reply
        log = (d(await api('GET', '/admin/audit?limit=50', superTok))?.items || []).map((x) => `${x.adminName}: ${x.action}`);
        if (log.includes('Two Step Admin: Turned on two-step sign-in') && log.includes('Whoply Admin: Turned off two-step sign-in for an admin')) break;
        await sleep(200);
    }
    check('turning it on, and switching it off for someone, are in the activity log', log.includes('Two Step Admin: Turned on two-step sign-in') && log.includes('Whoply Admin: Turned off two-step sign-in for an admin'), log.join(' | '));

    suite('turning it off yourself');
    r = await api('POST', '/auth/two-step/start', a4, { password: PASSWORD });
    const app2 = authenticator(d(r)?.secret || 'A');
    r = await api('POST', '/auth/two-step/confirm', a4, { code: await app2.next() });
    const recovery2 = d(r)?.recoveryCodes || [];
    check('it can be turned on again, with a new key and new recovery codes', r.status === 200 && d(await api('GET', '/auth/two-step', a4))?.recoveryLeft === 8 && !recovery2.some((c) => recovery.includes(c)), `${r.status} ${msg(r)}`);
    r = await signIn(recovery[4]);
    check('a recovery code from the old setup is worth nothing', r.status === 400 && /incorrect code/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/two-step/off', a4, { password: 'not-my-password', code: recovery2[0] });
    check('turning it off asks for the password', r.status === 400 && /incorrect password/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/two-step/off', a4, { password: PASSWORD, code: '000000' });
    const stillOn = d(await api('GET', '/auth/two-step', a4))?.on;
    check('…and for a right code', r.status === 400 && /incorrect code/i.test(msg(r)) && stillOn === true, `${r.status} ${msg(r)} on=${stillOn}`);
    r = await api('POST', '/auth/two-step/off', a4, { password: PASSWORD, code: await app2.next() });
    check('password + code turns it off', r.status === 200 && d(r)?.on === false, `${r.status} ${msg(r)}`);
    r = await signIn();
    const a5 = d(r)?.token;
    check('the password alone signs in again', r.status === 200 && !!a5, `${r.status} ${msg(r)}`);
    r = await api('GET', '/auth/two-step', a5);
    check('nothing of the old setup is left', d(r)?.on === false && d(r)?.recoveryLeft === 0 && d(r)?.since === null, JSON.stringify(d(r)));
    r = await api('POST', '/auth/two-step/confirm', a5, { code: await app2.next() });
    check('the old key can not be confirmed again', r.status === 400 && /start the setup again/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('guessing the code');
    r = await api('POST', '/auth/two-step/start', a5, { password: PASSWORD });
    const app3 = authenticator(d(r)?.secret || 'A');
    r = await api('POST', '/auth/two-step/confirm', a5, { code: await app3.next() });
    const n = () => 1 + Math.floor(Math.random() * 250);
    const guesser = { 'X-Forwarded-For': `10.${n()}.${n()}.${n()}` }; // a new address every run — the API keeps the counts in memory
    const tries = [];
    for (let i = 0; i < 5; i++) tries.push(await signIn('000000', guesser));
    check('5 wrong codes lock sign-in', r.status === 200 && tries.slice(0, 4).every((x) => x.status === 400) && /1 try left/.test(msg(tries[3])) && tries[4].status === 429, tries.map((x) => `${x.status} ${msg(x)}`).join(' | '));
    const right = await app3.next();
    r = await signIn(right, guesser);
    check('…so even the right code is refused there for 15 minutes', r.status === 429 && /locked/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await signIn(right, { 'X-Forwarded-For': `10.${n()}.${n()}.${n()}` });
    if (r.status === 429) check('the admin on their own network (skipped: start the API with TRUST_PROXY=1 to test it)', true);
    else check('the admin, on their own network, still signs in', r.status === 200 && !!d(r)?.token, `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ TWO-STEP SIGN-IN ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
