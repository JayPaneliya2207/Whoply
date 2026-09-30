/**
 * Estimates (quotations) and bills: converting is safe when tapped twice,
 * stock never goes below zero (POS or convert), convert records how it was
 * paid, estimates expire after 15 days, another shop's customer can't be used,
 * loyalty points on every bill, converted estimates can't be deleted, and the
 * rep who made a dealer estimate gets the order.
 * Needs MONGODB_URI (the API's database) to age one estimate past its expiry.
 *
 *   npm run seed:reset && npm run test:quotes
 */
import mongoose from 'mongoose';

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
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;
const K = '/shopkeeper';
const W = '/wholesaler';

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');
    const adm = await login('9000000099');
    const stockOf = async (id) => d(await api('GET', `${K}/products/${id}`, st))?.currentStock;
    const product = async (name, stock, price = 100) => d(await api('POST', `${K}/products`, st, { name, sku: name.replace(/\W/g, '') + Date.now(), sellPrice: price, costPrice: price / 2, gstRate: 0, unit: 'pcs', currentStock: stock }));
    const quote = (body) => api('POST', `${K}/quotations`, st, body);
    const customerByMobile = async (m) => (d(await api('GET', `${K}/customers?limit=100&search=${m}`, st))?.items || []).find((c) => c.mobile === m);

    suite('validity');
    const soap = await product('Q Soap', 10);
    let r = await quote({ items: [{ productId: soap._id, quantity: 1 }] });
    const days = (new Date(d(r)?.validUntil) - Date.now()) / 86400000;
    check('a new estimate is valid about 15 days by default', r.status === 201 && days > 15 && days <= 16.01, `${r.status} ${days.toFixed(2)} days`);
    for (const bad of [0, -3, 'abc', 400]) {
        r = await quote({ items: [{ productId: soap._id, quantity: 1 }], validDays: bad });
        check(`validDays ${JSON.stringify(bad)} is refused`, r.status === 400, `${r.status} ${msg(r)}`);
    }
    const old = d(await quote({ items: [{ productId: soap._id, quantity: 1 }] }));
    if (process.env.MONGODB_URI) {
        const conn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
        await conn.db.collection('quotations').updateOne({ _id: new mongoose.Types.ObjectId(old._id) }, { $set: { validUntil: new Date(Date.now() - 60_000) } });
        await conn.close();
        r = await api('POST', `${K}/quotations/${old._id}/convert`, st, { paymentMode: 'cash' });
        check('an expired estimate can not be converted', r.status === 400 && /expired/i.test(msg(r)), `${r.status} ${msg(r)}`);
    } else check('an expired estimate can not be converted (skipped: no MONGODB_URI)', true);

    suite('convert once');
    const q1 = d(await quote({ items: [{ productId: soap._id, quantity: 2 }] }));
    const before = await stockOf(soap._id);
    const conv = await Promise.all(Array.from({ length: 3 }, () => api('POST', `${K}/quotations/${q1._id}/convert`, st, { paymentMode: 'cash' })));
    check('3 taps on Convert at once → one bill', conv.filter((x) => x.status === 201).length === 1 && conv.filter((x) => x.status === 400).length === 2, conv.map((x) => x.status).join(','));
    check('…stock taken once (−2)', (await stockOf(soap._id)) === before - 2, `${before} → ${await stockOf(soap._id)}`);
    r = await api('DELETE', `${K}/quotations/${q1._id}`, st);
    check('a converted estimate can not be deleted', r.status === 400, `${r.status} ${msg(r)}`);
    const q2 = d(await quote({ items: [{ productId: soap._id, quantity: 1 }] }));
    r = await api('DELETE', `${K}/quotations/${q2._id}`, st);
    check('an open estimate can be deleted', r.status === 200, `${r.status} ${msg(r)}`);

    suite('stock never below zero');
    const lastTwo = await product('Last Two', 2, 10);
    const sales = await Promise.all(Array.from({ length: 5 }, () => api('POST', `${K}/billing`, st, { items: [{ productId: lastTwo._id, quantity: 1 }], paymentMode: 'cash' })));
    check('5 tills sell the last 2 at once → 2 sales', sales.filter((x) => x.status === 201).length === 2, sales.map((x) => x.status).join(','));
    check('…stock ends at 0', (await stockOf(lastTwo._id)) === 0, `${await stockOf(lastTwo._id)}`);
    const five = await product('Five Left', 5, 10);
    const qd = d(await quote({ items: [{ productId: five._id, quantity: 3 }, { productId: five._id, quantity: 3 }] }));
    r = await api('POST', `${K}/quotations/${qd._id}/convert`, st, { paymentMode: 'cash' });
    check('an estimate with 3 + 3 of an item with 5 left is refused', r.status === 400 && /not enough stock/i.test(msg(r)), `${r.status} ${msg(r)}`);
    check('…stock untouched, estimate still open', (await stockOf(five._id)) === 5 && d(await api('GET', `${K}/quotations/${qd._id}`, st))?.status === 'open', `${await stockOf(five._id)}`);

    suite('how it was paid');
    const rice = await product('Q Rice', 50, 250);
    const qp = d(await quote({ items: [{ productId: rice._id, quantity: 4 }], walkInName: 'Split Buyer', walkInMobile: '+91 98111 22334' }));
    check('mobile saved as 10 digits', qp.customerMobile === '9811122334', qp.customerMobile);
    r = await api('POST', `${K}/quotations/${qp._id}/convert`, st, { payments: [{ mode: 'cash', amount: 300 }, { mode: 'upi', amount: 200 }] });
    const inv = d(r);
    check('split convert: cash 300 + UPI 200, rest 500 on udhar', r.status === 201 && inv.paymentMode === 'split' && near(inv.paidAmount, 500) && near(inv.dueAmount, 500), `${r.status} ${msg(r)} ${inv?.paymentMode} ${inv?.paidAmount}/${inv?.dueAmount}`);
    const buyer = await customerByMobile('9811122334');
    check('…udhar and loyalty points on the customer', buyer && near(buyer.creditBalance, 500) && buyer.loyaltyPoints === 10, JSON.stringify({ bal: buyer?.creditBalance, pts: buyer?.loyaltyPoints }));
    const qn = d(await quote({ items: [{ productId: rice._id, quantity: 1 }] }));
    r = await api('POST', `${K}/quotations/${qn._id}/convert`, st, { paymentMode: 'credit' });
    check('udhar without a customer mobile is refused', r.status === 400 && /mobile/i.test(msg(r)), `${r.status} ${msg(r)}`);
    check('…and the estimate stays open', d(await api('GET', `${K}/quotations/${qn._id}`, st))?.status === 'open');

    suite('loyalty on every bill');
    r = await api('POST', `${K}/billing`, st, { items: [{ productId: rice._id, quantity: 2 }], paymentMode: 'cash', walkInName: 'Cash Buyer', walkInMobile: '9811122335' });
    const cashBuyer = await customerByMobile('9811122335');
    check('a cash bill of ₹500 gives 5 points', r.status === 201 && cashBuyer?.loyaltyPoints === 5 && near(cashBuyer?.creditBalance, 0), JSON.stringify({ s: r.status, pts: cashBuyer?.loyaltyPoints, bal: cashBuyer?.creditBalance }));
    await Promise.all(Array.from({ length: 4 }, () => api('POST', `${K}/billing`, st, { items: [{ productId: rice._id, quantity: 1 }], paymentMode: 'credit', walkInMobile: '9811122335' })));
    const after4 = await customerByMobile('9811122335');
    check('4 udhar bills at once all land on the balance (₹1000)', near(after4?.creditBalance, 1000) && after4?.loyaltyPoints === 5 + 4 * 2, JSON.stringify({ bal: after4?.creditBalance, pts: after4?.loyaltyPoints }));

    suite("customer details");
    const gstCust = d(await api('POST', `${K}/customers`, st, { name: 'GST Trader', mobile: '9811122336', gstin: '24AAACG1234A1Z5' }));
    const qg = d(await quote({ customerId: gstCust?._id, items: [{ productId: rice._id, quantity: 1 }] }));
    r = await api('POST', `${K}/quotations/${qg._id}/convert`, st, { paymentMode: 'cash' });
    check("the bill carries the customer's saved GSTIN", r.status === 201 && d(r)?.customerGstin === '24AAACG1234A1Z5', `${r.status} ${d(r)?.customerGstin} ${msg(r)}`);
    const got = d(await api('GET', `${K}/quotations/${qg._id}`, st));
    check('an estimate does not send bank details or settings', got?.business?.name && !('settings' in got.business) && !Object.keys(got.business).some((k) => /bank|account|ifsc/i.test(k)), Object.keys(got?.business || {}).join(','));
    // Another shop's customer id
    r = await api('POST', '/admin/businesses', adm, { name: 'Other Shop', type: 'retail', ownerName: 'Other Owner', mobile: '9811177001', password: 'other123' });
    const other = await login('9811177001', 'other123');
    const theirs = d(await api('POST', `${K}/customers`, other, { name: 'Their Customer', mobile: '9811177002' }));
    r = await quote({ customerId: theirs?._id, items: [{ productId: rice._id, quantity: 1 }] });
    check("another shop's customer can not be put on an estimate", r.status === 400 && /customer not found/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('dealer estimates');
    const rep = d(await api('POST', '/staff', ws, { name: 'Quote Rep', mobile: '9811188001', role: 'salesStaff', password: 'Staff@123' }));
    const repTok = await login('9811188001', 'Staff@123');
    const dealer = d(await api('POST', `${W}/dealers`, ws, { name: 'Quote Dealer', mobile: '9811188002' }));
    const wprod = d(await api('POST', `${W}/products`, ws, { name: 'Q Oil', sku: 'QO' + Date.now(), sellPrice: 200, wholesalePrice: 150, costPrice: 100, gstRate: 5, unit: 'pcs', currentStock: 100 }));
    r = await api('POST', `${W}/quotations`, repTok, { dealerId: dealer._id, items: [{ productId: wprod._id, quantity: 10 }] });
    const wq = d(r);
    check('a sales rep can make a dealer estimate', r.status === 201 && wq?.status === 'open', `${r.status} ${msg(r)}`);
    const wconv = await Promise.all(Array.from({ length: 3 }, () => api('POST', `${W}/quotations/${wq._id}/convert`, ws, {})));
    const order = d(wconv.find((x) => x.status === 201));
    check('3 taps on Convert at once → one order', wconv.filter((x) => x.status === 201).length === 1, wconv.map((x) => x.status).join(','));
    check('the order counts for the rep who made the estimate', order && String(order.salesRepId) === String(rep?._id), `${order?.salesRepId} vs ${rep?._id}`);
    r = await api('POST', `${K}/quotations/${wq._id}/convert`, ws, { paymentMode: 'cash' });
    check('a dealer estimate can not be billed through the shop convert', r.status === 404 || r.status === 403, `${r.status} ${msg(r)}`);
    await api('PATCH', `${W}/orders/${order._id}/status`, ws, { status: 'cancelled' }); // a dealer who owes can't be removed
    r = await api('DELETE', `${W}/dealers/${dealer._id}`, ws);
    check('the dealer is removed once nothing is owed', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('POST', `${W}/quotations`, ws, { dealerId: dealer._id, items: [{ productId: wprod._id, quantity: 1 }] });
    check('no estimate for a removed dealer', r.status === 400, `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ ESTIMATES & BILLS ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
