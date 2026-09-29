/**
 * Money & GST fixes: IGST for other-state buyers, salary counted once, udhar
 * repayments clearing bills, day-close udhar given, India-time dates.
 *
 *   npm run seed:reset && npm run test:money
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
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const near = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.011;
async function login(mobile) {
    const r = await api('POST', '/auth/password-login', null, { mobile, password: 'whoply123' });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status}`);
    return r.json.data.token;
}
/** A valid GSTIN (with checksum) for a state code. */
function gstin(state, pan) {
    const cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const body = `${state}${pan}1Z`;
    let sum = 0;
    for (let i = 0; i < body.length; i++) { const p = cs.indexOf(body[i]) * (i % 2 ? 2 : 1); sum += Math.floor(p / 36) + (p % 36); }
    return body + cs[(36 - (sum % 36)) % 36];
}
/** Today's date in India time, YYYY-MM-DD / YYYYMM. */
const ist = new Date(Date.now() + 330 * 60000);
const IST_YMD = ist.toISOString().slice(0, 10);
const IST_YM = IST_YMD.slice(0, 7).replace('-', '');

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');
    // Give both demo businesses a Gujarat GSTIN (a fresh reset has none, and a shop
    // without a GSTIN charges no IGST at all).
    await api('PATCH', '/shopkeeper/business', st, { gstin: gstin('24', 'AAACW1234Q') });
    await api('PATCH', '/wholesaler/business', ws, { gstin: gstin('24', 'AAACG5678Q') });
    const shop = d(await api('GET', '/shopkeeper/business', st));
    const shopState = String(shop.gstin || '').slice(0, 2);
    const otherState = shopState === '27' ? '29' : '27';

    let r = await api('POST', '/shopkeeper/products', st, { name: 'Money Soap', sku: 'MS1', hsn: '3401', sellPrice: 100, costPrice: 60, gstRate: 18, unit: 'pcs', currentStock: 500, priceIncludesGst: false });
    const soap = d(r);

    suite('gst:igst-retail');
    check('setup: shop has a GSTIN', /^\d{2}/.test(shopState), shop.gstin);
    const gst0 = d(await api('GET', '/shopkeeper/reports/gst', st));
    const outGstin = gstin(otherState, 'AAACM1111K');
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: soap._id, quantity: 10 }], paymentMode: 'cash', walkInName: 'Other State Co', walkInMobile: '9822211001', customerGstin: outGstin });
    const outBill = d(r);
    check('setup: other-state bill made', r.status === 201 && outBill.customerGstin === outGstin, `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: soap._id, quantity: 5 }], paymentMode: 'cash', walkInName: 'Same State Co', walkInMobile: '9822211002', customerGstin: gstin(shopState, 'AAACS2222K') });
    const inBill = d(r);
    const gst1 = d(await api('GET', '/shopkeeper/reports/gst', st));
    const S0 = gst0.summary, S1 = gst1.summary;
    check('other-state bill tax goes to IGST', near(S1.igst - S0.igst, outBill.totalGst), `igst +${r2(S1.igst - S0.igst)} vs bill ${outBill.totalGst}`);
    check('same-state bill tax goes to CGST + SGST', near((S1.cgst + S1.sgst) - (S0.cgst + S0.sgst), inBill.totalGst), `c+s +${r2(S1.cgst + S1.sgst - S0.cgst - S0.sgst)} vs ${inBill.totalGst}`);
    check('CGST + SGST + IGST = total tax', near(S1.cgst + S1.sgst + S1.igst, S1.totalTax), JSON.stringify(S1));
    const rate18 = gst1.rateWise.find((x) => x.rate === 18);
    check('rate-wise 18% row has the IGST', rate18 && rate18.igst >= outBill.totalGst - 0.01 && near(rate18.cgst + rate18.sgst + rate18.igst, rate18.gst), JSON.stringify(rate18));
    const hsn = gst1.hsnWise.find((x) => x.hsn === '3401' && x.rate === 18);
    check('HSN row splits CGST / SGST / IGST', hsn && near(hsn.cgst + hsn.sgst + hsn.igst, hsn.gst) && hsn.igst > 0, JSON.stringify(hsn));
    const b2bOut = gst1.b2b.find((x) => x.gstin === outGstin);
    check('B2B row for the other-state buyer is all IGST', b2bOut && near(b2bOut.igst, b2bOut.gst), JSON.stringify(b2bOut));
    // A return on the other-state bill takes IGST back out.
    r = await api('POST', '/shopkeeper/returns', st, { invoiceId: outBill._id, items: [{ productId: soap._id, quantity: 2 }], refundMode: 'cash' });
    const cn = d(r)?.creditNote;
    const gst2 = d(await api('GET', '/shopkeeper/reports/gst', st));
    check('return on an other-state bill lowers IGST', cn && near(gst1.summary.igst - gst2.summary.igst, cn.totalGst), `-${r2(gst1.summary.igst - gst2.summary.igst)} vs note ${cn?.totalGst}`);
    check('GST month label is the IST month', gst2.month === `${IST_YM.slice(0, 4)}-${IST_YM.slice(4)}`, gst2.month);

    suite('gst:igst-wholesale');
    const wsBiz = d(await api('GET', '/wholesaler/business', ws));
    const wsState = String(wsBiz.gstin || '').slice(0, 2);
    r = await api('POST', '/wholesaler/products', ws, { name: 'Money Rice', sku: 'MR1', hsn: '1006', sellPrice: 60, wholesalePrice: 50, costPrice: 40, gstRate: 5, unit: 'kg', currentStock: 1000 });
    const rice = d(r);
    r = await api('POST', '/wholesaler/dealers', ws, { name: 'Far Dealer', mobile: '9822211003', gstin: gstin(wsState === '27' ? '29' : '27', 'AAACF3333K') });
    const far = d(r);
    const w0 = d(await api('GET', '/wholesaler/reports/gst', ws)).summary;
    r = await api('POST', '/wholesaler/orders', ws, { dealerId: far._id, items: [{ productId: rice._id, quantity: 100 }], source: 'manual' });
    const order = d(r);
    const w1 = d(await api('GET', '/wholesaler/reports/gst', ws)).summary;
    check('order to an other-state dealer is IGST', order && near(w1.igst - w0.igst, order.totalGst), `igst +${r2(w1.igst - w0.igst)} vs ${order?.totalGst}`);
    check('wholesale CGST + SGST + IGST = total tax', near(w1.cgst + w1.sgst + w1.igst, w1.totalTax), JSON.stringify(w1));

    suite('profit:salary-once');
    const p0 = d(await api('GET', '/shopkeeper/reports/summary?period=month', st));
    check('expenses = other expenses + salary (salary counted once)', near(p0.expenses, p0.otherExpenses + p0.staffSalaryForPeriod), JSON.stringify({ e: p0.expenses, o: p0.otherExpenses, s: p0.staffSalaryForPeriod }));
    r = await api('POST', '/shopkeeper/expenses', st, { amount: 5000, category: 'salary', note: 'Test salary' });
    check('setup: salary expense added', r.status === 201, `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/expenses', st, { amount: 700, category: 'rent', note: 'Test rent' });
    const p1 = d(await api('GET', '/shopkeeper/reports/summary?period=month', st));
    check('salary now comes from expenses', p1.salarySource === 'expenses', p1.salarySource);
    // Before: salary was either recorded expenses (then +5000) or the staff estimate
    // (then it's replaced by our 5000, the only salary expense). Never estimate + expenses.
    const expectSalary = p0.salarySource === 'expenses' ? p0.staffSalaryForPeriod + 5000 : 5000;
    check('staff-list estimate is not added on top', near(p1.staffSalaryForPeriod, expectSalary), JSON.stringify({ before: p0.staffSalaryForPeriod, src: p0.salarySource, after: p1.staffSalaryForPeriod }));
    check('rent goes to other expenses only', near(p1.otherExpenses - p0.otherExpenses, 700), `${p0.otherExpenses} → ${p1.otherExpenses}`);
    check('salary is not in other expenses', !near(p1.otherExpenses - p0.otherExpenses, 5700), `${p0.otherExpenses} → ${p1.otherExpenses}`);
    check('expenses still add up', near(p1.expenses, p1.otherExpenses + p1.staffSalaryForPeriod));

    suite('udhar:repayment-clears-bills');
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Payback Pinki', mobile: '9822211004' });
    const pinki = d(r);
    const udharBill = async (qty) => d(await api('POST', '/shopkeeper/billing', st, { items: [{ productId: soap._id, quantity: qty }], paymentMode: 'credit', paidAmount: 0, customerId: pinki._id }));
    const b1 = await udharBill(1); // ₹118
    const b2 = await udharBill(2); // ₹236
    const b3 = await udharBill(3); // ₹354
    check('setup: three udhar bills', b1?.dueAmount > 0 && b2?.dueAmount > 0 && b3?.dueAmount > 0, `${b1?.dueAmount} ${b2?.dueAmount} ${b3?.dueAmount}`);
    const dc0 = d(await api('GET', '/shopkeeper/reports/day-close', st));
    r = await api('POST', `/shopkeeper/customers/${pinki._id}/repayment`, st, { amount: r2(b1.dueAmount + 50) });
    const rp = d(r);
    check('repayment says which bills it cleared', rp?.settled?.length === 2 && rp.settled[0].invoiceNo === b1.invoiceNo && rp.settled[0].dueAfter === 0 && rp.settled[1].invoiceNo === b2.invoiceNo, JSON.stringify(rp?.settled));
    let L = d(await api('GET', `/shopkeeper/customers/${pinki._id}/ledger`, st));
    const due = (b) => L.bills.find((x) => x._id === b._id);
    check('oldest bill fully cleared → paid', due(b1)?.dueAmount === 0 && due(b1)?.status === 'paid', JSON.stringify(due(b1)));
    check('next bill part-cleared → partial', near(due(b2)?.dueAmount, b2.dueAmount - 50) && due(b2)?.status === 'partial', JSON.stringify(due(b2)));
    check('newest bill untouched', near(due(b3)?.dueAmount, b3.dueAmount) && due(b3)?.status === 'credit', JSON.stringify(due(b3)));
    check('ledger note names the bills', /cleared/.test(L.ledger[0].note) && L.ledger[0].note.includes(b1.invoiceNo), L.ledger[0].note);
    const billDue = () => r2(L.bills.reduce((s, b) => s + b.dueAmount, 0));
    check("bills' dues = customer's balance", near(billDue(), L.customer.creditBalance), `${billDue()} vs ${L.customer.creditBalance}`);
    r = await api('POST', `/shopkeeper/customers/${pinki._id}/repayment`, st, { amount: 10000 });
    L = d(await api('GET', `/shopkeeper/customers/${pinki._id}/ledger`, st));
    check('paying everything clears every bill', L.bills.every((b) => b.dueAmount === 0 && b.status === 'paid'), JSON.stringify(L.bills.map((b) => b.dueAmount)));
    r = await api('GET', '/shopkeeper/billing?status=credit&limit=100', st);
    check('cleared bills leave the "credit" bill list', !(r.json?.data?.items || []).some((b) => [b1._id, b2._id, b3._id].includes(b._id)));

    suite('udhar:return-clears-other-bills');
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Return Raju', mobile: '9822211005' });
    const raju = d(r);
    const paidBill = d(await api('POST', '/shopkeeper/billing', st, { items: [{ productId: soap._id, quantity: 2 }], paymentMode: 'cash', customerId: raju._id }));
    const owedBill = d(await api('POST', '/shopkeeper/billing', st, { items: [{ productId: soap._id, quantity: 3 }], paymentMode: 'credit', paidAmount: 0, customerId: raju._id }));
    r = await api('POST', '/shopkeeper/returns', st, { invoiceId: paidBill._id, items: [{ productId: soap._id, quantity: 1 }], refundMode: 'udhar_adjust' });
    const note = d(r)?.creditNote;
    L = d(await api('GET', `/shopkeeper/customers/${raju._id}/ledger`, st));
    const owed = L.bills.find((b) => b._id === owedBill._id);
    check('return against udhar lowers the other due bill', note && near(owed?.dueAmount, owedBill.dueAmount - note.total) && owed?.status === 'partial', JSON.stringify({ owed: owed?.dueAmount, was: owedBill.dueAmount, cn: note?.total }));
    check("…and bills' dues still = balance", near(r2(L.bills.reduce((s, b) => s + b.dueAmount, 0)), L.customer.creditBalance), `${L.customer.creditBalance}`);

    suite('day-close');
    const dc1 = d(await api('GET', '/shopkeeper/reports/day-close', st));
    // dc0 was taken after Pinki's three udhar bills; since then only Raju's udhar bill was given.
    check('repaying does not shrink "udhar given"', near(dc1.udharGiven - dc0.udharGiven, owedBill.dueAmount) && dc1.udharGiven >= b1.dueAmount + b2.dueAmount + b3.dueAmount - 0.01, `${dc0.udharGiven} → ${dc1.udharGiven} (+${owedBill.dueAmount} expected)`);
    check('udhar collected today includes the repayments', dc1.udharCollected - dc0.udharCollected >= r2(b1.dueAmount + 50) + 10000 - 0.01, `${dc0.udharCollected} → ${dc1.udharCollected}`);
    check("day-close date is today's IST date", dc1.date === IST_YMD, `${dc1.date} vs ${IST_YMD}`);
    r = await api('GET', '/shopkeeper/reports/day-close?date=2020-01-01', st);
    check('a picked day keeps its date (owner)', d(r)?.date === '2020-01-01', d(r)?.date);

    suite('dates:ist');
    check('bill number carries the IST month', String(inBill.invoiceNo).includes(IST_YM), `${inBill.invoiceNo} vs ${IST_YM}`);
    check('order number carries the IST month', String(order?.orderNo).includes(IST_YM), `${order?.orderNo}`);
    r = await api('GET', '/shopkeeper/reports/sales?days=2', st);
    check("today's sales are under today's IST date", (d(r)?.daily || []).some((x) => x.date === IST_YMD && x.sales > 0), JSON.stringify((d(r)?.daily || []).map((x) => x.date)));

    suite('seed:bills-match-balances');
    // seed runs the fix-up; no customer may have bills owing more than they owe.
    const custs = (await api('GET', '/shopkeeper/customers?limit=100&hasDue=true', st)).json.data.items;
    let worst = null;
    for (const c of custs.slice(0, 25)) {
        const l = d(await api('GET', `/shopkeeper/customers/${c._id}/ledger`, st));
        const sum = r2(l.bills.reduce((s, b) => s + b.dueAmount, 0));
        if (sum > Math.max(0, c.creditBalance) + 0.01) worst = { name: c.name, bills: sum, balance: c.creditBalance };
    }
    check('no customer\'s bills owe more than the customer', !worst, JSON.stringify(worst));

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ MONEY / GST / DATES ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
