/**
 * GST on purchases: GST worked out on purchase orders (before-GST prices or the
 * "prices include GST" switch), IGST for other-state suppliers, input tax credit
 * in the GST report for the month the goods were received (registered suppliers
 * only), the supplier's bill number/date, "GST to pay" after credit, and the same
 * for wholesalers. Needs MONGODB_URI (the API's database) to move dates back a month.
 *
 *   npm run seed:reset && npm run test:purchasegst
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
function gstin(state, pan) {
    const cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const body = `${state}${pan}1Z`;
    let s = 0;
    for (let i = 0; i < body.length; i++) { const p = cs.indexOf(body[i]) * (i % 2 ? 2 : 1); s += Math.floor(p / 36) + (p % 36); }
    return body + cs[(36 - (s % 36)) % 36];
}
const ist = new Date(Date.now() + 330 * 60000);
const THIS_MONTH = ist.toISOString().slice(0, 7);
const lastMonthDate = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 15, 6));
const LAST_MONTH = lastMonthDate.toISOString().slice(0, 7);
const K = '/shopkeeper';
const W = '/wholesaler';

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');
    const conn = process.env.MONGODB_URI ? await mongoose.createConnection(process.env.MONGODB_URI).asPromise() : null;
    const setDates = async (poId, set) => conn && conn.db.collection('purchase_orders').updateOne({ _id: new mongoose.Types.ObjectId(poId) }, { $set: set });

    suite('setup');
    await api('PATCH', `${K}/business`, st, { gstin: gstin('24', 'AAACS1111P') });
    const product = async (name, rate, cost) => d(await api('POST', `${K}/products`, st, { name, sku: name.replace(/\W/g, '') + Date.now(), sellPrice: cost * 2, costPrice: cost, gstRate: rate, hsn: '3401', unit: 'pcs', currentStock: 0 }));
    const soap = await product('PG Soap', 18, 100);
    const rice = await product('PG Rice', 5, 50);
    let r = await api('POST', `${K}/suppliers`, st, { name: 'Bad GSTIN', gstin: '24ABCDE12' });
    check('a malformed supplier GSTIN is refused', r.status === 400, `${r.status} ${msg(r)}`);
    const local = d(await api('POST', `${K}/suppliers`, st, { name: 'Local Supplier', gstin: gstin('24', 'AAACL2222L') }));
    const far = d(await api('POST', `${K}/suppliers`, st, { name: 'Far Supplier', gstin: gstin('27', 'AAACF3333F') }));
    const unreg = d(await api('POST', `${K}/suppliers`, st, { name: 'Unregistered Supplier' }));
    check('three suppliers', local?._id && far?._id && unreg?._id);
    const po = (supplierId, items, extra = {}) => api('POST', `${K}/purchases`, st, { supplierId, items, ...extra });

    suite('GST on the order');
    r = await po(local._id, [{ productId: soap._id, quantity: 10, costPrice: 100 }]);
    const p1 = d(r);
    check('cost before GST: 10 × ₹100 at 18% → ₹1,000 + ₹180 = ₹1,180', r.status === 201 && near(p1.subtotal, 1000) && near(p1.totalGst, 180) && near(p1.total, 1180) && p1.interState === false, JSON.stringify({ s: p1?.subtotal, g: p1?.totalGst, t: p1?.total }));
    check('…the line carries rate, taxable value and GST', p1.items[0].gstRate === 18 && near(p1.items[0].taxableValue, 1000) && near(p1.items[0].gstAmount, 180));
    check('…and the supplier is owed ₹1,180 (GST included)', near(d(await api('GET', `${K}/suppliers`, st)).find((s) => s._id === local._id).payableBalance, 1180));
    r = await po(local._id, [{ productId: soap._id, quantity: 10, costPrice: 118 }], { pricesIncludeGst: true });
    const p2 = d(r);
    check('"prices include GST": 10 × ₹118 → ₹1,000 + ₹180', r.status === 201 && near(p2.subtotal, 1000) && near(p2.totalGst, 180) && near(p2.total, 1180), JSON.stringify({ s: p2?.subtotal, g: p2?.totalGst }));
    r = await po(far._id, [{ productId: rice._id, quantity: 20, costPrice: 50 }]);
    const p3 = d(r);
    check('supplier in another state → IGST (₹1,000 + ₹50)', r.status === 201 && p3.interState === true && near(p3.totalGst, 50), JSON.stringify({ i: p3?.interState, g: p3?.totalGst }));
    const p4 = d(await po(unreg._id, [{ productId: soap._id, quantity: 1, costPrice: 100 }]));
    const p5 = d(await po(local._id, [{ productId: soap._id, quantity: 1, costPrice: 100 }])); // stays pending
    const p6 = d(await po(local._id, [{ productId: soap._id, quantity: 1, costPrice: 100 }])); // cancelled
    await api('POST', `${K}/purchases/${p6._id}/cancel`, st);

    suite("supplier's bill");
    r = await api('POST', `${K}/purchases/${p1._id}/receive`, st, { supplierInvoiceNo: 'THIS-NUMBER-IS-TOO-LONG', supplierInvoiceDate: ist.toISOString().slice(0, 10) });
    check('a bill number over 16 characters is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${K}/purchases/${p1._id}/receive`, st, { supplierInvoiceNo: 'INV-77', supplierInvoiceDate: '2099-01-01' });
    check('a future bill date is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `${K}/purchases/${p1._id}/receive`, st, { supplierInvoiceNo: 'INV-77', supplierInvoiceDate: ist.toISOString().slice(0, 10) });
    check('receive with the supplier bill number and date', r.status === 200 && d(r)?.supplierInvoiceNo === 'INV-77', `${r.status} ${msg(r)}`);
    await api('POST', `${K}/purchases/${p2._id}/receive`, st);
    r = await api('PATCH', `${K}/purchases/${p2._id}/bill`, st, { supplierInvoiceNo: 'LS/88' });
    check('the bill number can be added later', r.status === 200 && d(r)?.supplierInvoiceNo === 'LS/88', `${r.status} ${msg(r)}`);
    await api('POST', `${K}/purchases/${p3._id}/receive`, st, { supplierInvoiceNo: 'FS-1' });
    await api('POST', `${K}/purchases/${p4._id}/receive`, st);

    suite('input tax credit in the GST report');
    // An order made last month but received now counts this month; one received last month does not.
    const old = d(await po(local._id, [{ productId: rice._id, quantity: 10, costPrice: 100 }])); // ₹1,000 + ₹50
    await setDates(old._id, { createdAt: lastMonthDate });
    await api('POST', `${K}/purchases/${old._id}/receive`, st, { supplierInvoiceNo: 'OLD-1' });
    const early = d(await po(local._id, [{ productId: soap._id, quantity: 2, costPrice: 100 }]));
    await api('POST', `${K}/purchases/${early._id}/receive`, st, { supplierInvoiceNo: 'EARLY-1' });
    await setDates(early._id, { receivedAt: lastMonthDate });
    const g = d(await api('GET', `${K}/reports/gst?month=${THIS_MONTH}`, st));
    const itc = g?.itc;
    const expected = conn ? { cgst: 90 + 90 + 25, sgst: 90 + 90 + 25, igst: 50, bills: 4 } : null;
    check('credit = received this month from registered suppliers (not pending, cancelled or unregistered)', itc && (!expected || (near(itc.cgst, expected.cgst) && near(itc.sgst, expected.sgst) && near(itc.igst, expected.igst) && itc.bills === expected.bills)), JSON.stringify(itc && { b: itc.bills, c: itc.cgst, s: itc.sgst, i: itc.igst }));
    check('GST paid to the unregistered supplier is listed as "no credit"', itc?.noCredit?.bills === 1 && near(itc.noCredit.gst, 18), JSON.stringify(itc?.noCredit));
    check('each bill shows supplier GSTIN, bill number and tax', itc?.list?.some((b) => b.supplierInvoiceNo === 'INV-77' && b.supplierGstin === local.gstin && near(b.cgst, 90)), JSON.stringify(itc?.list?.[0]));
    check('rate-wise credit (5% and 18%)', itc?.rateWise?.map((x) => x.rate).join() === '5,18', JSON.stringify(itc?.rateWise));
    if (conn) {
        const gl = d(await api('GET', `${K}/reports/gst?month=${LAST_MONTH}`, st));
        check("an order received last month is in last month's credit, not this month's", gl?.itc?.list?.some((b) => b.supplierInvoiceNo === 'EARLY-1') && !itc.list.some((b) => b.supplierInvoiceNo === 'EARLY-1'), JSON.stringify(gl?.itc?.list?.map((b) => b.supplierInvoiceNo)));
    } else check('(month checks skipped: no MONGODB_URI)', true);

    suite('GST to pay');
    const pay = g?.gstToPay;
    const out = { igst: g.summary.igst, cgst: g.summary.cgst, sgst: g.summary.sgst };
    const used = itc.total - pay.carryForward.total;
    check('to pay = tax on sales − credit used', near(pay.payable.total, out.igst + out.cgst + out.sgst - used), JSON.stringify({ out, pay }));
    check('credit never makes a head negative', ['igst', 'cgst', 'sgst'].every((h) => pay.payable[h] >= 0 && pay.carryForward[h] >= 0), JSON.stringify(pay));

    suite('wholesalers');
    const wsSup = d(await api('POST', `${W}/suppliers`, ws, { name: 'Mill', gstin: gstin('24', 'AAACM4444M') }));
    const oil = d(await api('POST', `${W}/products`, ws, { name: 'PG Oil', sku: 'PGO' + Date.now(), sellPrice: 200, wholesalePrice: 150, costPrice: 100, gstRate: 5, unit: 'pcs', currentStock: 0 }));
    r = await api('POST', `${W}/purchases`, ws, { supplierId: wsSup?._id, items: [{ productId: oil._id, quantity: 100, costPrice: 100 }] });
    const wpo = d(r);
    check('a wholesaler can make a purchase order', r.status === 201 && near(wpo?.totalGst, 500), `${r.status} ${msg(r)}`);
    r = await api('POST', `${W}/purchases/${wpo._id}/receive`, ws, { supplierInvoiceNo: 'MILL-9' });
    check('…receive it (stock comes in)', r.status === 200 && d(await api('GET', `${W}/products/${oil._id}`, ws))?.currentStock === 100, `${r.status} ${msg(r)}`);
    const wg = d(await api('GET', `${W}/reports/gst?month=${THIS_MONTH}`, ws));
    check("…and the credit is in the wholesaler's GST report", wg?.itc?.bills >= 1 && wg.itc.list.some((b) => b.supplierInvoiceNo === 'MILL-9' && near(b.gst, 500)) && wg.gstToPay, JSON.stringify(wg?.itc && { b: wg.itc.bills, t: wg.itc.total }));
    await api('POST', '/staff', ws, { name: 'PG Rep', mobile: '9844466001', role: 'salesStaff', password: 'Staff@123' });
    const rep = await login('9844466001', 'Staff@123');
    r = await api('POST', `${W}/purchases`, rep, { supplierId: wsSup._id, items: [{ productId: oil._id, quantity: 1 }] });
    check('a sales rep can not make purchase orders', r.status === 403, `${r.status}`);

    if (conn) await conn.close();
    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ GST ON PURCHASES ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
