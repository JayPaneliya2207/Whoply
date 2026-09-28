/**
 * Staff roles: what each role may and may not do (utils/permissions.ts), and
 * that money a role must not see (profit, cost price, totals) is left out.
 *
 *   npm run seed:reset && npm run test:roles
 */
import fs from 'fs';

const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 200) }); return !!cond; };
async function api(method, path, token, body) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const items = (r) => r.json?.data?.items || [];
const msg = (r) => r.json?.error?.message || '';
async function login(mobile, password = 'whoply123') {
    const r = await api('POST', '/auth/password-login', null, { mobile, password });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.token;
}
const PW = 'Staff@123';
async function hire(ownerTok, name, mobile, role) {
    const r = await api('POST', '/staff', ownerTok, { name, mobile, role, salary: 12000, password: PW });
    if (r.status !== 201) throw new Error(`hire ${role}: ${r.status} ${JSON.stringify(r.json)}`);
    return { id: d(r)._id, tok: await login(mobile, PW) };
}
/** allowed = the role check let it through (any status but 401/403); blocked = 403. */
async function expect(tok, who, method, path, allowed, body) {
    const r = await api(method, path, tok, body ?? (method === 'GET' || method === 'DELETE' ? undefined : {}));
    const ok = allowed ? r.status !== 403 && r.status !== 401 : r.status === 403;
    check(`${who} ${allowed ? 'can' : 'cannot'} ${method} ${path}`, ok, `${r.status} ${msg(r)}`);
    return r;
}
const X = '000000000000000000000000'; // an id that exists nowhere

