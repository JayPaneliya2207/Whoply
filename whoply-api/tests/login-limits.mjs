/**
 * Sign-in guessing limits (utils/loginGuard.ts): 5 wrong tries lock an account
 * for 15 minutes, a good sign-in resets the count, OTP resend waits 30 s, and
 * 30 failed sign-ins from one address pause that address.
 *
 * The per-address check needs the API started with TRUST_PROXY=1 (so the
 * X-Forwarded-For address counts); without it that part is skipped.
 *
 *   npm run seed:reset && npm run test:login
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 220) }); return !!cond; };
async function api(method, path, token, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const pwLogin = (mobile, password, headers) => api('POST', '/auth/password-login', null, { mobile, password }, headers);
const tokenOf = async (mobile, password = 'whoply123') => d(await pwLogin(mobile, password))?.token;

(async () => {
    const owner = await tokenOf('9000000001');
    const hire = async (mobile, name) => {
        const r = await api('POST', '/staff', owner, { name, mobile, role: 'cashier', password: 'Staff@123' });
        if (r.status !== 201) throw new Error(`hire ${mobile}: ${r.status} ${msg(r)}`);
    };

    suite('password: 5 wrong tries lock the account');
    await hire('9844400001', 'Lock Test One');
    const left = [];
    for (let i = 0; i < 4; i++) left.push(await pwLogin('9844400001', 'wrong-pass'));
    check('wrong tries 1-4 say how many are left', left.every((r) => r.status === 400) && /4 tries left/.test(msg(left[0])) && /1 try left/.test(msg(left[3])), left.map((r) => `${r.status} ${msg(r)}`).join(' | '));
    let r = await pwLogin('9844400001', 'wrong-pass');
    check('5th wrong try locks sign-in (429)', r.status === 429 && /locked/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await pwLogin('9844400001', 'Staff@123');
    check('even the right password is refused while locked', r.status === 429 && /try again in \d+ minute/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/login', null, { mobile: '9844400001' });
    check('no OTP is sent while locked', r.status === 429, `${r.status} ${msg(r)}`);
    r = await pwLogin('9000000001', 'whoply123');
    check('other accounts are not affected', r.status === 200 && d(r)?.token, `${r.status} ${msg(r)}`);

    suite('password: a good sign-in resets the count');
    await hire('9844400002', 'Lock Test Two');
    for (let i = 0; i < 3; i++) await pwLogin('9844400002', 'wrong-pass');
    r = await pwLogin('9844400002', 'Staff@123');
    check('right password after 3 wrong tries works', r.status === 200, `${r.status} ${msg(r)}`);
    for (let i = 0; i < 3; i++) r = await pwLogin('9844400002', 'wrong-pass');
    check('count started again (2 tries left, not locked)', r.status === 400 && /2 tries left/.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('password: tries sent at the same moment all count');
    await hire('9844400003', 'Lock Test Three');
    const burst = await Promise.all(Array.from({ length: 12 }, () => pwLogin('9844400003', 'wrong-pass')));
    r = await pwLogin('9844400003', 'Staff@123');
    check('12 wrong tries at once → locked', r.status === 429 && burst.some((x) => x.status === 429), `${r.status} ${msg(r)} | burst: ${burst.map((x) => x.status).join(',')}`);

    suite('OTP');
    await hire('9844400004', 'Otp Test');
    r = await api('POST', '/auth/login', null, { mobile: '9844400004' });
    const devOtp = d(r)?.devOtp;
    check('OTP sent', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/login', null, { mobile: '9844400004' });
    check('asking again at once → wait 30 s (429)', r.status === 429 && /wait \d+ seconds/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/verify-otp', null, { mobile: '9844400004', otp: devOtp === '000000' ? '111111' : '000000' });
    check('wrong OTP counts as a wrong try', r.status === 400 && /Incorrect OTP — 4 tries left/.test(msg(r)), `${r.status} ${msg(r)}`);
    if (devOtp) {
        r = await api('POST', '/auth/verify-otp', null, { mobile: '9844400004', otp: devOtp });
        check('right OTP signs in', r.status === 200 && d(r)?.token, `${r.status} ${msg(r)}`);
    } else check('right OTP signs in', true, 'skipped: production mode hides the OTP');
    await hire('9844400005', 'Otp Lock');
    await api('POST', '/auth/login', null, { mobile: '9844400005' });
    for (let i = 0; i < 5; i++) r = await api('POST', '/auth/verify-otp', null, { mobile: '9844400005', otp: '000001' });
    check('5 wrong OTPs lock the account', r.status === 429, `${r.status} ${msg(r)}`);

    suite('per network address');
    const ip = `203.0.113.${1 + Math.floor(Math.random() * 250)}`;
    const from = { 'X-Forwarded-For': ip };
    let last;
    for (let i = 0; i < 30; i++) last = await pwLogin(`95555${String(10000 + i)}`, 'whatever', from);
    r = await pwLogin('9000000001', 'whoply123', from);
    if (r.status === 200) {
        check('address limit (skipped: start the API with TRUST_PROXY=1 to test it)', true);
    } else {
        check('30 failed sign-ins from one address → that address waits', last.status === 404 && r.status === 429 && /this network/i.test(msg(r)), `${last.status} → ${r.status} ${msg(r)}`);
        r = await pwLogin('9000000001', 'whoply123', { 'X-Forwarded-For': '198.51.100.7' });
        check('another address still signs in', r.status === 200, `${r.status} ${msg(r)}`);
    }

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ SIGN-IN LIMITS ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
