/**
 * Wholesale GST report with dealer returns: returns come off the summary AND the
 * rate-wise / HSN tables; B2B stays gross with credit notes under cdnr; returns
 * only after dispatch; cancelling after a return doesn't put stock back twice.
 *
 *   npm run seed:reset && npm run test:wsgst
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
const sum = (rows, k) => r2((rows || []).reduce((a, x) => a + (x[k] || 0), 0));
async function login(mobile) {
    const r = await api('POST', '/auth/password-login', null, { mobile, password: 'whoply123' });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status}`);
    return r.json.data.token;
}
/** A valid GSTIN (with checksum) for a state code. */
function gstin(state, pan) {
    const cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const body = `${state}${pan}1Z`;
    let s = 0;
    for (let i = 0; i < body.length; i++) { const p = cs.indexOf(body[i]) * (i % 2 ? 2 : 1); s += Math.floor(p / 36) + (p % 36); }
    return body + cs[(36 - (s % 36)) % 36];
}
const W = '/wholesaler';

(async () => {
    const ws = await login('9000000010');
    const report = async () => d(await api('GET', `${W}/reports/gst`, ws));
    const rateRow = (g, rate) => (g.rateWise || []).find((x) => x.rate === rate) || { taxable: 0, gst: 0 };
    const hsnRow = (g, hsn) => (g.hsnWise || []).find((x) => x.hsn === hsn) || { taxable: 0, gst: 0, qty: 0 };
    const stockOf = async (id) => d(await api('GET', `${W}/products/${id}`, ws))?.currentStock;
    const order = async (dealerId, items) => d(await api('POST', `${W}/orders`, ws, { dealerId, items, source: 'manual' }));
    const setStatus = (o, status) => api('PATCH', `${W}/orders/${o._id}/status`, ws, { status });
    const ret = (o, items) => api('POST', `${W}/orders/${o._id}/return`, ws, { items });

    suite('setup');
    await api('PATCH', `${W}/business`, ws, { gstin: gstin('24', 'AAACG5678Q') });
    const home = String(d(await api('GET', `${W}/business`, ws))?.gstin || '').slice(0, 2);
    check('setup: business has a GSTIN', home === '24', home);
    let r = await api('POST', `${W}/products`, ws, { name: 'GST Glue', sku: 'WG1', hsn: '35069190', sellPrice: 120, wholesalePrice: 100, costPrice: 70, gstRate: 28, unit: 'pcs', currentStock: 500 });
    const glue = d(r);
    r = await api('POST', `${W}/products`, ws, { name: 'GST Dal', sku: 'WG2', hsn: '07133100', sellPrice: 60, wholesalePrice: 50, costPrice: 40, gstRate: 5, unit: 'kg', currentStock: 500 });
    const dal = d(r);
    const far = d(await api('POST', `${W}/dealers`, ws, { name: 'Far GST Dealer', mobile: '9833300001', gstin: gstin(home === '27' ? '29' : '27', 'AAACW1111K') }));
    const near_ = d(await api('POST', `${W}/dealers`, ws, { name: 'Near GST Dealer', mobile: '9833300002', gstin: gstin(home, 'AAACW2222K') }));
    const walkin = d(await api('POST', `${W}/dealers`, ws, { name: 'No GSTIN Dealer', mobile: '9833300003' }));
    check('products and dealers created', glue?._id && dal?._id && far?._id && near_?._id && walkin?._id, JSON.stringify([glue?._id, dal?._id, far?._id, near_?._id, walkin?._id]));

    suite('orders count at full value');
    const g0 = await report();
    const o1 = await order(far._id, [{ productId: glue._id, quantity: 10 }, { productId: dal._id, quantity: 20 }]);
    const o2 = await order(walkin._id, [{ productId: glue._id, quantity: 5 }]);
    await setStatus(o1, 'dispatched');
    await setStatus(o2, 'dispatched');
    r = await setStatus(o2, 'delivered');
    check('orders placed, dispatched and delivered', o1?._id && o2?._id && d(r)?.status === 'delivered', msg(r));
    const g1 = await report();
    check('summary taxable goes up by both orders', near(g1.summary.taxableValue - g0.summary.taxableValue, o1.subtotal + o2.subtotal), `${r2(g1.summary.taxableValue - g0.summary.taxableValue)} vs ${r2(o1.subtotal + o2.subtotal)}`);
    const glueLines = (o) => o.items.filter((i) => String(i.productId) === String(glue._id));
    const glueTaxable = r2([...glueLines(o1), ...glueLines(o2)].reduce((a, i) => a + (i.taxableValue ?? i.price * i.quantity), 0));
    check('28% row goes up by the glue lines', near(rateRow(g1, 28).taxable - rateRow(g0, 28).taxable, glueTaxable), `${r2(rateRow(g1, 28).taxable - rateRow(g0, 28).taxable)} vs ${glueTaxable}`);
    check('glue HSN row counts 15 units', near(hsnRow(g1, '35069190').qty - hsnRow(g0, '35069190').qty, 15), `${hsnRow(g1, '35069190').qty}`);

    suite('returns only after dispatch');
    const o3 = await order(near_._id, [{ productId: glue._id, quantity: 2 }]);
    r = await ret(o3, [{ productId: glue._id, quantity: 1 }]);
    check('return on a pending order is refused (400)', r.status === 400 && /shipped/i.test(msg(r)), `${r.status} ${msg(r)}`);
    await setStatus(o3, 'cancelled');
    r = await ret(o3, [{ productId: glue._id, quantity: 1 }]);
    check('return on a cancelled order is refused (400)', r.status === 400 && /cancelled/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('returns come off every table');
    const stockBeforeReturn = await stockOf(glue._id);
    r = await ret(o1, [{ productId: glue._id, quantity: 4 }]);
    const cn1 = d(r)?.creditNote;
    check('return on a dispatched order works', r.status === 201 && cn1?.creditNoteNo, `${r.status} ${msg(r)}`);
    check('…and puts the 4 units back in stock', (await stockOf(glue._id)) === stockBeforeReturn + 4, `${stockBeforeReturn} → ${await stockOf(glue._id)}`);
    r = await ret(o2, [{ productId: glue._id, quantity: 1 }]);
    const cn2 = d(r)?.creditNote;
    check('return on a delivered order works', r.status === 201 && cn2?.creditNoteNo, `${r.status} ${msg(r)}`);
    const g2 = await report();
    const cnTaxable = r2(cn1.subtotal + cn2.subtotal);
    const cnGst = r2(cn1.totalGst + cn2.totalGst);
    check('summary taxable goes down by the returns', near(g1.summary.taxableValue - g2.summary.taxableValue, cnTaxable), `-${r2(g1.summary.taxableValue - g2.summary.taxableValue)} vs ${cnTaxable}`);
    check('summary tax goes down by the returns', near(g1.summary.totalTax - g2.summary.totalTax, cnGst), `-${r2(g1.summary.totalTax - g2.summary.totalTax)} vs ${cnGst}`);
    check('28% row goes down by the returns (the bug)', near(rateRow(g1, 28).taxable - rateRow(g2, 28).taxable, cnTaxable), `-${r2(rateRow(g1, 28).taxable - rateRow(g2, 28).taxable)} vs ${cnTaxable}`);
    check('28% row tax goes down too', near(rateRow(g1, 28).gst - rateRow(g2, 28).gst, cnGst), `-${r2(rateRow(g1, 28).gst - rateRow(g2, 28).gst)} vs ${cnGst}`);
    check('5% row is untouched', near(rateRow(g1, 5).taxable, rateRow(g2, 5).taxable), `${rateRow(g1, 5).taxable} → ${rateRow(g2, 5).taxable}`);
    check('glue HSN row: 15 sold − 5 returned', near(hsnRow(g2, '35069190').qty - hsnRow(g0, '35069190').qty, 10), `${hsnRow(g2, '35069190').qty}`);
    check('glue HSN taxable goes down by the returns', near(hsnRow(g1, '35069190').taxable - hsnRow(g2, '35069190').taxable, cnTaxable), `-${r2(hsnRow(g1, '35069190').taxable - hsnRow(g2, '35069190').taxable)}`);
    check('other-state return lowers IGST', near(g1.summary.igst - g2.summary.igst, cn1.totalGst), `-${r2(g1.summary.igst - g2.summary.igst)} vs ${cn1.totalGst}`);
    check('CGST + SGST + IGST = total tax', near(g2.summary.cgst + g2.summary.sgst + g2.summary.igst, g2.summary.totalTax), JSON.stringify(g2.summary));
    check('credit notes counted in the summary', g2.summary.creditNotes?.count - (g1.summary.creditNotes?.count || 0) === 2, JSON.stringify(g2.summary.creditNotes));
    const b2bFar = (g) => (g.b2b || []).find((x) => x.gstin === far.gstin);
    check('B2B shows the far order at full value', b2bFar(g2) && near(b2bFar(g2).taxable, o1.subtotal), `${b2bFar(g2)?.taxable} vs ${o1.subtotal}`);
    const cdnrFar = (g2.cdnr || []).find((x) => x.gstin === far.gstin);
    check('its credit note is listed under cdnr', cdnrFar && near(cdnrFar.taxable, cn1.subtotal) && cdnrFar.notes === 1, JSON.stringify(cdnrFar));
    check('B2C goes down by the no-GSTIN return', near(g1.b2cTaxable - g2.b2cTaxable, cn2.subtotal), `-${r2(g1.b2cTaxable - g2.b2cTaxable)} vs ${cn2.subtotal}`);

    suite('tables agree with the summary');
    check('rate-wise taxable adds up to the summary', near(sum(g2.rateWise, 'taxable'), g2.summary.taxableValue), `${sum(g2.rateWise, 'taxable')} vs ${g2.summary.taxableValue}`);
    check('rate-wise tax adds up to the summary', near(sum(g2.rateWise, 'gst'), g2.summary.totalTax), `${sum(g2.rateWise, 'gst')} vs ${g2.summary.totalTax}`);
    check('HSN taxable adds up to the summary', near(sum(g2.hsnWise, 'taxable'), g2.summary.taxableValue), `${sum(g2.hsnWise, 'taxable')} vs ${g2.summary.taxableValue}`);
    check('B2B + B2C − B2B returns = summary', near(g2.b2bTaxable + g2.b2cTaxable - sum(g2.cdnr, 'taxable'), g2.summary.taxableValue), `${g2.b2bTaxable} + ${g2.b2cTaxable} − ${sum(g2.cdnr, 'taxable')} vs ${g2.summary.taxableValue}`);

    suite('cancel after a return');
    const dalStart = await stockOf(dal._id);
    const o4 = await order(near_._id, [{ productId: dal._id, quantity: 10 }]);
    await setStatus(o4, 'dispatched');
    check('dispatch takes 10', (await stockOf(dal._id)) === dalStart - 10, `${dalStart} → ${await stockOf(dal._id)}`);
    r = await ret(o4, [{ productId: dal._id, quantity: 3 }]);
    check('return 3', r.status === 201 && (await stockOf(dal._id)) === dalStart - 7, `${r.status} ${await stockOf(dal._id)}`);
    r = await setStatus(o4, 'cancelled');
    const dalEnd = await stockOf(dal._id);
    check('cancel puts back only the 7 still out', r.status === 200 && dalEnd === dalStart, `start ${dalStart}, end ${dalEnd}`);
    const g3 = await report();
    check('cancelled order and its return are left out of the report', near(g3.summary.taxableValue, g2.summary.taxableValue) && near(rateRow(g3, 5).taxable, rateRow(g2, 5).taxable), `${g2.summary.taxableValue} → ${g3.summary.taxableValue}`);
    check('…and not counted as a credit note', g3.summary.creditNotes?.count === g2.summary.creditNotes?.count, `${g2.summary.creditNotes?.count} → ${g3.summary.creditNotes?.count}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ WHOLESALE GST ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
