/**
 * Suppliers and purchase orders: receiving and paying are safe when tapped
 * twice or from two phones, the supplier's balance always equals its POs' dues,
 * overpayments are refused, a supplier who is owed money can't be removed, and
 * a pending PO can be cancelled.
 *
 *   npm run seed:reset && npm run test:purchases
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
const K = '/shopkeeper';

(async () => {
    const st = d(await api('POST', '/auth/password-login', null, { mobile: '9000000001', password: 'whoply123' }))?.token;
    const stockOf = async (id) => d(await api('GET', `${K}/products/${id}`, st))?.currentStock;
    const supplierOf = async (id) => (d(await api('GET', `${K}/suppliers`, st)) || []).find((s) => s._id === id);
    const posOf = async (supplierId) => (d(await api('GET', `${K}/purchases?limit=100`, st))?.items || []).filter((p) => p.supplierId === supplierId);
    const po = async (supplierId, items, paidAmount = 0) => api('POST', `${K}/purchases`, st, { supplierId, items, paidAmount });
    const balanceMatches = async (sup) => {
        const s = await supplierOf(sup._id);
        const dues = (await posOf(sup._id)).filter((p) => p.status !== 'cancelled').reduce((a, p) => a + p.dueAmount, 0);
        return { ok: s && near(s.payableBalance, dues), s: s?.payableBalance, dues: +dues.toFixed(2) };
    };

    suite('setup');
    const prod = d(await api('POST', `${K}/products`, st, { name: 'PO Soap', sku: 'POS1', sellPrice: 40, costPrice: 25, gstRate: 18, unit: 'pcs', currentStock: 0 }));
    let r = await api('POST', `${K}/suppliers`, st, { name: 'Sneaky Supplier', payableBalance: 50000, isActive: false });
    const sup = d(r);
    check('new supplier ignores balance / active sent in the request', r.status === 201 && sup?.payableBalance === 0 && sup?.isActive !== false, JSON.stringify({ bal: sup?.payableBalance, active: sup?.isActive }));

    suite('receive');
    const p1 = d(await po(sup._id, [{ productId: prod._id, quantity: 10, costPrice: 25 }]));
    const recv = await Promise.all(Array.from({ length: 5 }, () => api('POST', `${K}/purchases/${p1._id}/receive`, st)));
    check('5 taps on Receive at once → received once', recv.filter((x) => x.status === 200).length === 1 && recv.filter((x) => x.status === 400).length === 4, recv.map((x) => x.status).join(','));
    check('…stock goes up by 10, not 50', (await stockOf(prod._id)) === 10, `${await stockOf(prod._id)}`);
    r = await api('POST', `${K}/purchases/${p1._id}/receive`, st);
    check('receiving again says already received', r.status === 400 && /already received/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('supplier balance = POs due');
    await Promise.all(Array.from({ length: 5 }, () => po(sup._id, [{ productId: prod._id, quantity: 4, costPrice: 25 }])));
    let bal = await balanceMatches(sup);
    check('5 POs made at once all count on the balance', bal.ok && near(bal.s, 250 + 100 * 5), JSON.stringify(bal));
    const p2 = d(await po(sup._id, [{ productId: prod._id, quantity: 40, costPrice: 25 }])); // due 1000
    const pays = await Promise.all([api('POST', `${K}/purchases/${p2._id}/payment`, st, { amount: 600 }), api('POST', `${K}/purchases/${p2._id}/payment`, st, { amount: 600 })]);
    const p2now = (await posOf(sup._id)).find((x) => x._id === p2._id);
    check('two ₹600 payments at once on a ₹1000 due → one goes in, one refused', pays.filter((x) => x.status === 200).length === 1 && near(p2now.paidAmount, 600) && near(p2now.dueAmount, 400), `${pays.map((x) => `${x.status} ${msg(x)}`).join(' | ')} → paid ${p2now.paidAmount} due ${p2now.dueAmount}`);
    bal = await balanceMatches(sup);
    check('…and the supplier balance still equals the POs due', bal.ok, JSON.stringify(bal));

    suite('overpaying');
    r = await api('POST', `${K}/purchases/${p2._id}/payment`, st, { amount: 1500 });
    check('paying more than the due is refused (not cut down silently)', r.status === 400 && /more than/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await po(sup._id, [{ productId: prod._id, quantity: 2, costPrice: 25 }], 80);
    check('"paid now" more than the PO total is refused', r.status === 400 && /more than/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('cancel a pending PO');
    const p3 = d(await po(sup._id, [{ productId: prod._id, quantity: 8, costPrice: 25 }])); // due 200
    const before = (await supplierOf(sup._id)).payableBalance;
    r = await api('POST', `${K}/purchases/${p3._id}/cancel`, st);
    check('cancel works', r.status === 200 && d(r)?.status === 'cancelled', `${r.status} ${msg(r)}`);
    check('…and takes its due off the supplier', near((await supplierOf(sup._id)).payableBalance, before - 200), `${before} → ${(await supplierOf(sup._id)).payableBalance}`);
    r = await api('POST', `${K}/purchases/${p3._id}/receive`, st);
    check('a cancelled PO can not be received', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${K}/purchases/${p3._id}/payment`, st, { amount: 10 });
    check('…or paid', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${K}/purchases/${p1._id}/cancel`, st);
    check('a received PO can not be cancelled', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${K}/purchases/${p2._id}/cancel`, st);
    check('a PO with money already paid can not be cancelled', r.status === 400 && /paid/i.test(msg(r)), `${r.status} ${msg(r)}`);
    bal = await balanceMatches(sup);
    check('supplier balance still equals the POs due', bal.ok, JSON.stringify(bal));

    suite('removing a supplier');
    r = await api('DELETE', `${K}/suppliers/${sup._id}`, st);
    check('a supplier you still owe can not be removed', r.status === 400 && /owe/i.test(msg(r)), `${r.status} ${msg(r)}`);
    const other = d(await api('POST', `${K}/suppliers`, st, { name: 'Paid Off Supplier' }));
    r = await api('DELETE', `${K}/suppliers/${other._id}`, st);
    check('a supplier with nothing owed can be removed', r.status === 200, `${r.status} ${msg(r)}`);
    r = await po(other._id, [{ productId: prod._id, quantity: 1, costPrice: 25 }]);
    check('no new PO for a removed supplier', r.status === 400, `${r.status} ${msg(r)}`);

    suite('checks on input');
    r = await api('PATCH', `${K}/suppliers/${sup._id}`, st, { name: '   ' });
    check('a blank supplier name is refused', r.status === 400, `${r.status} ${msg(r)}`);
    const gone = d(await api('POST', `${K}/products`, st, { name: 'Removed Item', sku: 'RM1', sellPrice: 10, costPrice: 5, gstRate: 0, unit: 'pcs', currentStock: 0 }));
    await api('DELETE', `${K}/products/${gone._id}`, st);
    r = await po(sup._id, [{ productId: gone._id, quantity: 1, costPrice: 5 }]);
    check('a removed product can not go on a PO', r.status === 400, `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ PURCHASES ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
