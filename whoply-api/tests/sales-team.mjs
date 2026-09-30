/**
 * Sales team: dealer fields (only what the form sets), assigning reps, which
 * rep an order counts for, commission (before GST, no cancelled orders), and
 * visit logging.
 *
 *   npm run seed:reset && npm run test:sales
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
const items = (r) => r.json?.data?.items || [];
const msg = (r) => r.json?.error?.message || '';
const near = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.011;
async function login(mobile, password = 'whoply123') {
    const r = await api('POST', '/auth/password-login', null, { mobile, password });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status}`);
    return r.json.data.token;
}
const W = '/wholesaler';

(async () => {
    const ws = await login('9000000010');
    const hire = async (role, mobile, name) => { const h = await api('POST', '/staff', ws, { name, mobile, role, password: 'Staff@123' }); if (h.status !== 201) throw new Error(`hire: ${h.status} ${JSON.stringify(h.json)}`); return { id: d(h)._id, tok: await login(mobile, 'Staff@123') }; };
    const repA = await hire('salesStaff', '9822266001', 'Rep Asha');
    const repB = await hire('salesStaff', '9822266002', 'Rep Bharat');
    const godown = await hire('warehouse', '9822266003', 'Godown Guy');
    let r = await api('POST', `${W}/products`, ws, { name: 'Team Oil', sku: 'TO1', hsn: '1512', sellPrice: 200, wholesalePrice: 100, costPrice: 80, gstRate: 5, unit: 'pcs', currentStock: 5000 });
    const oil = d(r);

    suite('dealer:fields');
    r = await api('POST', `${W}/dealers`, ws, { name: '  Owner Dealer ', mobile: '+91 98222 66010', tier: 'A', outstandingBalance: 99999, isActive: false, businessId: '000000000000000000000000', city: 'Surat' });
    const dealerO = d(r);
    check('create ok, name trimmed, mobile 10 digits', r.status === 201 && dealerO.name === 'Owner Dealer' && dealerO.mobile === '9822266010', `${r.status} ${msg(r)} ${dealerO?.mobile}`);
    check('outstanding / isActive / business not taken from the request', dealerO && dealerO.isActive === true && !(dealerO.outstandingBalance > 0) && dealerO.businessId !== '000000000000000000000000', JSON.stringify({ a: dealerO?.isActive, o: dealerO?.outstandingBalance }));
    r = await api('POST', `${W}/dealers`, ws, { name: 'Bad Tier', tier: 'Z' });
    check('bad price group refused (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `${W}/dealers`, ws, { name: 'Bad Limit', creditLimit: -1 });
    check('negative credit limit refused (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `${W}/dealers`, ws, { name: 'Bad Mobile', mobile: '12345' });
    check('bad mobile refused (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `${W}/dealers`, ws, { name: '' });
    check('blank name refused (400)', r.status === 400, `${r.status}`);

    suite('dealer:assign-rep');
    r = await api('PATCH', `${W}/dealers/${dealerO._id}`, ws, { assignedRepId: repB.id });
    check('owner assigns Rep Bharat', r.status === 200 && String(d(r)?.assignedRepId) === repB.id, `${r.status} ${msg(r)}`);
    r = await api('GET', `${W}/dealers?limit=100`, ws);
    check('dealer list shows the rep name', items(r).find((x) => x._id === dealerO._id)?.assignedRepName === 'Rep Bharat', '');
    r = await api('PATCH', `${W}/dealers/${dealerO._id}`, ws, { assignedRepId: godown.id });
    check('a non-rep cannot be assigned (400)', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `${W}/dealers/${dealerO._id}`, ws, { assignedRepId: '000000000000000000000000' });
    check('an unknown rep cannot be assigned (400)', r.status === 400, `${r.status}`);
    r = await api('PATCH', `${W}/dealers/${dealerO._id}`, ws, { assignedRepId: null });
    check('unassign', r.status === 200 && !d(r)?.assignedRepId, `${r.status} ${d(r)?.assignedRepId}`);
    await api('PATCH', `${W}/dealers/${dealerO._id}`, ws, { assignedRepId: repB.id });
    r = await api('POST', `${W}/dealers`, repA.tok, { name: 'Asha Found This', mobile: '9822266011', assignedRepId: repB.id });
    const dealerA = d(r);
    check("a rep's new dealer is theirs (their pick of rep is ignored)", r.status === 201 && String(dealerA.assignedRepId) === repA.id, `${r.status} ${dealerA?.assignedRepId}`);
    r = await api('PATCH', `${W}/dealers/${dealerO._id}`, repA.tok, { assignedRepId: repA.id, city: 'Rajkot' });
    check("a rep cannot edit (or take over) another rep's dealer", r.status === 403, `${r.status} ${r.json?.error?.message}`);
    r = await api('GET', `${W}/dealers?limit=100&mine=true`, repA.tok);
    check('"my dealers" for Rep Asha lists only hers', items(r).length === 1 && items(r)[0]._id === dealerA._id, JSON.stringify(items(r).map((x) => x.name)));

    suite('orders:which-rep');
    const order = async (tok, dealerId, qty) => d(await api('POST', `${W}/orders`, tok, { dealerId, items: [{ productId: oil._id, quantity: qty }], source: 'field' }));
    const o1 = await order(repA.tok, dealerO._id, 10); // Asha takes an order for Bharat's dealer
    check("the rep who takes the order gets it (not the dealer's rep)", String(o1?.salesRepId) === repA.id, `${o1?.salesRepId}`);
    const o2 = await order(ws, dealerO._id, 20);
    check("an order the owner enters counts for the dealer's rep", String(o2?.salesRepId) === repB.id, `${o2?.salesRepId}`);
    const o3 = await order(ws, dealerA._id, 30);
    check('…Asha for her own dealer', String(o3?.salesRepId) === repA.id, `${o3?.salesRepId}`);
    r = await api('POST', `${W}/quotations`, ws, { dealerId: dealerO._id, items: [{ productId: oil._id, quantity: 5 }] });
    const q = d(r);
    r = await api('POST', `${W}/quotations/${q?._id}/convert`, ws, {});
    const o4 = d(r)?.order || d(r);
    check("quotation → order counts for the dealer's rep", String(o4?.salesRepId) === repB.id, `${r.status} ${o4?.salesRepId} ${msg(r)}`);

    suite('commission');
    const repsOf = async (tok) => d(await api('GET', `${W}/sales-team`, tok)) || [];
    let list = await repsOf(ws);
    const A = list.find((x) => x._id === repA.id), B = list.find((x) => x._id === repB.id);
    const pre = (...os) => os.reduce((s, o) => s + o.subtotal, 0);
    check('Asha: 2 orders, sales = value before GST', A && A.orders === 2 && near(A.sales, pre(o1, o3)), JSON.stringify(A));
    check('Asha: commission = 2% of that', A && near(A.commission, pre(o1, o3) * 0.02) && A.commissionPct === 2, `${A?.commission}`);
    check('Bharat: 2 orders (owner-entered + quotation)', B && B.orders === 2 && near(B.sales, pre(o2, o4)), JSON.stringify(B));
    check('dealers looked after: Asha 1, Bharat 1', A?.dealers === 1 && B?.dealers === 1, `${A?.dealers} ${B?.dealers}`);
    check('sales before GST really is below the order totals', A && A.sales < o1.total + o3.total, `${A?.sales} vs ${o1.total + o3.total}`);
    await api('PATCH', `${W}/orders/${o3._id}/status`, ws, { status: 'cancelled' });
    list = await repsOf(ws);
    const A2 = list.find((x) => x._id === repA.id);
    check('a cancelled order stops counting', A2 && A2.orders === 1 && near(A2.sales, o1.subtotal) && near(A2.commission, o1.subtotal * 0.02), JSON.stringify(A2));
    const mine = await repsOf(repA.tok);
    check('a rep sees only their own row', mine.length === 1 && mine[0]._id === repA.id, JSON.stringify(mine.map((x) => x.name)));

    suite('visits');
    r = await api('POST', `${W}/sales-team/visits`, repA.tok, { dealerId: dealerA._id, outcome: 'follow_up', note: 'Wants samples' });
    check('rep logs a visit (saved as them)', r.status === 201 && String(d(r)?.salesRepId) === repA.id && d(r)?.note === 'Wants samples', `${r.status} ${msg(r)}`);
    r = await api('POST', `${W}/sales-team/visits`, repA.tok, { dealerId: dealerA._id, outcome: 'maybe' });
    check('unknown outcome refused (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `${W}/sales-team/visits`, repA.tok, { dealerId: dealerA._id, note: 'x'.repeat(201) });
    check('over-long note refused (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `${W}/sales-team/visits`, ws, { dealerId: dealerO._id, outcome: 'order', salesRepId: repB.id });
    check('owner logs a visit for Rep Bharat', r.status === 201 && String(d(r)?.salesRepId) === repB.id, `${r.status} ${msg(r)}`);
    r = await api('POST', `${W}/sales-team/visits`, ws, { dealerId: dealerO._id, salesRepId: godown.id });
    check('owner cannot log a visit for a non-rep (400)', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${W}/sales-team/visits`, ws, { dealerId: dealerO._id });
    check('owner must say which rep went (400)', r.status === 400, `${r.status}`);
    r = await api('GET', `${W}/sales-team/visits?dealerId=${dealerA._id}`, ws);
    check('visits for one dealer', (d(r) || []).length === 1 && d(r)[0].dealerName === 'Asha Found This', `${(d(r) || []).length}`);
    r = await api('GET', `${W}/sales-team/visits`, repA.tok);
    check('a rep sees only their own visits', (d(r) || []).every((v) => String(v.salesRepId) === repA.id) && (d(r) || []).length === 1, `${(d(r) || []).length}`);
    list = await repsOf(ws);
    check('visit counts this month', list.find((x) => x._id === repA.id)?.visits === 1 && list.find((x) => x._id === repB.id)?.visits === 1, JSON.stringify(list.map((x) => [x.name, x.visits])));
    await api('DELETE', `${W}/dealers/${dealerA._id}`, ws);
    r = await api('POST', `${W}/sales-team/visits`, repA.tok, { dealerId: dealerA._id });
    check('no visits to a removed dealer (400)', r.status === 400, `${r.status}`);

    for (const x of [repA, repB, godown]) await api('DELETE', `/staff/${x.id}`, ws);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ SALES TEAM ============');
    for (const [k, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${k}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
