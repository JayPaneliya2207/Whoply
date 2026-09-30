/**
 * Platform admin: suspending a business really blocks its logins (and resuming
 * brings them back), the user list sends no KYC/salary and searches on the
 * server, GMV includes wholesale orders, plans are checked, and admins can't
 * lock themselves out.
 *
 *   npm run seed:reset && npm run test:admin
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 220) }); return !!cond; };
async function api(method, path, token, body) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const pw = (mobile, password = 'whoply123') => api('POST', '/auth/password-login', null, { mobile, password });
const login = async (mobile, password) => d(await pw(mobile, password))?.token;

(async () => {
    const adm = await login('9000000099');
    const st = await login('9000000001');
    const ws = await login('9000000010');
    const me = d(await api('GET', '/auth/me', adm))?.user;

    suite('suspend a business');
    const shop = (d(await api('GET', '/admin/businesses?limit=100&type=retail', adm))?.items || [])[0];
    await api('POST', '/staff', st, { name: 'Suspend Cashier', mobile: '9822200001', role: 'cashier', password: 'Staff@123' });
    const cashier = await login('9822200001', 'Staff@123');
    let r = await api('PATCH', `/admin/businesses/${shop._id}`, adm, { isActive: false });
    check('admin suspends the shop', r.status === 200 && d(r)?.isActive === false, `${r.status} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/dashboard', st);
    check("the owner's open session stops working", r.status === 401 && /suspended/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/products', cashier);
    check("…and the cashier's", r.status === 401, `${r.status} ${msg(r)}`);
    r = await pw('9000000001');
    check('the owner can not log in again', r.status === 403 && /suspended/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/auth/login', null, { mobile: '9000000001' });
    check('…nor get an OTP', r.status === 403, `${r.status} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/dashboard', ws);
    check('other businesses are not affected', r.status === 200 || r.status === 403, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/stats', adm);
    check('the admin still works', r.status === 200, `${r.status}`);
    await api('PATCH', `/admin/businesses/${shop._id}`, adm, { isActive: true });
    r = await pw('9000000001');
    check('resuming lets the owner log in again', r.status === 200, `${r.status} ${msg(r)}`);
    r = await pw('9822200001', 'Staff@123');
    check('…and the staff', r.status === 200, `${r.status} ${msg(r)}`);
    await api('DELETE', `/admin/businesses/${shop._id}`, adm);
    await api('PATCH', `/admin/businesses/${shop._id}`, adm, { isActive: true });
    r = await pw('9822200001', 'Staff@123');
    check('suspend with Delete, then resume: staff come back too', r.status === 200, `${r.status} ${msg(r)}`);

    suite('user list');
    r = await api('GET', '/admin/users?limit=100', adm);
    const users = d(r)?.items || [];
    const keys = new Set(users.flatMap((u) => Object.keys(u)));
    check('no KYC, salary, password or OTP in the list', users.length && !['kyc', 'salary', 'password', 'otp', 'loginFails', 'lockedUntil'].some((k) => keys.has(k)), [...keys].join(','));
    r = await api('GET', '/admin/users?search=Suspend%20Cash', adm);
    check('search by name runs on the server', d(r)?.items?.length === 1 && d(r).items[0].mobile === '9822200001', JSON.stringify(d(r)?.items?.map((u) => u.name)));
    r = await api('GET', '/admin/users?search=22200001', adm);
    check('search by part of a mobile', d(r)?.items?.some((u) => u.mobile === '9822200001'), JSON.stringify(d(r)?.items?.map((u) => u.mobile)));
    r = await api('GET', '/admin/users?limit=2&page=2', adm);
    check('pages beyond the first are reachable', d(r)?.meta?.page === 2 && d(r)?.meta?.total >= 4, JSON.stringify(d(r)?.meta));

    suite('admins can not be switched off');
    r = await api('PATCH', `/admin/users/${me?.id}`, adm, { isActive: false });
    check('an admin can not turn off their own login', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/stats', adm);
    check('…and is still signed in', r.status === 200, `${r.status}`);

    suite('GMV');
    const s0 = d(await api('GET', '/admin/stats', adm));
    const dealer = d(await api('POST', '/wholesaler/dealers', ws, { name: 'GMV Dealer', mobile: '9822200002' }));
    const prod = d(await api('POST', '/wholesaler/products', ws, { name: 'GMV Oil', sku: 'GO' + Date.now(), sellPrice: 200, wholesalePrice: 150, costPrice: 100, gstRate: 0, unit: 'pcs', currentStock: 100 }));
    const order = d(await api('POST', '/wholesaler/orders', ws, { dealerId: dealer._id, items: [{ productId: prod._id, quantity: 10 }], source: 'manual' }));
    const s1 = d(await api('GET', '/admin/stats', adm));
    check('a wholesale order counts in platform GMV', Math.abs(s1.gmv - s0.gmv - order.total) < 0.01 && Math.abs(s1.wholesaleGmv - s0.wholesaleGmv - order.total) < 0.01, `${s0.gmv} → ${s1.gmv} (order ${order?.total})`);
    const wsBiz = (d(await api('GET', '/admin/businesses?limit=100&type=wholesale', adm))?.items || [])[0];
    const det = d(await api('GET', `/admin/businesses/${wsBiz._id}`, adm));
    check("the wholesaler's detail shows its orders and GMV", det.orders >= 1 && det.gmv >= order.total, JSON.stringify({ orders: det.orders, gmv: det.gmv }));
    await api('PATCH', `/wholesaler/orders/${order._id}/status`, ws, { status: 'cancelled' });
    const s2 = d(await api('GET', '/admin/stats', adm));
    check('a cancelled order drops out of GMV', Math.abs(s2.gmv - s0.gmv) < 0.01, `${s0.gmv} → ${s2.gmv}`);

    suite('plans');
    r = await api('POST', '/admin/plans', adm, { key: 'starter', name: 'Starter', price: 199, period: 'month' });
    check('a new plan can be added', r.status === 201, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/businesses', adm, { name: 'Starter Shop', type: 'retail', ownerName: 'S Owner', mobile: '9822200003', plan: 'starter', password: 'start123' });
    check('…and a business created on it', r.status === 201 && d(r)?.business?.plan === 'starter', `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/businesses/${shop._id}`, adm, { plan: 'nope' });
    check('a plan that does not exist is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/plans', adm, { key: 'cheap', name: 'Cheap', price: -500 });
    check('a negative price is refused', r.status === 400, `${r.status} ${msg(r)}`);
    const starter = (d(await api('GET', '/admin/plans', adm)) || []).find((p) => p.key === 'starter');
    r = await api('PATCH', `/admin/plans/${starter?._id}`, adm, { period: 'week' });
    check('a period other than month/year is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/businesses/${shop._id}`, adm, { name: '  ' });
    check('a blank business name is refused', r.status === 400, `${r.status} ${msg(r)}`);

    suite('new business');
    r = await api('POST', '/admin/businesses', adm, { name: 'Weak Pass Shop', type: 'retail', ownerName: 'W', mobile: '9822200004', password: '1' });
    check('an owner password shorter than 6 is refused', r.status === 400, `${r.status} ${msg(r)}`);
    const count = d(await api('GET', '/admin/businesses?limit=100&search=Weak%20Pass', adm))?.items?.length;
    check('…and no half-made business is left', count === 0, `${count}`);
    r = await api('GET', '/admin/stats', st);
    check('a shop owner can not use the admin API', r.status === 403, `${r.status}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ ADMIN ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