(async () => {
    suite('roles:app-copy-in-step');
    // The app hides screens with a copy of the permission map — it must match the API's.
    const block = (src) => src.slice(src.indexOf('export const PERMS'), src.indexOf('export const can'));
    const apiSrc = fs.readFileSync(new URL('../src/utils/permissions.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const appSrc = fs.readFileSync(new URL('../../whoply-app/src/lib/permissions.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('app permissions.ts has the same map as the API', block(apiSrc) === block(appSrc) && block(apiSrc).length > 200);

    const st = await login('9000000001'); // retail owner
    const ws = await login('9000000010'); // wholesale owner

    // Staff for this run (fresh mobiles so the seed's demo staff stay as they are).
    const cashier = await hire(st, 'Role Cashier', '9811100001', 'cashier');
    const rmgr = await hire(st, 'Role Manager', '9811100002', 'manager');
    const racc = await hire(st, 'Role Accountant', '9811100003', 'accountant');
    const wh = await hire(ws, 'Role Warehouse', '9811100011', 'warehouse');
    const rep = await hire(ws, 'Role Sales', '9811100012', 'salesStaff');
    const wmgr = await hire(ws, 'Role WManager', '9811100013', 'manager');
    const wacc = await hire(ws, 'Role WAccountant', '9811100014', 'accountant');

    suite('roles:hiring');
    let r = await api('POST', '/staff', ws, { name: 'Wrong', mobile: '9811100099', role: 'cashier' });
    check('a wholesaler cannot hire a cashier (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/staff', st, { name: 'Wrong', mobile: '9811100098', role: 'warehouse' });
    check('a shop cannot hire warehouse staff (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/staff', st, { name: 'Wrong', mobile: '9811100097', role: 'owner' });
    check('nobody can be hired as owner (400)', r.status === 400, `${r.status}`);

    // A product and a bill to work with
    r = await api('POST', '/shopkeeper/products', st, { name: 'RoleSoap', sku: 'RS1', sellPrice: 50, costPrice: 30, gstRate: 18, hsn: '3401', unit: 'pcs', currentStock: 100 });
    const prod = d(r);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 1 }], paymentMode: 'cash' });
    const inv = d(r);

    suite('roles:cashier');
    const c = cashier.tok;
    await expect(c, 'cashier', 'GET', '/shopkeeper/dashboard', true);
    await expect(c, 'cashier', 'GET', '/shopkeeper/products', true);
    await expect(c, 'cashier', 'POST', '/shopkeeper/billing', true, { items: [{ productId: prod._id, quantity: 1 }], paymentMode: 'cash' });
    await expect(c, 'cashier', 'GET', '/shopkeeper/billing', true);
    await expect(c, 'cashier', 'GET', `/shopkeeper/billing/${inv._id}`, true);
    await expect(c, 'cashier', 'POST', `/shopkeeper/billing/${inv._id}/mark-sent`, true);
    await expect(c, 'cashier', 'GET', '/shopkeeper/quotations', true);
    await expect(c, 'cashier', 'GET', '/shopkeeper/returns', true);
    await expect(c, 'cashier', 'POST', '/shopkeeper/returns', true);
    await expect(c, 'cashier', 'GET', '/shopkeeper/customers', true);
    await expect(c, 'cashier', 'POST', `/shopkeeper/customers/${X}/repayment`, true, { amount: 1 });
    await expect(c, 'cashier', 'GET', '/shopkeeper/reports/day-close', true);
    await expect(c, 'cashier', 'POST', '/shopkeeper/products', false);
    await expect(c, 'cashier', 'PATCH', `/shopkeeper/products/${prod._id}`, false, { sellPrice: 1 });
    await expect(c, 'cashier', 'DELETE', `/shopkeeper/products/${prod._id}`, false);
    await expect(c, 'cashier', 'POST', `/shopkeeper/products/${prod._id}/adjust-stock`, false, { quantity: 5 });
    await expect(c, 'cashier', 'GET', '/shopkeeper/reports/summary', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/reports/profit', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/reports/sales', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/reports/export', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/reports/gst', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/expenses', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/purchases', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/suppliers', false);
    await expect(c, 'cashier', 'GET', '/shopkeeper/ai/reorder', false);
    await expect(c, 'cashier', 'GET', `/shopkeeper/billing/${inv._id}/einvoice`, false);
    await expect(c, 'cashier', 'PATCH', '/shopkeeper/business', false, { name: 'Hacked' });
    await expect(c, 'cashier', 'GET', '/staff', false);
    await expect(c, 'cashier', 'GET', '/wholesaler/dashboard', false);
    r = await api('GET', '/shopkeeper/dashboard', c);
    check('cashier dashboard has no profit', d(r) && !('todayProfit' in d(r)) && !('estimatedProfit' in d(r)) && !('monthExpense' in d(r)), JSON.stringify(Object.keys(d(r) || {})));
    check('cashier dashboard has no supplier dues', d(r) && !('supplierPayable' in d(r)), '');
    check('cashier dashboard still has today\'s sales', typeof d(r)?.todaySales === 'number', '');
    r = await api('GET', '/shopkeeper/products?limit=5', c);
    check('cashier product list has no cost price', items(r).length > 0 && items(r).every((p) => !('costPrice' in p)), JSON.stringify(items(r)[0] || {}).slice(0, 120));
    r = await api('GET', `/shopkeeper/products/${prod._id}`, c);
    check('cashier product detail has no cost price', r.status === 200 && !('costPrice' in (d(r) || {})), '');
    r = await api('GET', '/shopkeeper/reports/day-close?date=2020-01-01', c);
    check('cashier day-close is always today', r.status === 200 && !['2019-12-31', '2020-01-01'].includes(d(r)?.date), d(r)?.date);

    suite('roles:owner-sees-all');
    r = await api('GET', '/shopkeeper/dashboard', st);
    check('owner dashboard has profit and supplier dues', 'todayProfit' in (d(r) || {}) && 'supplierPayable' in (d(r) || {}), '');
    r = await api('GET', '/shopkeeper/products?limit=5', st);
    check('owner product list has cost price', items(r).length > 0 && items(r).every((p) => 'costPrice' in p), '');
    r = await api('GET', '/shopkeeper/reports/day-close?date=2020-01-01', st);
    // (the date string is UTC, so in India the 1st shows as the 31st)
    check('owner day-close can pick a day', ['2019-12-31', '2020-01-01'].includes(d(r)?.date), d(r)?.date);

    suite('roles:shop-manager');
    const m = rmgr.tok;
    await expect(m, 'manager', 'POST', '/shopkeeper/products', true);
    await expect(m, 'manager', 'GET', '/shopkeeper/reports/summary', true);
    await expect(m, 'manager', 'GET', '/shopkeeper/expenses', true);
    await expect(m, 'manager', 'POST', '/shopkeeper/purchases', true);
    await expect(m, 'manager', 'GET', '/shopkeeper/ai/reorder', true);
    await expect(m, 'manager', 'PATCH', '/shopkeeper/business', false, { name: 'Manager Shop' });
    await expect(m, 'manager', 'GET', '/staff', false);
    await expect(m, 'manager', 'POST', '/staff', false, { name: 'Sneaky', mobile: '9811100096', role: 'manager' });
    await expect(m, 'manager', 'PATCH', `/staff/${cashier.id}`, false, { salary: 99999 });
    r = await api('GET', `/staff/${cashier.id}/detail`, m);
    check('shop manager cannot open a cashier\'s staff record (404)', r.status === 404, `${r.status}`);

    suite('roles:shop-accountant');
    const a = racc.tok;
    for (const p of ['/shopkeeper/dashboard', '/shopkeeper/billing', '/shopkeeper/returns', '/shopkeeper/customers', '/shopkeeper/expenses', '/shopkeeper/purchases', '/shopkeeper/suppliers', '/shopkeeper/reports/summary', '/shopkeeper/reports/profit', '/shopkeeper/reports/gst', '/shopkeeper/reports/export', `/shopkeeper/billing/${inv._id}/einvoice`]) {
        await expect(a, 'accountant', 'GET', p, true);
    }
    await expect(a, 'accountant', 'POST', '/shopkeeper/billing', false, { items: [{ productId: prod._id, quantity: 1 }], paymentMode: 'cash' });
    await expect(a, 'accountant', 'POST', '/shopkeeper/expenses', false, { amount: 10, category: 'other' });
    await expect(a, 'accountant', 'POST', '/shopkeeper/products', false);
    await expect(a, 'accountant', 'POST', '/shopkeeper/returns', false);
    await expect(a, 'accountant', 'POST', `/shopkeeper/customers/${X}/repayment`, false, { amount: 1 });
    await expect(a, 'accountant', 'POST', '/shopkeeper/purchases', false);
    r = await api('GET', '/shopkeeper/dashboard', a);
    check('accountant dashboard has profit', 'todayProfit' in (d(r) || {}), '');

    // Wholesale setup: a dealer and an order
    r = await api('POST', '/wholesaler/products', ws, { name: 'RoleRice', sku: 'RR1', sellPrice: 60, wholesalePrice: 50, costPrice: 40, gstRate: 5, hsn: '1006', unit: 'kg', currentStock: 500 });
    const wprod = d(r);
    r = await api('POST', '/wholesaler/dealers', ws, { name: 'Role Dealer', mobile: '9811100050' });
    const dealer = d(r);
    r = await api('POST', '/wholesaler/orders', ws, { dealerId: dealer._id, items: [{ productId: wprod._id, quantity: 10 }], source: 'manual' });
    const order = d(r);
    check('setup: wholesale order created', !!order?._id, `${r.status} ${msg(r)}`);

    suite('roles:warehouse');
    const w = wh.tok;
    await expect(w, 'warehouse', 'GET', '/wholesaler/products', true);
    await expect(w, 'warehouse', 'POST', `/wholesaler/products/${wprod._id}/adjust-stock`, true, { quantity: 0 });
    await expect(w, 'warehouse', 'GET', '/wholesaler/orders', true);
    await expect(w, 'warehouse', 'PATCH', `/wholesaler/orders/${order._id}/status`, true, { status: 'confirmed' });
    await expect(w, 'warehouse', 'POST', '/wholesaler/orders', false, { dealerId: dealer._id, items: [{ productId: wprod._id, quantity: 1 }] });
    await expect(w, 'warehouse', 'GET', '/wholesaler/dealers', false);
    await expect(w, 'warehouse', 'GET', '/wholesaler/payments', false);
    await expect(w, 'warehouse', 'POST', `/wholesaler/orders/${order._id}/collect`, false, { amount: 1, mode: 'cash' });
    await expect(w, 'warehouse', 'GET', '/wholesaler/reports/tally', false);
    await expect(w, 'warehouse', 'GET', '/wholesaler/price-lists', false);
    await expect(w, 'warehouse', 'GET', '/shopkeeper/dashboard', false);
    r = await api('GET', '/wholesaler/dashboard', w);
    check('warehouse dashboard has no money totals', r.status === 200 && !('revenue' in d(r)) && !('outstandingPayments' in d(r)) && !('todaySales' in d(r)), JSON.stringify(Object.keys(d(r) || {})));
    check('warehouse dashboard has dispatch + stock counts', typeof d(r)?.pendingDispatch === 'number' && typeof d(r)?.lowStockCount === 'number', '');

    suite('roles:sales-staff');
    const s = rep.tok;
    await expect(s, 'salesStaff', 'GET', '/wholesaler/dealers', true);
    await expect(s, 'salesStaff', 'POST', '/wholesaler/dealers', true, { name: 'Rep Dealer', mobile: '9811100051' });
    await expect(s, 'salesStaff', 'POST', '/wholesaler/orders', true, { dealerId: dealer._id, items: [{ productId: wprod._id, quantity: 1 }], source: 'manual' });
    await expect(s, 'salesStaff', 'POST', `/wholesaler/orders/${order._id}/collect`, true, { amount: 1, mode: 'cash' });
    await expect(s, 'salesStaff', 'GET', '/wholesaler/payments', true);
    await expect(s, 'salesStaff', 'GET', '/wholesaler/quotations', true);
    await expect(s, 'salesStaff', 'GET', '/wholesaler/price-lists', true);
    await expect(s, 'salesStaff', 'PUT', '/wholesaler/price-lists', false, { productId: wprod._id, tier: 'A', price: 1 });
    await expect(s, 'salesStaff', 'DELETE', `/wholesaler/dealers/${dealer._id}`, false);
    await expect(s, 'salesStaff', 'PATCH', `/wholesaler/orders/${order._id}/status`, false, { status: 'dispatched' });
    await expect(s, 'salesStaff', 'POST', '/wholesaler/products', false);
    await expect(s, 'salesStaff', 'GET', '/wholesaler/reports/tally', false);
    await expect(s, 'salesStaff', 'GET', '/wholesaler/reports/gst', false);
    await expect(s, 'salesStaff', 'GET', '/wholesaler/sales-team', false);
    await expect(s, 'salesStaff', 'POST', `/wholesaler/orders/${order._id}/return`, false);
    r = await api('GET', '/wholesaler/products?limit=5', s);
    check('sales rep product list has no cost price', items(r).length > 0 && items(r).every((p) => !('costPrice' in p)), '');
    // A rep logs visits only as themselves, and sees only their own.
    r = await api('POST', '/wholesaler/sales-team/visits', s, { salesRepId: wh.id, dealerId: dealer._id, outcome: 'no_order' });
    check('sales rep visit is saved under their own name', r.status === 201 && String(d(r)?.salesRepId) === String(rep.id), `${r.status} ${d(r)?.salesRepId} ${msg(r)}`);
    await api('POST', '/wholesaler/sales-team/visits', ws, { salesRepId: wh.id, dealerId: dealer._id, outcome: 'no_order' });
    r = await api('GET', '/wholesaler/sales-team/visits', s);
    check('sales rep sees only their own visits', r.status === 200 && (d(r) || []).length > 0 && (d(r) || []).every((v) => String(v.salesRepId) === String(rep.id)), `${(d(r) || []).length}`);
    r = await api('GET', '/wholesaler/sales-team/visits', ws);
    check('owner sees every rep\'s visits', (d(r) || []).some((v) => String(v.salesRepId) !== String(rep.id)), '');

    suite('roles:wholesale-manager');
    const wm = wmgr.tok;
    await expect(wm, 'manager', 'GET', '/wholesaler/sales-team', true);
    await expect(wm, 'manager', 'PUT', '/wholesaler/price-lists', true, { productId: wprod._id, tier: 'A', price: 48 });
    await expect(wm, 'manager', 'GET', '/wholesaler/reports/tally', true);
    await expect(wm, 'manager', 'POST', '/wholesaler/sales-team', false, { name: 'Sneaky Rep', mobile: '9811100095' });
    await expect(wm, 'manager', 'DELETE', `/wholesaler/sales-team/${rep.id}`, false);
    await expect(wm, 'manager', 'PATCH', '/wholesaler/business', false, { name: 'Manager Traders' });
    r = await api('GET', `/staff/${rep.id}/detail`, wm);
    check('manager can open a sales rep\'s detail', r.status === 200 && d(r)?.staff?.name === 'Role Sales', `${r.status}`);
    check('...but not their salary or ID', r.status === 200 && !('salary' in d(r).staff) && !('kyc' in d(r).staff), JSON.stringify(d(r)?.staff || {}));
    r = await api('GET', `/staff/${wh.id}/detail`, wm);
    check('manager cannot open warehouse staff detail (404)', r.status === 404, `${r.status}`);
    r = await api('GET', `/staff/${rep.id}/detail`, ws);
    check('owner sees a rep\'s salary', r.status === 200 && d(r)?.staff?.salary === 12000, `${r.status}`);

    suite('roles:wholesale-accountant');
    const wa = wacc.tok;
    for (const p of ['/wholesaler/dashboard', '/wholesaler/orders', '/wholesaler/dealers', '/wholesaler/payments', '/wholesaler/returns', '/wholesaler/reports/tally', '/wholesaler/reports/gst', `/wholesaler/orders/${order._id}/einvoice`]) {
        await expect(wa, 'accountant', 'GET', p, true);
    }
    await expect(wa, 'accountant', 'POST', '/wholesaler/orders', false, { dealerId: dealer._id, items: [{ productId: wprod._id, quantity: 1 }] });
    await expect(wa, 'accountant', 'POST', `/wholesaler/orders/${order._id}/collect`, false, { amount: 1, mode: 'cash' });
    await expect(wa, 'accountant', 'POST', '/wholesaler/dealers', false, { name: 'X', mobile: '9811100052' });
    await expect(wa, 'accountant', 'PATCH', `/wholesaler/orders/${order._id}/status`, false, { status: 'dispatched' });
    r = await api('GET', '/wholesaler/dashboard', wa);
    check('accountant dashboard has money totals', 'revenue' in (d(r) || {}), '');

    suite('roles:owner-only');
    await expect(st, 'owner', 'PATCH', '/shopkeeper/business', true, { upiId: 'rakesh@okhdfc' });
    await expect(st, 'owner', 'GET', '/staff', true);
    await expect(ws, 'owner', 'GET', '/wholesaler/sales-team', true);

    // Tidy up: deactivate this run's staff
    for (const [tok, x] of [[st, cashier], [st, rmgr], [st, racc], [ws, wh], [ws, rep], [ws, wmgr], [ws, wacc]]) await api('DELETE', `/staff/${x.id}`, tok);

    const fails = results.filter((r) => !r.pass);
    const bySuite = {};
    for (const r of results) { bySuite[r.S] ||= { p: 0, f: 0 }; r.pass ? bySuite[r.S].p++ : bySuite[r.S].f++; }
    console.log('\n============ STAFF ROLES ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
