/**
 * Customers: add / edit / remove, mobile rules, search, the udhar ledger, and
 * who may do what.
 *
 *   npm run seed:reset && npm run test:customers
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
const items = (r) => r.json?.data?.items || [];
const msg = (r) => r.json?.error?.message || '';
async function login(mobile, password = 'whoply123') {
    const r = await api('POST', '/auth/password-login', null, { mobile, password });
    if (!r.json?.data?.token) throw new Error(`login ${mobile}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.token;
}

(async () => {
    const st = await login('9000000001');

    suite('customers:create');
    let r = await api('POST', '/shopkeeper/customers', st, { name: '  Meena Shah ', mobile: '+91 98111 22334', creditBalance: 99999, loyaltyPoints: 500, businessId: '000000000000000000000000', creditLimit: 2000, address: 'Station Road' });
    const meena = d(r);
    check('create ok (201)', r.status === 201 && !!meena?._id, `${r.status} ${msg(r)}`);
    check('name trimmed', meena?.name === 'Meena Shah', meena?.name);
    check('mobile saved as 10 digits', meena?.mobile === '9811122334', meena?.mobile);
    check('udhar balance not taken from the request', meena?.creditBalance === 0, meena?.creditBalance);
    check('loyalty points not taken from the request', meena?.loyaltyPoints === 0, meena?.loyaltyPoints);
    check('limit + address saved', meena?.creditLimit === 2000 && meena?.address === 'Station Road');
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Dup', mobile: '09811122334' });
    check('same mobile (with 0 prefix) rejected (409)', r.status === 409 && msg(r).includes('Meena Shah'), `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Bad', mobile: '12345' });
    check('invalid mobile rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Bad GST', gstin: '24ABCDE1234' });
    check('invalid GSTIN rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: '   ' });
    check('blank name rejected (400)', r.status === 400, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'No Mobile Kaka' });
    const noMobile = d(r);
    check('customer without mobile ok', r.status === 201 && !noMobile.mobile, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'Neg Limit', creditLimit: -5 });
    check('negative limit rejected (400)', r.status === 400, `${r.status}`);

    suite('customers:edit');
    r = await api('PATCH', `/shopkeeper/customers/${meena._id}`, st, { name: 'Meena S. Shah', address: 'Market Yard', creditLimit: 1500, creditBalance: 12345 });
    check('edit name/address/limit', r.status === 200 && d(r)?.name === 'Meena S. Shah' && d(r)?.address === 'Market Yard' && d(r)?.creditLimit === 1500, `${r.status} ${msg(r)}`);
    check('edit cannot set udhar balance', d(r)?.creditBalance === 0, d(r)?.creditBalance);
    r = await api('PATCH', `/shopkeeper/customers/${meena._id}`, st, { mobile: '9811122334' });
    check('keeping own mobile is not a clash', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/shopkeeper/customers/${noMobile._id}`, st, { mobile: '9811122334' });
    check("taking another customer's mobile rejected (409)", r.status === 409, `${r.status}`);
    r = await api('PATCH', `/shopkeeper/customers/${noMobile._id}`, st, { mobile: '9811155667', gstin: '' });
    check('add a mobile later', r.status === 200 && d(r)?.mobile === '9811155667', `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/shopkeeper/customers/${noMobile._id}`, st, { mobile: '' });
    check('clear a mobile', r.status === 200 && !d(r)?.mobile, JSON.stringify(d(r)?.mobile));
    r = await api('PATCH', '/shopkeeper/customers/000000000000000000000000', st, { name: 'Ghost' });
    check('edit unknown customer (404)', r.status === 404, `${r.status}`);

    suite('customers:search');
    r = await api('GET', '/shopkeeper/customers?search=meena', st);
    check('search by name', items(r).some((c) => c._id === meena._id), items(r).length);
    r = await api('GET', `/shopkeeper/customers?search=${encodeURIComponent('+91 98111')}`, st);
    check('search by mobile (typed with +91 and a space)', items(r).some((c) => c._id === meena._id), items(r).length);
    for (const bad of ['(', '[a-', '.*', '((a+)+)+$']) {
        r = await api('GET', `/shopkeeper/customers?search=${encodeURIComponent(bad)}`, st);
        check(`customer search "${bad}" is literal (200, no match)`, r.status === 200 && items(r).length === 0, `${r.status} ${items(r).length}`);
    }
    r = await api('GET', `/shopkeeper/products?search=${encodeURIComponent('(')}`, st);
    check('product search "(" works (200)', r.status === 200, `${r.status}`);
    const ws = await login('9000000010');
    r = await api('GET', `/wholesaler/dealers?search=${encodeURIComponent('[')}`, ws);
    check('dealer search "[" works (200)', r.status === 200, `${r.status}`);

    suite('customers:ledger');
    r = await api('POST', '/shopkeeper/products', st, { name: 'LedgerSoap', sku: 'LG1', sellPrice: 100, gstRate: 0, unit: 'pcs', currentStock: 50 });
    const prod = d(r);
    // Billing with the mobile typed differently still finds Meena — no duplicate customer.
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 3 }], paymentMode: 'credit', paidAmount: 0, walkInName: 'Meena', walkInMobile: '+91-98111-22334' });
    const bill = d(r);
    check('udhar bill links to the existing customer', r.status === 201 && String(bill?.customerId) === meena._id, `${r.status} ${bill?.customerId}`);
    r = await api('GET', `/shopkeeper/customers?search=9811122334`, st);
    check('still one customer with that mobile', items(r).length === 1, items(r).length);
    r = await api('POST', `/shopkeeper/customers/${meena._id}/repayment`, st, { amount: 100 });
    r = await api('GET', `/shopkeeper/customers/${meena._id}/ledger`, st);
    const L = d(r);
    check('ledger has the udhar and the repayment', L?.ledger?.length === 2 && L.ledger[0].type === 'repayment' && L.ledger[1].type === 'credit', JSON.stringify(L?.ledger?.map((e) => e.type)));
    check('ledger balance after each entry', L?.ledger?.[1]?.balanceAfter === 300 && L?.ledger?.[0]?.balanceAfter === 200, JSON.stringify(L?.ledger?.map((e) => e.balanceAfter)));
    // The ₹100 repayment clears part of the ₹300 udhar bill (utils/udhar.ts).
    check('ledger lists the bill, part-paid by the repayment', L?.bills?.length === 1 && L.bills[0].invoiceNo === bill.invoiceNo && L.bills[0].dueAmount === 200 && L.bills[0].status === 'partial', JSON.stringify(L?.bills?.[0] || {}));
    check('customer balance 200', L?.customer?.creditBalance === 200, L?.customer?.creditBalance);

    suite('customers:remove');
    r = await api('DELETE', `/shopkeeper/customers/${meena._id}`, st);
    check('cannot remove while udhar is due (400)', r.status === 400 && msg(r).includes('200'), `${r.status} ${msg(r)}`);
    await api('POST', `/shopkeeper/customers/${meena._id}/repayment`, st, { amount: 200 });
    r = await api('DELETE', `/shopkeeper/customers/${meena._id}`, st);
    check('remove once settled (200)', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/customers?search=meena', st);
    check('removed customer is hidden from the list', items(r).length === 0, items(r).length);
    r = await api('PATCH', `/shopkeeper/customers/${meena._id}`, st, { name: 'Back' });
    check('removed customer cannot be edited (404)', r.status === 404, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', st, { name: 'New Meena', mobile: '9811122334' });
    check("a removed customer's mobile can be used again", r.status === 201, `${r.status} ${msg(r)}`);
    const newMeena = d(r);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: prod._id, quantity: 1 }], paymentMode: 'credit', paidAmount: 0, walkInName: 'x', walkInMobile: '9811122334' });
    check('billing picks the active customer, not the removed one', String(d(r)?.customerId) === newMeena._id, `${d(r)?.customerId}`);

    suite('customers:roles');
    // Fresh cashier and accountant for this run.
    const hire = async (role, mobile) => { const h = await api('POST', '/staff', st, { name: `Cust ${role}`, mobile, role, password: 'Staff@123' }); if (h.status !== 201) throw new Error(`hire ${role}: ${h.status} ${JSON.stringify(h.json)}`); return { id: d(h)._id, tok: await login(mobile, 'Staff@123') }; };
    const cashier = await hire('cashier', '9811133001');
    const acct = await hire('accountant', '9811133002');
    r = await api('POST', '/shopkeeper/customers', cashier.tok, { name: 'Cashier Added' });
    const byCashier = d(r);
    check('cashier can add a customer', r.status === 201, `${r.status}`);
    r = await api('PATCH', `/shopkeeper/customers/${byCashier._id}`, cashier.tok, { address: 'Near temple' });
    check('cashier can edit a customer', r.status === 200, `${r.status}`);
    r = await api('DELETE', `/shopkeeper/customers/${byCashier._id}`, cashier.tok);
    check('cashier cannot remove a customer (403)', r.status === 403, `${r.status}`);
    r = await api('POST', '/shopkeeper/customers', acct.tok, { name: 'Acct Added' });
    check('accountant cannot add (403)', r.status === 403, `${r.status}`);
    r = await api('GET', `/shopkeeper/customers/${newMeena._id}/ledger`, acct.tok);
    check('accountant can read a ledger', r.status === 200, `${r.status}`);
    r = await api('DELETE', `/shopkeeper/customers/${byCashier._id}`, st);
    check('owner can remove', r.status === 200, `${r.status}`);
    for (const x of [cashier, acct]) await api('DELETE', `/staff/${x.id}`, st);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ CUSTOMERS ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
