/**
 * Bug check round 2: retail returns, udhar repayments and day-close, expenses,
 * reports/CSV and today's profit, dealer collections, credit limits, what sales
 * reps may do, the payments book, price list, and staff logins.
 *
 *   npm run seed:reset && npm run test:round2
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 220) }); return !!cond; };
async function raw(method, path, token, body) {
    return fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
}
async function api(method, path, token, body) {
    const res = await raw(method, path, token, body);
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
    const stockOf = async (id) => d(await api('GET', `${K}/products/${id}`, st))?.currentStock;
    const product = async (name, stock, price = 100, cost = 60) => d(await api('POST', `${K}/products`, st, { name, sku: name.replace(/\W/g, '') + Date.now(), sellPrice: price, costPrice: cost, gstRate: 0, unit: 'pcs', currentStock: stock }));
    const customer = async (m) => (d(await api('GET', `${K}/customers?limit=100&search=${m}`, st))?.items || []).find((c) => c.mobile === m);
    const ret = (invoiceId, items, refundMode = 'cash') => api('POST', `${K}/returns`, st, { invoiceId, items, refundMode });

    suite('returns');
    const soap = await product('R2 Soap', 20);
    const bill = d(await api('POST', `${K}/billing`, st, { items: [{ productId: soap._id, quantity: 3 }], paymentMode: 'cash' }));
    let r = await ret(bill._id, [{ productId: soap._id, quantity: 3 }, { productId: soap._id, quantity: 3 }]);
    check('the same item twice in one return counts as 6 — refused (sold 3)', r.status === 400 && /only 3/i.test(msg(r)), `${r.status} ${msg(r)}`);
    const bill2 = d(await api('POST', `${K}/billing`, st, { items: [{ productId: soap._id, quantity: 2 }], paymentMode: 'cash' }));
    const s0 = await stockOf(soap._id);
    const many = await Promise.all(Array.from({ length: 8 }, () => ret(bill2._id, [{ productId: soap._id, quantity: 2 }])));
    check('8 returns of the same bill at once → one goes through', many.filter((x) => x.status === 201).length === 1, many.map((x) => x.status).join(','));
    check('…stock back by 2, not 16', (await stockOf(soap._id)) === s0 + 2, `${s0} → ${await stockOf(soap._id)}`);
    const bill4 = d(await api('POST', `${K}/billing`, st, { items: [{ productId: soap._id, quantity: 4 }], paymentMode: 'cash' }));
    const halves = await Promise.all(Array.from({ length: 6 }, () => ret(bill4._id, [{ productId: soap._id, quantity: 1 }])));
    const back = (d(await api('GET', `${K}/returns?invoiceId=${bill4._id}`, st))?.items || []).reduce((a, n) => a + n.items.reduce((b, i) => b + i.quantity, 0), 0);
    check('6 returns of 1 at once on a bill of 4 → never more than 4 come back', back <= 4 && halves.filter((x) => x.status === 201).length === back, `${halves.map((x) => x.status)} → ${back} returned`);
    r = await ret(bill2._id, [{ productId: soap._id, quantity: 1 }]);
    check('nothing more can be returned after that', r.status === 400, `${r.status} ${msg(r)}`);
    const bill3 = d(await api('POST', `${K}/billing`, st, { items: [{ productId: soap._id, quantity: 1 }, { productId: soap._id, quantity: 2 }], paymentMode: 'cash' }));
    r = await ret(bill3._id, [{ productId: soap._id, quantity: 3 }]);
    check('an item on two bill lines (1 + 2) can be returned in full', r.status === 201 && d(r)?.creditNote?.items?.reduce((a, i) => a + i.quantity, 0) === 3, `${r.status} ${msg(r)}`);
    r = await ret(bill._id, [{ productId: soap._id, quantity: 1 }], 'xyz');
    check('an unknown refund mode is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', `${K}/returns?invoiceId=nope`, st);
    check('a bad invoiceId in the returns list is a 400, not a crash', r.status === 400, `${r.status}`);
    const rice = await product('R2 Rice', 50, 500, 300);
    await api('POST', `${K}/billing`, st, { items: [{ productId: rice._id, quantity: 2 }], paymentMode: 'cash', walkInName: 'Points Buyer', walkInMobile: '9833377001' });
    const before = await customer('9833377001');
    const pb = (d(await api('GET', `${K}/billing?limit=5`, st))?.items || []).find((b) => b.customerMobile === '9833377001');
    await ret(pb._id, [{ productId: rice._id, quantity: 1 }]);
    const after = await customer('9833377001');
    check('a return takes back the loyalty points (₹500 → 5 points)', before?.loyaltyPoints === 10 && after?.loyaltyPoints === 5, `${before?.loyaltyPoints} → ${after?.loyaltyPoints}`);

    suite('udhar repayments & day-close');
    await api('POST', `${K}/billing`, st, { items: [{ productId: rice._id, quantity: 2 }], paymentMode: 'credit', walkInMobile: '9833377002' });
    const debtor = await customer('9833377002');
    const dc0 = d(await api('GET', `${K}/reports/day-close`, st));
    r = await api('POST', `${K}/customers/${debtor._id}/repayment`, st, { amount: 400, mode: 'upi' });
    check('a repayment can be marked UPI', r.status === 201 && d(r)?.entry?.mode === 'upi', `${r.status} ${msg(r)}`);
    await api('POST', `${K}/customers/${debtor._id}/repayment`, st, { amount: 100, mode: 'cash' });
    const dc1 = d(await api('GET', `${K}/reports/day-close`, st));
    check('day-close: only the cash repayment goes into the cash drawer', near(dc1.cashInDrawer - dc0.cashInDrawer, 100) && near(dc1.udharCollected - dc0.udharCollected, 500), `drawer +${(dc1.cashInDrawer - dc0.cashInDrawer).toFixed(2)}, udhar +${(dc1.udharCollected - dc0.udharCollected).toFixed(2)}`);
    await Promise.all(Array.from({ length: 5 }, () => api('POST', `${K}/customers/${debtor._id}/repayment`, st, { amount: 10 })));
    check('5 repayments at once all come off the balance', near((await customer('9833377002')).creditBalance, 1000 - 500 - 50), `${(await customer('9833377002')).creditBalance}`);
    r = await api('POST', `${K}/customers/${debtor._id}/repayment`, st, { amount: 10, mode: 'bitcoin' });
    check('an unknown repayment mode is refused', r.status === 400, `${r.status}`);

    suite('expenses');
    for (const [body, name] of [[{ amount: -5000, category: 'rent' }, 'a negative amount'], [{ amount: 'abc', category: 'rent' }, 'a non-number'], [{ amount: 100, category: 'party' }, 'an unknown category'], [{ amount: 100, category: 'rent', spentAt: '2099-01-01' }, 'a future date']]) {
        r = await api('POST', `${K}/expenses`, st, body);
        check(`${name} is refused`, r.status === 400, `${r.status} ${msg(r)}`);
    }
    const ex = d(await api('POST', `${K}/expenses`, st, { amount: 250, category: 'rent' }));
    r = await api('PATCH', `${K}/expenses/${ex._id}`, st, { category: 'anything' });
    check('editing to an unknown category is refused', r.status === 400, `${r.status} ${msg(r)}`);

    suite("reports & today's profit");
    const cheap = await product('R2 Margin', 10, 100, 90); // ₹10 profit each
    const dash0 = d(await api('GET', `${K}/dashboard`, st));
    await api('POST', `${K}/billing`, st, { items: [{ productId: cheap._id, quantity: 2 }], paymentMode: 'cash', walkInName: '=HYPERLINK("http://x","click")' });
    const dash1 = d(await api('GET', `${K}/dashboard`, st));
    check("today's profit is real (₹200 sale at ₹90 cost → +₹20, not 30% = ₹60)", near(dash1.todayProfit - dash0.todayProfit, 20), `+${(dash1.todayProfit - dash0.todayProfit).toFixed(2)}`);
    const csvRes = await raw('GET', `${K}/reports/export?period=month`, st);
    const csv = await csvRes.text();
    check('CSV export: a name starting with = is not a formula', csv.includes(`"'=HYPERLINK(""http://x"",""click"")"`) && !csv.includes(`"=HYPERLINK`), csv.split('\n').find((l) => l.includes('HYPERLINK')) || 'no row');
    const pr = d(await api('GET', `${K}/reports/products`, st));
    check('best sellers are by product, with returns taken off', pr?.best?.every((b) => b.qty > 0) && pr.best.find((b) => b.name === 'R2 Soap')?.qty === 3 + (4 - back), JSON.stringify(pr?.best?.slice(0, 3)));
    check('slow movers are items in stock that sold least', pr?.slow?.length && pr.slow.every((s) => s.stock > 0) && pr.slow[0].sold <= pr.slow.at(-1).sold, JSON.stringify(pr?.slow));

    suite('dealer collections');
    const rep = d(await api('POST', '/staff', ws, { name: 'R2 Rep', mobile: '9833388001', role: 'salesStaff', password: 'Staff@123' }));
    const repTok = await login('9833388001', 'Staff@123');
    const mineD = d(await api('POST', `${W}/dealers`, ws, { name: 'Rep Own Dealer', mobile: '9833388002', assignedRepId: rep._id, creditLimit: 0 }));
    const otherD = d(await api('POST', `${W}/dealers`, ws, { name: 'Other Dealer', mobile: '9833388003', creditLimit: 0 }));
    const oil = d(await api('POST', `${W}/products`, ws, { name: 'R2 Oil', sku: 'R2O' + Date.now(), sellPrice: 1200, wholesalePrice: 1000, costPrice: 800, gstRate: 0, unit: 'pcs', currentStock: 500 }));
    const order = async (dealerId, qty, tok = ws, extra = {}) => api('POST', `${W}/orders`, tok, { dealerId, items: [{ productId: oil._id, quantity: qty }], source: 'manual', ...extra });
    const o1 = d(await order(mineD._id, 10)); // ₹10,000
    r = await api('POST', `${W}/orders/${o1._id}/collect`, ws, { amount: 12000 });
    check('collecting more than the order owes is refused', r.status === 400 && /more than/i.test(msg(r)), `${r.status} ${msg(r)}`);
    const two = await Promise.all([api('POST', `${W}/orders/${o1._id}/collect`, ws, { amount: 6000 }), api('POST', `${W}/orders/${o1._id}/collect`, ws, { amount: 6000 })]);
    const paidSum = (d(await api('GET', `${W}/payments?limit=100&dealerId=${mineD._id}`, ws))?.items || []).reduce((a, p) => a + p.amount, 0);
    check('two ₹6,000 collections at once on ₹10,000 → one goes in; book = order', two.filter((x) => x.status === 201).length === 1 && near(paidSum, 6000), `${two.map((x) => x.status)} book ${paidSum}`);
    r = await api('POST', `${W}/dealers/${mineD._id}/collect`, ws, { amount: 9999 });
    check('dealer-level collect over what they owe is refused', r.status === 400 && /more than/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', `${W}/dealers/${mineD._id}/collect`, repTok, { amount: 1000, mode: 'upi' });
    check('a rep collects for their own dealer, and it records who took it', r.status === 200 && String(d(r)?.payment?.collectedBy) === String(rep._id), `${r.status} ${msg(r)}`);
    const o2 = d(await order(otherD._id, 5));
    r = await api('POST', `${W}/orders/${o2._id}/collect`, repTok, { amount: 100 });
    check("a rep can't collect for another rep's dealer", r.status === 403, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `${W}/dealers/${otherD._id}`, repTok, { city: 'Surat' });
    check("…or edit that dealer", r.status === 403, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `${W}/dealers/${mineD._id}`, repTok, { tier: 'A', creditLimit: 999999, city: 'Rajkot' });
    check('a rep can edit their dealer but not the price group or credit limit', r.status === 200 && d(r)?.tier !== 'A' && d(r)?.creditLimit !== 999999 && d(r)?.city === 'Rajkot', JSON.stringify({ s: r.status, tier: d(r)?.tier, cl: d(r)?.creditLimit }));
    r = await api('DELETE', `${W}/dealers/${otherD._id}`, ws);
    check('a dealer who still owes money can not be removed', r.status === 400 && /owes/i.test(msg(r)), `${r.status} ${msg(r)}`);

    suite('credit limit');
    const lim = d(await api('POST', `${W}/dealers`, ws, { name: 'Limit Dealer', mobile: '9833388004', assignedRepId: rep._id, creditLimit: 15000 }));
    r = await order(lim._id, 10); // ₹10,000 — within
    check('an order within the limit is saved', r.status === 201, `${r.status} ${msg(r)}`);
    r = await order(lim._id, 10, repTok);
    check('a rep is stopped when an order goes over the limit', r.status === 400 && /credit limit/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await order(lim._id, 10);
    check('the owner gets a warning (409) with how much over', r.status === 409 && r.json?.error?.code === 'OVER_CREDIT_LIMIT' && /by ₹5000/.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await order(lim._id, 10, ws, { overLimitOk: true });
    check('…and can save anyway', r.status === 201, `${r.status} ${msg(r)}`);

    suite('tally & payments book');
    const t0 = d(await api('GET', `${W}/reports/tally?period=month`, ws));
    const big = d(await order(mineD._id, 50, ws, { overLimitOk: true }));
    await api('PATCH', `${W}/orders/${big._id}/status`, ws, { status: 'cancelled' });
    const t1 = d(await api('GET', `${W}/reports/tally?period=month`, ws));
    check('a cancelled order is not "billed"', near(t0.totalBilled, t1.totalBilled) && near(t0.periodBilled, t1.periodBilled), `${t0.totalBilled} → ${t1.totalBilled}`);
    const wd = d(await api('GET', `${W}/dashboard`, ws));
    check('…nor dashboard revenue (= collected + outstanding)', wd && near(wd.revenue, t1.totalBilled), `${wd?.revenue} vs ${t1.totalBilled}`);
    const paid = d(await order(mineD._id, 2, ws, { paidAmount: 2000, overLimitOk: true }));
    await api('PATCH', `${W}/orders/${paid._id}/status`, ws, { status: 'dispatched' });
    r = await api('POST', `${W}/orders/${paid._id}/return`, ws, { items: [{ productId: oil._id, quantity: 1 }] });
    const book = d(await api('GET', `${W}/payments?limit=100&dealerId=${mineD._id}`, ws));
    check('a cash refund after a return is a minus row in the payments book', r.status === 201 && book.items.some((p) => p.amount === -1000), JSON.stringify(book?.items?.map((p) => p.amount)));
    check('the payments book total comes from the server (all rows)', near(book.sum, book.items.reduce((a, p) => a + p.amount, 0)), `${book?.sum}`);
    const shipped = d(await order(mineD._id, 3, ws, { overLimitOk: true }));
    await api('PATCH', `${W}/orders/${shipped._id}/status`, ws, { status: 'dispatched' });
    const wr = await Promise.all(Array.from({ length: 6 }, () => api('POST', `${W}/orders/${shipped._id}/return`, ws, { items: [{ productId: oil._id, quantity: 1 }] })));
    const wBack = (d(await api('GET', `${W}/returns?limit=100`, ws))?.items || []).filter((n) => String(n.orderId) === String(shipped._id)).reduce((a, n) => a + n.items.reduce((b, i) => b + i.quantity, 0), 0);
    check('6 dealer returns of 1 at once on an order of 3 → never more than 3 come back', wBack <= 3 && wr.filter((x) => x.status === 201).length === wBack, `${wr.map((x) => x.status)} → ${wBack}`);
    r = await api('POST', `${W}/orders/${shipped._id}/return`, ws, { items: [{ productId: oil._id, quantity: 3 }, { productId: oil._id, quantity: 3 }] });
    check('a dealer return listing the item twice counts it twice (refused)', r.status === 400, `${r.status} ${msg(r)}`);

    suite('price list');
    r = await api('PUT', `${W}/price-lists`, ws, { productId: oil._id, tier: 'A', price: 'Infinity' });
    check('an infinite price is refused', r.status === 400, `${r.status} ${msg(r)}`);
    await api('PUT', `${W}/price-lists`, ws, { productId: oil._id, tier: 'A', price: 900 });
    r = await api('PUT', `${W}/price-lists`, ws, { productId: oil._id, tier: 'A', price: '' });
    const row = (d(await api('GET', `${W}/price-lists`, ws)) || []).find((p) => p.productId === oil._id || p._id === oil._id);
    check('clearing a price goes back to the default (₹950 for A)', r.status === 200 && row && row.A === 950 && row.custom?.A === false, JSON.stringify(row && { A: row.A, custom: row.custom }));
    const cheapOil = d(await api('POST', `${W}/products`, ws, { name: 'R2 Small', sku: 'R2S' + Date.now(), sellPrice: 3, wholesalePrice: 2.4, costPrice: 1, gstRate: 0, unit: 'pcs', currentStock: 10 }));
    const small = (d(await api('GET', `${W}/price-lists`, ws)) || []).find((p) => p.name === 'R2 Small');
    check('default group prices keep paise (₹2.40 → A ₹2.28, C ₹2.54)', small && small.A === 2.28 && small.C === 2.54, JSON.stringify(small && { A: small.A, B: small.B, C: small.C }) + (cheapOil ? '' : ' (no product)'));

    suite('staff');
    const cashier = d(await api('POST', '/staff', st, { name: 'R2 Cashier', mobile: '9833399001', role: 'cashier', password: 'Staff@123' }));
    const cTok = await login('9833399001', 'Staff@123');
    await api('DELETE', `/staff/${cashier._id}`, st);
    r = await api('GET', `${K}/products`, cTok);
    check('a removed staff member is signed out', r.status === 401, `${r.status}`);
    r = await api('POST', '/staff', st, { name: 'R2 Cashier Again', mobile: '9833399001', role: 'cashier', password: 'Again@123' });
    check('adding them again with the same mobile brings the login back', r.status === 201 && String(d(r)?._id) === String(cashier._id), `${r.status} ${msg(r)}`);
    r = await api('GET', `${K}/products`, cTok);
    check("…but their old sign-in doesn't come back to life", r.status === 401, `${r.status}`);
    check('…and the new password works', !!(await login('9833399001', 'Again@123')));
    r = await api('POST', '/staff', ws, { name: 'Poach', mobile: '9833399001', role: 'salesStaff' });
    check("another business can't take that mobile", r.status === 409, `${r.status} ${msg(r)}`);
    for (const [body, name] of [[{ name: 'X', mobile: '12', role: 'cashier' }, 'a mobile of 2 digits'], [{ name: 'X', mobile: '9833399002', role: 'cashier', salary: -500 }, 'a negative salary'], [{ name: '  ', mobile: '9833399003', role: 'cashier' }, 'a blank name']]) {
        r = await api('POST', '/staff', st, body);
        check(`${name} is refused`, r.status === 400, `${r.status} ${msg(r)}`);
    }
    const phone1 = await login('9833399001', 'Again@123');
    const phone2 = await login('9833399001', 'Again@123');
    r = await api('POST', '/auth/change-password', phone1, { currentPassword: 'Again@123', newPassword: 'Newer@123' });
    const p1 = await api('GET', `${K}/products`, phone1);
    const p2 = await api('GET', `${K}/products`, phone2);
    check('changing the password signs out the other devices (this one stays in)', r.status === 200 && p1.status === 200 && p2.status === 401, `${r.status} this=${p1.status} other=${p2.status}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ BUG CHECK ROUND 2 ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
