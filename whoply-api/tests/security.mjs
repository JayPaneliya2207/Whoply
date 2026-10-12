/**
 * The guards in front of every route: operator / prototype keys refused,
 * small request bodies, clean errors (no 500s, no stack traces), pictures
 * checked, security headers, health with the database state, and the
 * per-address request limit.
 *
 *   npm run seed:reset && npm run test:security
 *   (the request-limit checks need the API started with TRUST_PROXY=1 — CI does)
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 220) }); return !!cond; };
async function raw(method, path, token, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body });
    let json = null; try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json, headers: res.headers };
}
const api = (method, path, token, body, headers) => raw(method, path, token, body != null ? JSON.stringify(body) : undefined, headers);
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const code = (r) => r.json?.error?.code || '';
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;
/** The admin panel signs in at its own door: admin logins are not shop users. */
const adminLogin = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/admin-login', null, { mobile, password }))?.token;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

(async () => {
    const st = await login('9000000001');

    suite('injection attempts');
    let r = await api('POST', '/auth/password-login', null, { mobile: { $ne: null }, password: { $ne: null } });
    check('operators in place of the mobile and password are refused', r.status === 400 && !d(r)?.token, `${r.status} ${code(r)} ${msg(r)}`);
    r = await api('POST', '/auth/password-login', null, { mobile: '9000000001', password: { $gt: '' } });
    check('…also when only the password is an operator', r.status === 400 && !d(r)?.token, `${r.status} ${code(r)}`);
    r = await raw('POST', '/auth/password-login', null, '{"__proto__":{"role":"admin"},"mobile":"9000000001","password":"whoply123"}');
    check('a prototype key in the body is refused', r.status === 400 && code(r) === 'INVALID_REQUEST', `${r.status} ${code(r)}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Injected', mobile: '9822600001', notes: { $where: 'sleep(5000)' } });
    check('an operator nested inside any field is refused', r.status === 400 && code(r) === 'INVALID_REQUEST', `${r.status} ${code(r)} ${msg(r)}`);
    let deep = 'x';
    for (let i = 0; i < 30; i++) deep = { a: deep };
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Deep', mobile: '9822600002', extra: deep });
    check('absurdly nested JSON is refused', r.status === 400, `${r.status} ${code(r)}`);
    r = await api('GET', '/shopkeeper/products?search[$regex]=.*', st);
    check('an operator in the query string does no harm', r.status === 200 || r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/customers?search=' + encodeURIComponent('.*(a+)+$'), st);
    check('a regex-bomb search is treated as plain text', r.status === 200, `${r.status} ${msg(r)}`);

    suite('request size and shape');
    r = await raw('POST', '/auth/password-login', null, '{"mobile": "9000000001", "password": ');
    check('broken JSON is a clean 400, not a server error', r.status === 400 && code(r) === 'INVALID_JSON', `${r.status} ${code(r)} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Big', mobile: '9822600003', notes: 'x'.repeat(1_200_000) });
    check('a body over 1 MB on a normal route is refused (413)', r.status === 413 && code(r) === 'PAYLOAD_TOO_LARGE', `${r.status} ${code(r)}`);
    r = await api('GET', '/shopkeeper/products/not-an-id', st);
    check('a bad id is a clean 400 / 404', [400, 404].includes(r.status) && !r.json?.error?.stack, `${r.status} ${code(r)}`);
    r = await api('GET', '/no/such/route', st);
    check('an unknown route is a JSON 404 without a stack trace', r.status === 404 && code(r) === 'NOT_FOUND' && !JSON.stringify(r.json).includes('at '), `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);

    suite('pictures and profile fields');
    r = await api('PATCH', '/auth/profile', st, { avatar: 'javascript:alert(1)' });
    check('a script URL as a profile picture is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/auth/profile', st, { avatar: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+' });
    check('an SVG (can carry script) is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/auth/profile', st, { avatar: PNG });
    check('a real PNG is accepted', r.status === 200 && d(r)?.user?.avatar === PNG, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/auth/profile', st, { avatar: 'data:image/png;base64,' + 'A'.repeat(450_000) });
    check('an oversized profile picture is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/auth/profile', st, { language: 'xx' });
    check('an unknown language is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/auth/profile', st, { email: 'not-an-email' });
    check('a bad email is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/auth/profile', st, { name: 'Rakesh', language: 'hi', email: 'rakesh@example.com' });
    check('good profile values still save', r.status === 200 && d(r)?.user?.language === 'hi', `${r.status} ${msg(r)}`);
    await api('PATCH', '/auth/profile', st, { language: 'en', avatar: '' });
    r = await api('PATCH', '/shopkeeper/business', st, { upiQrImage: '<img src=x onerror=alert(1)>' });
    check('HTML as the shop QR picture is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/shopkeeper/business', st, { upiQrImage: PNG, upiId: 'shop@upi', bank: { name: 'SBI', holder: 'Shop', account: '1234567890', ifsc: 'SBIN0001234' } });
    check('a real QR picture, UPI ID and bank details save', r.status === 200 && d(r)?.upiId === 'shop@upi' && d(r)?.bank?.ifsc === 'SBIN0001234', `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/shopkeeper/business', st, { name: { toString: 'x' } });
    check('an object where the shop name should be is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/shopkeeper/business', st, { name: 'x'.repeat(200) });
    check('an over-long shop name is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/shopkeeper/business', st, { settings: { udharReminderDays: 100000 } });
    check('reminder days out of range are refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', '/shopkeeper/business', st, { upiId: 'no-at-sign' });
    check('a bad UPI ID is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/products', st, { name: 'Pic Soap', sku: 'PS' + Date.now(), sellPrice: 10, costPrice: 5, unit: 'pcs', image: 'file:///etc/passwd' });
    check('a product picture that is not a picture is refused', r.status === 400, `${r.status} ${msg(r)}`);

    suite('headers and health');
    r = await api('GET', '/health', null);
    check('health says the database is connected', r.status === 200 && r.json?.database === 'connected', JSON.stringify(r.json));
    check('security headers are set', r.headers.get('x-content-type-options') === 'nosniff' && !!r.headers.get('strict-transport-security') && !r.headers.get('x-powered-by'), [...r.headers.keys()].join(','));
    r = await api('GET', '/shopkeeper/dashboard', 'not.a.token');
    check('a made-up token is refused', r.status === 401, `${r.status}`);
    r = await api('GET', '/admin/stats', st);
    check('a shop login can not use the admin API', r.status === 403, `${r.status}`);

    suite('requests that used to be server errors');
    r = await api('DELETE', '/shopkeeper/suppliers/abc', st);
    check('a hand-typed id is a clean 400', r.status === 400 && code(r) === 'INVALID_ID', `${r.status} ${code(r)} ${msg(r)}`);
    r = await raw('POST', '/shopkeeper/customers', st, undefined);
    check('a POST with no body at all is a clean 400', r.status === 400, `${r.status} ${code(r)} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/products?page=999999999999999999999', st);
    check('an absurd page number is not a server error', r.status === 200, `${r.status} ${msg(r)}`);

    suite('big bodies need a login');
    r = await api('POST', '/staff', null, { name: 'Stranger', mobile: '12', pad: 'x'.repeat(1_500_000) });
    check('a stranger can not make the API read a big body on a photo route (413)', r.status === 413 && code(r) === 'PAYLOAD_TOO_LARGE', `${r.status} ${code(r)}`);
    r = await api('POST', '/staff', 'not.a.real.token', { name: 'Stranger', mobile: '12', pad: 'x'.repeat(1_500_000) });
    check('…nor with a made-up token', r.status === 413, `${r.status} ${code(r)}`);
    r = await api('POST', '/staff', st, { name: 'Owner', mobile: '12', pad: 'x'.repeat(1_500_000) });
    check('…a signed-in owner still can (refused for the content, not the size)', r.status !== 413 && r.status < 500, `${r.status} ${code(r)} ${msg(r)}`);

    suite('one business, one set of data');
    const ws = await login('9000000010');
    const otherCat = d(await api('POST', '/wholesaler/categories', ws, { name: 'Another business category' }));
    const prod = d(await api('POST', '/shopkeeper/products', st, { name: 'Category check item', sku: 'CAT-CHECK-1', sellPrice: 10, costPrice: 5 }));
    r = await api('PATCH', `/shopkeeper/products/${prod?._id}`, st, { categoryId: otherCat?._id });
    check('a product can not be put in another business’s category', !!otherCat?._id && !!prod?._id && r.status === 400, `${r.status} ${msg(r)} cat=${otherCat?._id} prod=${prod?._id}`);
    const ownCat = d(await api('POST', '/shopkeeper/categories', st, { name: 'My own category' }));
    r = await api('PATCH', `/shopkeeper/products/${prod?._id}`, st, { categoryId: ownCat?._id });
    check('…its own category is fine', !!ownCat?._id && r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('GET', '/public/stats', null);
    check('public stats give nothing away while there are only a few businesses', r.status === 200 && d(r)?.gstInvoices === 0 && d(r)?.shopkeepers === 0 && d(r)?.wholesalers === 0, JSON.stringify(d(r)));

    suite('staff see only their own notifications');
    const adm = await adminLogin('9000000099');
    await api('POST', '/staff', st, { name: 'Counter Cashier', mobile: '9811100031', role: 'cashier', salary: 9000, password: 'Cashier@2026' });
    const cashier = await login('9811100031', 'Cashier@2026');
    await api('POST', '/support/messages', st, { text: 'Please call me about my printer.' });
    const thread = d(await api('GET', '/admin/support/threads', adm))?.items?.[0];
    r = await api('POST', `/admin/support/threads/${thread?._id}/messages`, adm, { text: 'We will call you at 5 pm today.' });
    const mine = d(await api('GET', '/shopkeeper/notifications', st));
    const theirs = d(await api('GET', '/shopkeeper/notifications', cashier));
    const kinds = (x) => JSON.stringify((x?.items || []).map((n) => n.type));
    check('the owner gets the support reply as a notification', r.status < 300 && (mine?.items || []).some((n) => n.type === 'support'), `${r.status} ${msg(r)} ${kinds(mine)}`);
    check('a cashier does not get owner-only notifications', !!cashier && Array.isArray(theirs?.items) && theirs.items.every((n) => !['support', 'summary', 'payable', 'subscription'].includes(n.type)), kinds(theirs));
    check('…and they are not counted as unread for the cashier', (mine?.unread ?? 0) > (theirs?.unread ?? 0), `owner ${mine?.unread} cashier ${theirs?.unread}`);
    const reply = (mine?.items || []).find((n) => n.type === 'support');
    await api('POST', `/shopkeeper/notifications/${reply?._id}/read`, cashier);
    const after = d(await api('GET', '/shopkeeper/notifications', st));
    check('…nor can the cashier mark the owner’s as read', (after?.items || []).some((n) => String(n._id) === String(reply?._id) && n.isRead === false), kinds(after));

    suite('sign-up is closed');
    r = await api('POST', '/auth/register', null, { name: 'Stranger', mobile: '9811100001', password: 'Stranger@2026' });
    check('nobody can create an account by themselves', r.status === 403 && !d(r)?.userId, `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/password-login', null, { mobile: '9811100001', password: 'Stranger@2026' });
    check('…and that number has no login afterwards', r.status !== 200 && !d(r)?.token, `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/login', null, { mobile: '9811100001' });
    check('asking for an OTP does not create one either', r.status === 404 && !d(r)?.devOtp, `${r.status} ${msg(r)}`);

    suite('request limit');
    const hit = (ip, n) => Promise.all(Array.from({ length: n }, () => api('GET', '/public/plans', null, null, { 'X-Forwarded-For': ip })));
    const first = await hit('198.51.100.77', 120);
    check('120 requests a minute to a public route go through', first.every((x) => x.status === 200), first.map((x) => x.status).filter((s) => s !== 200).join(','));
    r = await api('GET', '/public/plans', null, null, { 'X-Forwarded-For': '198.51.100.77' });
    const behindProxy = r.status === 429;
    if (!behindProxy && process.env.TRUST_PROXY !== '1') {
        console.log('   (request-limit checks skipped: start the API with TRUST_PROXY=1 to test them)');
    } else {
        check('the 121st from the same address is refused (429) and says when to retry', r.status === 429 && Number(r.headers.get('retry-after')) > 0, `${r.status} retry-after=${r.headers.get('retry-after')}`);
        r = await api('GET', '/public/plans', null, null, { 'X-Forwarded-For': '198.51.100.78' });
        check('another address is not affected', r.status === 200 && r.headers.get('ratelimit-limit') === '120', `${r.status} limit=${r.headers.get('ratelimit-limit')}`);
        r = await api('GET', '/shopkeeper/dashboard', st, null, { 'X-Forwarded-For': '198.51.100.77' });
        check('the public limit does not lock that address out of the app', r.status === 200, `${r.status} ${msg(r)}`);
    }

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ SECURITY ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
