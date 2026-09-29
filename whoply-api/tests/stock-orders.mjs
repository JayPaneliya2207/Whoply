/**
 * Stock adjustment (add / remove / count, atomic) + stock history, and editing
 * and cancelling wholesale orders.
 *
 *   npm run seed:reset && npm run test:stock
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
const near = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.011;
async function login(mobile, password = 'whoply123') {
    const r = await api('POST', '/auth/password-login', null, { mobile, password });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status}`);
    return r.json.data.token;
}
const stockOf = async (tok, base, id) => d(await api('GET', `${base}/products/${id}`, tok))?.currentStock;

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');
    const S_ = '/shopkeeper';

    let r = await api('POST', `${S_}/products`, st, { name: 'Adjust Soap', sku: 'AS1', sellPrice: 40, costPrice: 25, gstRate: 18, unit: 'pcs', currentStock: 10 });
    const soap = d(r);
    r = await api('POST', `${S_}/products`, st, { name: 'Adjust Sugar', sku: 'AG1', sellPrice: 45, costPrice: 38, gstRate: 5, unit: 'kg', currentStock: 0 });
    const sugar = d(r);

    suite('stock:add-remove');
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: 5, note: 'Found a carton' });
    check('add 5 → 15', r.status === 200 && d(r)?.currentStock === 15, `${r.status} ${d(r)?.currentStock} ${msg(r)}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: -3, reason: 'damage', note: 'Wet' });
    check('remove 3 damaged → 12', r.status === 200 && d(r)?.currentStock === 12, `${r.status} ${d(r)?.currentStock}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: -50 });
    check('removing more than stock is refused (400)', r.status === 400 && /only 12/i.test(msg(r)), `${r.status} ${msg(r)}`);
    check('…and stock is unchanged', (await stockOf(st, S_, soap._id)) === 12);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: 1.5 });
    check('half a piece refused (400)', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: 2, reason: 'damage' });
    check('damage that adds stock refused (400)', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: 0 });
    check('zero refused (400)', r.status === 400, `${r.status}`);

    suite('stock:loose-goods');
    await api('POST', `${S_}/products/${sugar._id}/adjust-stock`, st, { quantity: 0.1 });
    await api('POST', `${S_}/products/${sugar._id}/adjust-stock`, st, { quantity: 0.2 });
    check('0.1 kg + 0.2 kg = exactly 0.3 kg', (await stockOf(st, S_, sugar._id)) === 0.3, await stockOf(st, S_, sugar._id));
    r = await api('POST', `${S_}/products/${sugar._id}/adjust-stock`, st, { quantity: 2.25 });
    check('2.25 kg allowed', r.status === 200 && d(r)?.currentStock === 2.55, `${r.status} ${d(r)?.currentStock}`);

    suite('stock:count');
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { countedStock: 20, note: 'Monthly count' });
    check('count 20 sets stock to 20', r.status === 200 && d(r)?.currentStock === 20, `${r.status} ${d(r)?.currentStock} ${msg(r)}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { countedStock: 20 });
    check('same count again changes nothing', r.status === 200 && /already matches/i.test(r.json?.message || ''), `${r.status} ${r.json?.message}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { countedStock: 0 });
    check('count 0 empties it', r.status === 200 && d(r)?.currentStock === 0 && d(r)?.isLowStock === true, `${r.status} ${d(r)?.currentStock} low=${d(r)?.isLowStock}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { countedStock: -1 });
    check('negative count refused (400)', r.status === 400, `${r.status}`);
    await api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { countedStock: 10 });

    suite('stock:race');
    // 20 people remove 1 each at the same moment from 10 in stock: exactly 10 may succeed.
    const tries = await Promise.all(Array.from({ length: 20 }, () => api('POST', `${S_}/products/${soap._id}/adjust-stock`, st, { quantity: -1 })));
    const ok = tries.filter((x) => x.status === 200).length;
    check('exactly 10 of 20 removals succeed', ok === 10, `${ok} succeeded`);
    check('stock ends at 0, never below', (await stockOf(st, S_, soap._id)) === 0, await stockOf(st, S_, soap._id));

    suite('stock:history');
    r = await api('GET', `${S_}/products/${soap._id}/movements`, st);
    const mv = d(r)?.movements || [];
    check('history lists every change, newest first', mv.length >= 16 && new Date(mv[0].createdAt) >= new Date(mv[mv.length - 1].createdAt), `${mv.length}`);
    check('count entry notes the count', mv.some((m) => m.reason === 'adjustment' && /Counted 20 pcs — Monthly count/.test(m.note || '')), JSON.stringify(mv.slice(-4)));
    check('damage entry is negative', mv.some((m) => m.reason === 'damage' && m.quantity === -3), '');
    const staff = await api('POST', '/staff', st, { name: 'Stock Cashier', mobile: '9822255001', role: 'cashier', password: 'Staff@123' });
    const cashier = await login('9822255001', 'Staff@123');
    r = await api('GET', `${S_}/products/${soap._id}/movements`, cashier);
    check('cashier can see stock history', r.status === 200, `${r.status}`);
    r = await api('POST', `${S_}/products/${soap._id}/adjust-stock`, cashier, { quantity: 5 });
    check('cashier cannot adjust stock (403)', r.status === 403, `${r.status}`);
    await api('DELETE', `/staff/${d(staff)._id}`, st);

    // ── Wholesale orders ──
    const W = '/wholesaler';
    r = await api('POST', `${W}/products`, ws, { name: 'Edit Rice', sku: 'ER1', hsn: '1006', sellPrice: 60, wholesalePrice: 50, costPrice: 40, gstRate: 5, unit: 'kg', currentStock: 1000 });
    const rice = d(r);
    r = await api('POST', `${W}/products`, ws, { name: 'Edit Dal', sku: 'ED1', hsn: '0713', sellPrice: 120, wholesalePrice: 100, costPrice: 80, gstRate: 0, unit: 'kg', currentStock: 500 });
    const dal = d(r);
    r = await api('POST', `${W}/dealers`, ws, { name: 'Edit Dealer', mobile: '9822255002', tier: 'B' });
    const dealer = d(r);
    r = await api('POST', `${W}/orders`, ws, { dealerId: dealer._id, items: [{ productId: rice._id, quantity: 100 }], source: 'manual', paidAmount: 1000, paymentMode: 'cash' });
    let order = d(r);

    suite('orders:edit');
    check('setup: order with ₹1000 advance', order?.paidAmount === 1000 && order?.status === 'pending', `${order?.paidAmount} ${order?.status}`);
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [{ productId: rice._id, quantity: 60 }, { productId: dal._id, quantity: 10 }] });
    const edited = d(r);
    check('edit items (200)', r.status === 200 && edited.items.length === 2, `${r.status} ${msg(r)}`);
    check('re-priced: total = sum of new lines', edited && near(edited.total, edited.items.reduce((s, i) => s + i.lineTotal, 0)), `${edited?.total}`);
    check('advance kept; due = total − paid', edited && edited.paidAmount === 1000 && near(edited.dueAmount, edited.total - 1000), `${edited?.paidAmount} ${edited?.dueAmount}`);
    check('same order number', edited?.orderNo === order.orderNo);
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [{ productId: dal._id, quantity: 1 }] });
    check('new total below what was paid is refused (400)', r.status === 400 && /already paid/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [] });
    check('no items refused (400)', r.status === 400, `${r.status}`);
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [{ productId: rice._id, quantity: 60 }, { productId: dal._id, quantity: 10 }] });
    await api('PATCH', `${W}/orders/${order._id}/status`, ws, { status: 'confirmed' });
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [{ productId: rice._id, quantity: 70 }, { productId: dal._id, quantity: 10 }] });
    check('confirmed orders can still be edited', r.status === 200 && d(r).items[0].quantity === 70, `${r.status} ${msg(r)}`);
    const riceBefore = await stockOf(ws, W, rice._id);
    r = await api('PATCH', `${W}/orders/${order._id}/status`, ws, { status: 'dispatched' });
    check('dispatch takes the edited quantities', r.status === 200 && near(riceBefore - (await stockOf(ws, W, rice._id)), 70), `${riceBefore} → ${await stockOf(ws, W, rice._id)}`);
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [{ productId: rice._id, quantity: 1 }] });
    check('dispatched orders cannot be edited (400)', r.status === 400 && /return/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('orders:cancel');
    const riceMid = await stockOf(ws, W, rice._id);
    r = await api('PATCH', `${W}/orders/${order._id}/status`, ws, { status: 'cancelled' });
    order = d(r);
    check('cancel a dispatched order', r.status === 200 && order.status === 'cancelled' && order.dueAmount === 0, `${r.status} ${order?.status} due=${order?.dueAmount}`);
    check('…its goods go back into stock', near((await stockOf(ws, W, rice._id)) - riceMid, 70), `${riceMid} → ${await stockOf(ws, W, rice._id)}`);
    check('…and the advance stays recorded as paid', order.paidAmount === 1000, order.paidAmount);
    r = await api('PATCH', `${W}/orders/${order._id}`, ws, { items: [{ productId: rice._id, quantity: 1 }] });
    check('cancelled orders cannot be edited (400)', r.status === 400, `${r.status}`);
    r = await api('POST', `${W}/orders`, ws, { dealerId: dealer._id, items: [{ productId: dal._id, quantity: 5 }], source: 'manual' });
    const o2 = d(r);
    await api('PATCH', `${W}/orders/${o2._id}/status`, ws, { status: 'delivered' });
    r = await api('PATCH', `${W}/orders/${o2._id}/status`, ws, { status: 'cancelled' });
    check('delivered orders cannot be cancelled (400)', r.status === 400 && /return/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('orders:roles');
    const hire = async (role, mobile) => { const h = await api('POST', '/staff', ws, { name: `Order ${role}`, mobile, role, password: 'Staff@123' }); return { id: d(h)._id, tok: await login(mobile, 'Staff@123') }; };
    const rep = await hire('salesStaff', '9822255003');
    const wh = await hire('warehouse', '9822255004');
    r = await api('POST', `${W}/orders`, ws, { dealerId: dealer._id, items: [{ productId: dal._id, quantity: 3 }], source: 'manual' });
    const o3 = d(r);
    r = await api('PATCH', `${W}/orders/${o3._id}`, rep.tok, { items: [{ productId: dal._id, quantity: 4 }] });
    check('sales rep can edit an order', r.status === 200, `${r.status}`);
    r = await api('PATCH', `${W}/orders/${o3._id}`, wh.tok, { items: [{ productId: dal._id, quantity: 5 }] });
    check('warehouse cannot edit an order (403)', r.status === 403, `${r.status}`);
    r = await api('PATCH', `${W}/orders/${o3._id}/status`, rep.tok, { status: 'cancelled' });
    check('sales rep cannot cancel (403)', r.status === 403, `${r.status}`);
    r = await api('PATCH', `${W}/orders/${o3._id}/status`, wh.tok, { status: 'cancelled' });
    check('warehouse can cancel', r.status === 200, `${r.status}`);
    for (const x of [rep, wh]) await api('DELETE', `/staff/${x.id}`, ws);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ STOCK / ORDERS ============');
    for (const [k, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${k}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
