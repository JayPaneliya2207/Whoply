/**
 * Whoply edge-case + staff/admin coverage (negative paths, boundaries, authz).
 *
 *   npm run seed:reset && npm run test:edge
 */
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
async function login(mobile, password = 'whoply123') {
    const r = await api('POST', '/auth/password-login', null, { mobile, password });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.token;
}
const GOOD = '24AAAAA0000A1Z5';

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');

    // baseline data
    let r = await api('POST', '/shopkeeper/products', st, { name: 'LimitedStock', sku: 'LS1', sellPrice: 100, costPrice: 60, gstRate: 18, hsn: '1111', unit: 'pcs', currentStock: 5, lowStockThreshold: 2 });
    const prod = d(r);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 2 }], paymentMode: 'cash' });
    const inv = d(r);

    suite('edge:billing');
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 999 }], paymentMode: 'cash' });
    check('insufficient stock rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/billing', st, { items: [], paymentMode: 'cash' });
    check('empty cart rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 1 }], paymentMode: 'credit', paidAmount: 0 });
    check('credit sale w/o mobile rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 0 }], paymentMode: 'cash' });
    check('zero quantity rejected (400)', r.status === 400, `${r.status}`);

    suite('edge:returns');
    r = await api('POST', '/shopkeeper/returns', st, { invoiceId: inv._id, items: [{ productId: prod._id, quantity: 99 }], refundMode: 'cash' });
    check('over-return rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/returns', st, { invoiceId: inv._id, items: [{ productId: '000000000000000000000000', quantity: 1 }], refundMode: 'cash' });
    check('return of foreign item rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/returns', st, { invoiceId: inv._id, items: [{ productId: prod._id, quantity: 1 }], refundMode: 'cash' });
    check('valid partial return ok (201)', r.status === 201, `${r.status}`);
    r = await api('POST', '/shopkeeper/returns', st, { invoiceId: inv._id, items: [{ productId: prod._id, quantity: 2 }], refundMode: 'cash' });
    check('return beyond remaining rejected (400)', r.status === 400, `${r.status}`);

    suite('edge:repayment');
    r = await api('POST', '/shopkeeper/products', st, { name: 'CreditItem', sku: 'CI1', sellPrice: 500, gstRate: 0, unit: 'pcs', currentStock: 50 });
    const cp = d(r);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: cp._id, quantity: 2 }], paymentMode: 'credit', paidAmount: 0, walkInName: 'Udhar Edge', walkInMobile: '9820000099' });
    const custId = d(r).customerId;
    r = await api('POST', `/shopkeeper/customers/${custId}/repayment`, st, { amount: 0 });
    check('zero repayment rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `/shopkeeper/customers/${custId}/repayment`, st, { amount: -50 });
    check('negative repayment rejected (400)', r.status === 400, `${r.status}`);

    suite('edge:gstin');
    r = await api('POST', '/shopkeeper/customers', st, { name: 'X', mobile: '9810000001', gstin: '24AAAAA0000A1B5' });
    check('GSTIN missing Z rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'X', mobile: '9810000002', gstin: '2XAAAAA0000A1Z5' });
    check('GSTIN bad state-code rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'X', mobile: '9810000003', gstin: GOOD.toLowerCase() });
    check('lowercase GSTIN normalized & accepted (201)', r.status === 201 && d(r)?.gstin === GOOD, `${r.status} ${d(r)?.gstin}`);

    suite('edge:quotation');
    r = await api('POST', '/shopkeeper/quotations', st, { items: [{ productId: cp._id, quantity: 1 }], walkInName: 'Q', walkInMobile: '9830000001' });
    const q = d(r);
    r = await api('POST', `/shopkeeper/quotations/${q._id}/convert`, st, { paymentMode: 'cash' });
    check('quote converts once (201)', r.status === 201, `${r.status}`);
    r = await api('POST', `/shopkeeper/quotations/${q._id}/convert`, st, { paymentMode: 'cash' });
    check('double-convert rejected (400)', r.status === 400, `${r.status}`);

    suite('edge:low-stock-flag');
    // selling down past the threshold must flip the denormalised flag
    r = await api('POST', '/shopkeeper/products', st, { name: 'FlagTest', sku: 'FT1', sellPrice: 50, gstRate: 0, unit: 'pcs', currentStock: 20, lowStockThreshold: 10 });
    const ft = d(r);
    check('starts not low', d(await api('GET', `/shopkeeper/products/${ft._id}`, st))?.isLowStock === false, 'expected false at 20/10');
    await api('POST', '/shopkeeper/billing', st, { items: [{ productId: ft._id, quantity: 15 }], paymentMode: 'cash' });
    check('flag flips to low after sale', d(await api('GET', `/shopkeeper/products/${ft._id}`, st))?.isLowStock === true, 'expected true at 5/10');
    r = await api('POST', `/shopkeeper/products/${ft._id}/adjust-stock`, st, { quantity: 50, reason: 'adjustment' });
    check('flag clears after restock', d(await api('GET', `/shopkeeper/products/${ft._id}`, st))?.isLowStock === false, 'expected false at 55/10');

    suite('edge:wholesaler-orders');
    r = await api('POST', '/wholesaler/products', ws, { name: 'WEdge', sku: 'WE1', sellPrice: 200, wholesalePrice: 180, gstRate: 18, unit: 'pcs', currentStock: 100 });
    const wp = d(r);
    r = await api('POST', '/wholesaler/dealers', ws, { name: 'EdgeDealer', mobile: '9701000001', tier: 'B', gstin: GOOD });
    const dl = d(r);
    r = await api('POST', '/wholesaler/orders', ws, { dealerId: dl._id, items: [{ productId: wp._id, quantity: 10 }], paidAmount: 0 });
    const ord = d(r);
    r = await api('POST', `/wholesaler/orders/${ord._id}/collect`, ws, { amount: 999999 });
    check('over-collect clamps to due (0)', r.status === 201 && d(r)?.order?.dueAmount === 0, `${r.status} due=${d(r)?.order?.dueAmount}`);
    r = await api('POST', `/wholesaler/orders/${ord._id}/collect`, ws, { amount: 100 });
    check('collect on fully-paid order rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/wholesaler/orders', ws, { dealerId: dl._id, items: [{ productId: wp._id, quantity: 5 }], paidAmount: 0 });
    const ord2 = d(r);
    r = await api('PATCH', `/wholesaler/orders/${ord2._id}/status`, ws, { status: 'cancelled' });
    check('cancel clears due (0)', d(r)?.status === 'cancelled' && d(r)?.dueAmount === 0, JSON.stringify(d(r)?.dueAmount));
    r = await api('POST', `/wholesaler/orders/${ord2._id}/collect`, ws, { amount: 100 });
    check('collect on cancelled order rejected (400)', r.status === 400, `${r.status}`);

    suite('staff:shopkeeper');
    r = await api('POST', '/staff', st, { name: 'Cashier One', mobile: '9812345670', role: 'cashier', salary: 15000, password: 'staff123' });
    const staff = d(r);
    check('create staff (201)', r.status === 201 && !!staff?._id, `${r.status}`);
    r = await api('POST', '/staff', st, { name: 'Dup', mobile: '9812345670', role: 'cashier' });
    check('duplicate staff mobile rejected (409)', r.status === 409, `${r.status}`);
    r = await api('POST', '/staff', st, { name: 'Bad', mobile: '9812345671', role: 'president' });
    check('invalid staff role rejected (400)', r.status === 400, `${r.status}`);
    r = await api('GET', '/staff', st);
    check('list staff w/ monthlySalary', (d(r)?.count || 0) >= 1 && (d(r)?.monthlySalary || 0) >= 15000, JSON.stringify({ c: d(r)?.count, m: d(r)?.monthlySalary }));
    r = await api('PATCH', `/staff/${staff._id}`, st, { salary: 18000 });
    check('update staff salary', r.status === 200 && d(r)?.salary === 18000, `${r.status}`);
    r = await api('GET', `/staff/${staff._id}/detail`, st);
    check('staff detail 200', r.status === 200 && d(r)?.staff?._id === staff._id, `${r.status}`);

    suite('staff:role-gating');
    const cashierTok = await login('9812345670', 'staff123');
    r = await api('GET', '/wholesaler/dashboard', cashierTok);
    check('cashier blocked from wholesaler routes (403)', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/stats', cashierTok);
    check('cashier blocked from admin (403)', r.status === 403, `${r.status}`);
    r = await api('DELETE', `/staff/${staff._id}`, st);
    check('deactivate staff (200)', r.status === 200, `${r.status}`);

    suite('admin');
    const adm = await login('9000000099');
    r = await api('GET', '/admin/stats', adm);
    const stats = d(r);
    check('admin stats 200', r.status === 200 && stats?.businesses >= 2, `${r.status}`);
    check('admin stats has MRR', typeof stats?.mrr === 'number', JSON.stringify(stats?.mrr));
    r = await api('GET', '/admin/businesses', adm);
    check('admin lists businesses (>=2)', (d(r)?.items?.length || 0) >= 2, `${d(r)?.items?.length}`);
    const bizId = d(r)?.items?.[0]?._id;
    r = await api('GET', `/admin/businesses/${bizId}`, adm);
    check('admin business detail 200', r.status === 200 && !!d(r)?.business, `${r.status}`);
    r = await api('PATCH', `/admin/businesses/${bizId}`, adm, { plan: 'business' });
    check('admin change plan', r.status === 200 && d(r)?.plan === 'business', `${r.status}`);
    r = await api('POST', '/admin/businesses', adm, { name: 'New Tenant', type: 'retail', ownerName: 'New Owner', mobile: '9899999001', plan: 'free', password: 'pw123456' });
    check('admin create business (201)', r.status === 201 && !!d(r)?.business?._id, `${r.status}`);
    r = await api('POST', '/admin/businesses', adm, { name: 'Bad', type: 'invalidtype', ownerName: 'x', mobile: '9899999002' });
    check('admin reject invalid type (400)', r.status === 400, `${r.status}`);
    r = await api('GET', '/admin/users', adm);
    check('admin lists users', (d(r)?.items?.length || 0) >= 3, `${d(r)?.items?.length}`);
    r = await api('GET', '/admin/plans', adm);
    check('admin lists plans (3)', (d(r) || []).length >= 3, `${(d(r) || []).length}`);
    r = await api('POST', '/admin/plans', adm, { key: 'temp', name: 'Temp Plan', price: 99, features: ['x'] });
    const tempPlan = d(r);
    check('admin create plan (201)', r.status === 201 && !!tempPlan?._id, `${r.status}`);
    r = await api('PATCH', `/admin/plans/${tempPlan._id}`, adm, { price: 149 });
    check('admin update plan', r.status === 200 && d(r)?.price === 149, `${r.status}`);
    r = await api('DELETE', `/admin/plans/${tempPlan._id}`, adm);
    check('admin delete unused plan (200)', r.status === 200, `${r.status}`);
    const plans2 = (await api('GET', '/admin/plans', adm)).json.data;
    const freePlan = plans2.find((p) => p.key === 'free');
    r = await api('DELETE', `/admin/plans/${freePlan._id}`, adm);
    check('admin delete in-use plan rejected (400)', r.status === 400, `${r.status}`);

    suite('admin:authz');
    r = await api('GET', '/admin/stats', st);
    check('shopkeeper blocked from admin (403)', r.status === 403, `${r.status}`);

    const fails = results.filter((r) => !r.pass);
    const bySuite = {};
    for (const r of results) { bySuite[r.S] ||= { p: 0, f: 0 }; r.pass ? bySuite[r.S].p++ : bySuite[r.S].f++; }
    console.log('\n============ EDGE / STAFF / ADMIN ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
