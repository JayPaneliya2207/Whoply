/**
 * Whoply end-to-end feature test — drives the real API for both roles.
 *
 *   npm run seed:reset && npm run test:e2e
 *
 * Deterministic: assumes a fresh `seed:reset` (shopkeeper 9000000001 /
 * wholesaler 9000000010, password whoply123). Exits non-zero on any failure.
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let currentSuite = '';
const suite = (s) => { currentSuite = s; };
const ok = (name) => results.push({ suite: currentSuite, name, pass: true });
const bad = (name, detail) => results.push({ suite: currentSuite, name, pass: false, detail: String(detail).slice(0, 300) });
function check(name, cond, detail = '') { cond ? ok(name) : bad(name, detail || 'assertion failed'); return cond; }

async function api(method, path, token, body) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body != null ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json };
}
const dataOf = (r) => r.json?.data;

async function login(mobile) {
    const r = await api('POST', '/auth/password-login', null, { mobile, password: 'whoply123', language: 'en' });
    if (r.status !== 200 || !r.json?.data?.token) throw new Error(`login ${mobile} failed: ${r.status} ${JSON.stringify(r.json)}`);
    return { token: r.json.data.token, user: r.json.data.user };
}

const GOOD_GSTIN = '24AAAAA0000A1Z5';
const BAD_GSTIN = '24AAAAA0000A1Z';

async function testShopkeeper() {
    suite('shopkeeper:auth');
    const { token, user } = await login('9000000001');
    check('login returns token', !!token);
    check('login returns retail business', user?.business?.type === 'retail', JSON.stringify(user?.business));
    check('login applies language', user?.language === 'en');

    suite('shopkeeper:business+gstin');
    let r = await api('PATCH', '/shopkeeper/business', token, { gstin: BAD_GSTIN });
    check('reject invalid business GSTIN', r.status === 400, `got ${r.status}`);
    r = await api('PATCH', '/shopkeeper/business', token, { gstin: GOOD_GSTIN, settings: { enableUdharReminders: true, udharReminderDays: 3 } });
    check('accept valid business GSTIN + reminder settings', r.status === 200 && dataOf(r)?.gstin === GOOD_GSTIN, JSON.stringify(dataOf(r)?.settings));
    check('udharReminderDays persisted', dataOf(r)?.settings?.udharReminderDays === 3, JSON.stringify(dataOf(r)?.settings));

    suite('shopkeeper:products');
    r = await api('POST', '/shopkeeper/categories', token, { name: 'Grocery' });
    const catId = dataOf(r)?._id;
    check('create category', r.status === 201 && !!catId);
    const products = [];
    for (const [i, p] of [['Rice 5kg', 450, 5], ['Cooking Oil 1L', 150, 5], ['Soap', 40, 18], ['Biscuits', 20, 18], ['Shampoo', 120, 18]].entries()) {
        const [name, price, gst] = p;
        r = await api('POST', '/shopkeeper/products', token, {
            name, sku: `SKU${1000 + i}`, barcode: `890000000${1000 + i}`, categoryId: catId,
            sellPrice: price, costPrice: Math.round(price * 0.75), wholesalePrice: Math.round(price * 0.85),
            gstRate: gst, hsn: `1000${i}`, unit: 'pcs', currentStock: 1000, lowStockThreshold: 20,
        });
        if (r.status === 201) products.push(dataOf(r)); else bad(`create product ${name}`, `${r.status} ${JSON.stringify(r.json)}`);
    }
    check('created 5 products', products.length === 5);
    check('isLowStock false when stocked', dataOf(await api('GET', `/shopkeeper/products/${products[0]._id}`, token))?.isLowStock === false, 'flag should be false at 1000 units');
    r = await api('GET', '/shopkeeper/products?barcode=8900000001000', token);
    check('barcode lookup resolves product', dataOf(r)?.items?.[0]?.name === 'Rice 5kg', JSON.stringify(dataOf(r)?.items?.map((x) => x.name)));
    r = await api('POST', `/shopkeeper/products/${products[0]._id}/adjust-stock`, token, { quantity: 50, reason: 'adjustment', note: 'recount' });
    check('adjust stock +50', dataOf(r)?.currentStock === 1050, JSON.stringify(dataOf(r)?.currentStock));

    suite('shopkeeper:low-stock-flag');
    r = await api('POST', '/shopkeeper/products', token, { name: 'AlmostOut', sku: 'LOW1', sellPrice: 10, gstRate: 0, unit: 'pcs', currentStock: 2, lowStockThreshold: 10 });
    const lowProd = dataOf(r);
    check('new low product flagged isLowStock', lowProd?.isLowStock === true || dataOf(await api('GET', `/shopkeeper/products/${lowProd._id}`, token))?.isLowStock === true, 'expected isLowStock true');
    r = await api('GET', '/shopkeeper/products?lowStock=true', token);
    check('lowStock filter returns it', (dataOf(r)?.items || []).some((x) => x._id === lowProd._id), JSON.stringify(dataOf(r)?.items?.map((x) => x.name)));

    suite('shopkeeper:customers+gstin');
    r = await api('POST', '/shopkeeper/customers', token, { name: 'B2B Buyer', mobile: '9811110000', gstin: BAD_GSTIN });
    check('reject invalid customer GSTIN', r.status === 400, `got ${r.status}`);
    r = await api('POST', '/shopkeeper/customers', token, { name: 'B2B Buyer', mobile: '9811110000', gstin: GOOD_GSTIN });
    const b2bCustomer = dataOf(r);
    check('create B2B customer w/ valid GSTIN', r.status === 201 && b2bCustomer?.gstin === GOOD_GSTIN, JSON.stringify(r.json));

    suite('shopkeeper:billing-month');
    let cashBills = 0, creditBills = 0, b2bBills = 0;
    let firstInvoiceId = null;
    for (let day = 1; day <= 24; day++) {
        const items = [{ productId: products[day % products.length]._id, quantity: 2 }, { productId: products[(day + 1) % products.length]._id, quantity: 1 }];
        let s = await api('POST', '/shopkeeper/billing', token, { items, paymentMode: day % 3 === 0 ? 'upi' : 'cash' });
        if (s.status === 201) { cashBills++; if (!firstInvoiceId) firstInvoiceId = dataOf(s)._id; }
        else bad(`day ${day} cash bill`, `${s.status} ${JSON.stringify(s.json)}`);

        if (day % 4 === 0) {
            s = await api('POST', '/shopkeeper/billing', token, {
                items: [{ productId: products[0]._id, quantity: 3 }], paymentMode: 'credit', paidAmount: 0,
                walkInName: `Udhar Cust ${day}`, walkInMobile: `98200000${String(day).padStart(2, '0')}`,
            });
            if (s.status === 201) creditBills++; else bad(`day ${day} credit bill`, `${s.status} ${JSON.stringify(s.json)}`);
        }
        if (day % 6 === 0) {
            s = await api('POST', '/shopkeeper/billing', token, { items: [{ productId: products[2]._id, quantity: 5 }], paymentMode: 'cash', customerId: b2bCustomer._id, customerGstin: GOOD_GSTIN });
            if (s.status === 201) b2bBills++; else bad(`day ${day} b2b bill`, `${s.status} ${JSON.stringify(s.json)}`);
        }
    }
    check('cash/upi bills created (24)', cashBills === 24, `got ${cashBills}`);
    check('credit bills created (6)', creditBills === 6, `got ${creditBills}`);
    check('b2b bills created (4)', b2bBills === 4, `got ${b2bBills}`);
    r = await api('GET', `/shopkeeper/products/${products[0]._id}`, token);
    check('stock decremented after sales', dataOf(r)?.currentStock < 1050, `stock=${dataOf(r)?.currentStock}`);

    suite('shopkeeper:udhar');
    r = await api('GET', '/shopkeeper/customers?hasDue=true', token);
    const dueCustomers = dataOf(r)?.items || [];
    check('due customers listed', dueCustomers.length >= 6, `got ${dueCustomers.length}`);
    const someDue = dueCustomers.find((c) => c.creditBalance > 0);
    check('customer has positive credit balance', !!someDue);
    if (someDue) {
        const before = someDue.creditBalance;
        r = await api('POST', `/shopkeeper/customers/${someDue._id}/repayment`, token, { amount: 10, note: 'part payment' });
        check('record repayment', r.status === 201 && dataOf(r)?.customer?.creditBalance === +(before - 10).toFixed(2), JSON.stringify(dataOf(r)?.customer?.creditBalance));
        r = await api('GET', `/shopkeeper/customers/${someDue._id}/ledger`, token);
        check('customer ledger has entries', (dataOf(r)?.ledger?.length || 0) >= 2, `entries=${dataOf(r)?.ledger?.length}`);
    }

    suite('shopkeeper:quotations');
    r = await api('POST', '/shopkeeper/quotations', token, { items: [{ productId: products[1]._id, quantity: 4 }], walkInName: 'Quote Cust', walkInMobile: '9833330000', validDays: 7 });
    const quote = dataOf(r);
    check('create quotation', r.status === 201 && quote?.status === 'open', JSON.stringify(r.json));
    r = await api('POST', `/shopkeeper/quotations/${quote._id}/convert`, token, { paymentMode: 'cash' });
    check('convert quotation → invoice', r.status === 201 && dataOf(r)?.invoiceNo?.startsWith('INV/'), JSON.stringify(r.json));
    r = await api('GET', '/shopkeeper/quotations', token);
    check('converted quote marked converted', (dataOf(r)?.items || []).some((q) => q._id === quote._id && q.status === 'converted'));

    suite('shopkeeper:returns');
    r = await api('GET', `/shopkeeper/billing/${firstInvoiceId}`, token);
    const retItem = dataOf(r)?.items?.[0];
    r = await api('POST', '/shopkeeper/returns', token, { invoiceId: firstInvoiceId, items: [{ productId: retItem.productId, quantity: 1 }], reason: 'damaged', refundMode: 'cash' });
    check('create return (credit note)', r.status === 201 && dataOf(r)?.creditNote?.creditNoteNo?.startsWith('CN/'), JSON.stringify(r.json));
    r = await api('GET', '/shopkeeper/returns', token);
    check('returns listed', (dataOf(r)?.items?.length || 0) >= 1);

    suite('shopkeeper:suppliers+purchases');
    r = await api('POST', '/shopkeeper/suppliers', token, { name: 'Metro Wholesale', mobile: '9844440000', gstin: GOOD_GSTIN });
    const supplier = dataOf(r);
    check('create supplier', r.status === 201 && !!supplier?._id);
    r = await api('POST', '/shopkeeper/purchases', token, { supplierId: supplier._id, items: [{ productId: products[0]._id, quantity: 100, costPrice: 320 }], paidAmount: 10000 });
    const po = dataOf(r);
    check('create purchase order', r.status === 201 && po?.dueAmount === 22000, `due=${po?.dueAmount}`);
    r = await api('POST', `/shopkeeper/purchases/${po._id}/receive`, token);
    check('receive purchase (stock in)', r.status === 200 && dataOf(r)?.status === 'received');
    r = await api('GET', `/shopkeeper/products/${products[0]._id}`, token);
    check('stock increased after receive', dataOf(r)?.currentStock >= 100, `stock=${dataOf(r)?.currentStock}`);
    r = await api('POST', `/shopkeeper/purchases/${po._id}/payment`, token, { amount: 22000 });
    check('pay supplier balance', r.status === 200 && dataOf(r)?.dueAmount === 0, `due=${dataOf(r)?.dueAmount}`);

    suite('shopkeeper:expenses');
    r = await api('POST', '/shopkeeper/expenses', token, { category: 'rent', amount: 15000, note: 'Shop rent' });
    const exp = dataOf(r);
    check('create expense', r.status === 201 && exp?.amount === 15000, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
    r = await api('PATCH', `/shopkeeper/expenses/${exp._id}`, token, { amount: 16000 });
    check('update expense', r.status === 200 && dataOf(r)?.amount === 16000);
    r = await api('GET', '/shopkeeper/expenses', token);
    check('list expenses', (dataOf(r)?.items?.length || 0) >= 1);

    suite('shopkeeper:reports');
    for (const [name, path] of [['sales', '/shopkeeper/reports/sales'], ['products', '/shopkeeper/reports/products'], ['profit', '/shopkeeper/reports/profit'], ['summary', '/shopkeeper/reports/summary'], ['day-close', '/shopkeeper/reports/day-close']]) {
        r = await api('GET', path, token);
        check(`report ${name} 200`, r.status === 200, `${r.status}`);
    }
    r = await api('GET', '/shopkeeper/dashboard', token);
    const dash = dataOf(r);
    check('dashboard todaySales > 0', (dash?.todaySales || 0) > 0, `todaySales=${dash?.todaySales}`);
    check('dashboard pendingUdhar > 0', (dash?.pendingUdhar || 0) > 0, `pendingUdhar=${dash?.pendingUdhar}`);
    check('dashboard lowStockCount counts flagged product', (dash?.lowStockCount || 0) >= 1, `lowStockCount=${dash?.lowStockCount}`);
    check('dashboard recentInvoices present', (dash?.recentInvoices?.length || 0) > 0);

    suite('shopkeeper:gst');
    const ym = new Date().toISOString().slice(0, 7);
    r = await api('GET', `/shopkeeper/reports/gst?month=${ym}`, token);
    const gst = dataOf(r);
    check('gst report 200', r.status === 200);
    check('gst taxableValue > 0', (gst?.summary?.taxableValue || 0) > 0, `taxable=${gst?.summary?.taxableValue}`);
    check('gst has B2B entry (from GSTIN sales)', (gst?.b2b?.length || 0) >= 1, `b2b=${gst?.b2b?.length}`);
    check('gst rateWise present', (gst?.rateWise?.length || 0) >= 1);
    check('gst hsnWise present', (gst?.hsnWise?.length || 0) >= 1);

    suite('shopkeeper:e-invoice+eway');
    r = await api('GET', `/shopkeeper/billing/${firstInvoiceId}/einvoice`, token);
    check('e-invoice JSON generated', r.status === 200 && !!dataOf(r), `${r.status}`);
    r = await api('POST', `/shopkeeper/billing/${firstInvoiceId}/eway`, token, { vehicleNo: 'GJ01AB1234', distance: 12, transMode: '1', transporterName: 'ABC Transport' });
    check('e-way JSON generated', r.status === 200 && !!dataOf(r), `${r.status}`);

    suite('shopkeeper:notifications+ai');
    r = await api('GET', '/shopkeeper/notifications', token);
    check('notifications endpoint 200', r.status === 200 && Array.isArray(dataOf(r)?.items), `${r.status}`);
    r = await api('GET', '/shopkeeper/ai/reorder', token);
    check('ai reorder 200', r.status === 200);
}

async function testWholesaler() {
    suite('wholesaler:auth');
    const { token, user } = await login('9000000010');
    check('login returns token', !!token);
    check('login returns wholesale business', user?.business?.type === 'wholesale', JSON.stringify(user?.business));

    suite('wholesaler:business+gstin');
    let r = await api('PATCH', '/wholesaler/business', token, { gstin: BAD_GSTIN });
    check('reject invalid business GSTIN', r.status === 400, `got ${r.status}`);
    r = await api('PATCH', '/wholesaler/business', token, { gstin: GOOD_GSTIN, settings: { enableUdharReminders: true, udharReminderDays: 5 } });
    check('accept valid GSTIN + reminder days', r.status === 200 && dataOf(r)?.settings?.udharReminderDays === 5, JSON.stringify(dataOf(r)?.settings));

    suite('wholesaler:products');
    const products = [];
    for (const [i, p] of [['Cement Bag', 380, 28], ['Steel Rod 10mm', 620, 18], ['Paint 20L', 3200, 18]].entries()) {
        const [name, price, gst] = p;
        r = await api('POST', '/wholesaler/products', token, {
            name, sku: `WSK${2000 + i}`, barcode: `890999000${2000 + i}`,
            sellPrice: price, costPrice: Math.round(price * 0.8), wholesalePrice: Math.round(price * 0.9),
            gstRate: gst, hsn: `2500${i}`, unit: 'pcs', currentStock: 5000, lowStockThreshold: 50,
        });
        if (r.status === 201) products.push(dataOf(r)); else bad(`create ws product ${name}`, `${r.status} ${JSON.stringify(r.json)}`);
    }
    check('created 3 wholesale products', products.length === 3);

    suite('wholesaler:pricelists');
    r = await api('GET', '/wholesaler/price-lists', token);
    check('price-list auto-fills tiers', (dataOf(r) || []).every((x) => x.A != null && x.B != null && x.C != null), JSON.stringify(dataOf(r)?.[0]));
    r = await api('PUT', '/wholesaler/price-lists', token, { productId: products[0]._id, tier: 'A', price: 350 });
    check('set tier A price', r.status === 201 && dataOf(r)?.price === 350, JSON.stringify(r.json));

    suite('wholesaler:dealers');
    r = await api('POST', '/wholesaler/dealers', token, { name: 'Bad Dealer', mobile: '9700000000', gstin: BAD_GSTIN });
    check('reject invalid dealer GSTIN', r.status === 400, `got ${r.status}`);
    const dealers = [];
    for (const d of [['Sharma Traders', 'A', '9700000001'], ['Verma Store', 'B', '9700000002'], ['Patel Mart', 'C', '9700000003']]) {
        const [name, tier, mobile] = d;
        r = await api('POST', '/wholesaler/dealers', token, { name, mobile, tier, city: 'Surat', gstin: GOOD_GSTIN, creditLimit: 200000 });
        if (r.status === 201) dealers.push(dataOf(r)); else bad(`create dealer ${name}`, `${r.status} ${JSON.stringify(r.json)}`);
    }
    check('created 3 dealers', dealers.length === 3);

    suite('wholesaler:orders-month');
    const orders = [];
    for (let day = 1; day <= 20; day++) {
        const dealer = dealers[day % dealers.length];
        const items = [{ productId: products[day % products.length]._id, quantity: 20 + (day % 5) * 10 }];
        const partial = day % 2 === 0 ? 7600 : 0;
        const s = await api('POST', '/wholesaler/orders', token, { dealerId: dealer._id, items, source: 'manual', paidAmount: partial });
        if (s.status === 201) orders.push(dataOf(s)); else bad(`day ${day} order`, `${s.status} ${JSON.stringify(s.json)}`);
    }
    check('orders created (20)', orders.length === 20, `got ${orders.length}`);

    suite('wholesaler:order-lifecycle');
    const o = orders[0];
    r = await api('PATCH', `/wholesaler/orders/${o._id}/status`, token, { status: 'confirmed' });
    check('order → confirmed', dataOf(r)?.status === 'confirmed');
    const stockBefore = dataOf(await api('GET', `/wholesaler/products/${o.items[0].productId}`, token))?.currentStock;
    r = await api('PATCH', `/wholesaler/orders/${o._id}/status`, token, { status: 'dispatched' });
    check('order → dispatched', dataOf(r)?.status === 'dispatched');
    const stockAfter = dataOf(await api('GET', `/wholesaler/products/${o.items[0].productId}`, token))?.currentStock;
    check('dispatch decrements stock', stockAfter === stockBefore - o.items[0].quantity, `before=${stockBefore} after=${stockAfter}`);
    r = await api('PATCH', `/wholesaler/orders/${o._id}/status`, token, { status: 'delivered' });
    check('order → delivered', dataOf(r)?.status === 'delivered' && !!dataOf(r)?.deliveredAt);

    suite('wholesaler:payments');
    const dueOrder = orders.find((x) => x.dueAmount > 0);
    if (dueOrder) {
        r = await api('POST', `/wholesaler/orders/${dueOrder._id}/collect`, token, { amount: 5000, mode: 'upi' });
        check('collect order payment', r.status === 201 && dataOf(r)?.order?.dueAmount === +(dueOrder.dueAmount - 5000).toFixed(2), `${r.status}`);
    } else bad('collect order payment', 'no due order found');
    r = await api('POST', `/wholesaler/dealers/${dealers[0]._id}/collect`, token, { amount: 3000, mode: 'cash' });
    check('dealer collect payment', r.status === 200 && dataOf(r)?.applied > 0, `${r.status}`);
    r = await api('GET', '/wholesaler/payments', token);
    check('payments ledger listed', (dataOf(r)?.items?.length || 0) >= 2, `count=${dataOf(r)?.items?.length}`);

    suite('wholesaler:returns');
    r = await api('POST', `/wholesaler/orders/${o._id}/return`, token, { items: [{ productId: o.items[0].productId, quantity: 5 }], reason: 'defective' });
    check('order return (credit note)', r.status === 201 && dataOf(r)?.creditNote?.creditNoteNo?.startsWith('CN/'), `${r.status}`);
    r = await api('GET', '/wholesaler/returns', token);
    check('wholesale returns listed', (dataOf(r)?.items?.length || 0) >= 1);

    suite('wholesaler:quotations');
    r = await api('POST', '/wholesaler/quotations', token, { dealerId: dealers[1]._id, items: [{ productId: products[1]._id, quantity: 30 }] });
    const wq = dataOf(r);
    check('create wholesale quote', r.status === 201 && wq?.status === 'open', JSON.stringify(r.json).slice(0, 150));
    r = await api('POST', `/wholesaler/quotations/${wq._id}/convert`, token, {});
    check('convert quote → order', r.status === 201 && dataOf(r)?.orderNo?.startsWith('ORD/'), JSON.stringify(r.json).slice(0, 150));

    suite('wholesaler:sales-team');
    r = await api('POST', '/wholesaler/sales-team', token, { name: 'Ravi Rep', mobile: '9755550001', salary: 20000 });
    const rep = dataOf(r);
    check('create sales rep', r.status === 201 && !!rep?._id, JSON.stringify(r.json));
    r = await api('POST', '/wholesaler/sales-team/visits', token, { salesRepId: rep._id, dealerId: dealers[0]._id, outcome: 'order', note: 'Placed order' });
    check('record visit', r.status === 201, `${r.status}`);
    r = await api('GET', '/wholesaler/sales-team', token);
    check('sales-team list w/ stats', Array.isArray(dataOf(r)) && dataOf(r).length >= 1);

    suite('wholesaler:reports');
    r = await api('GET', '/wholesaler/reports/tally?period=month', token);
    const tally = dataOf(r);
    check('tally report 200', r.status === 200);
    check('tally totalBilled > 0', (tally?.totalBilled || 0) > 0, `billed=${tally?.totalBilled}`);
    check('tally outstanding > 0', (tally?.outstanding || 0) > 0, `out=${tally?.outstanding}`);
    const ym = new Date().toISOString().slice(0, 7);
    r = await api('GET', `/wholesaler/reports/gst?month=${ym}`, token);
    const gst = dataOf(r);
    check('ws gst report 200', r.status === 200);
    check('ws gst taxable > 0', (gst?.summary?.taxableValue || 0) > 0, `taxable=${gst?.summary?.taxableValue}`);
    check('ws gst b2b (dealer GSTIN) present', (gst?.b2b?.length || 0) >= 1, `b2b=${gst?.b2b?.length}`);

    suite('wholesaler:dashboard+notifications');
    r = await api('GET', '/wholesaler/dashboard', token);
    const dash = dataOf(r);
    check('ws dashboard 200', r.status === 200);
    check('ws dashboard revenue > 0', (dash?.revenue || 0) > 0, `revenue=${dash?.revenue}`);
    check('ws dashboard recentOrders present', (dash?.recentOrders?.length || 0) > 0);
    r = await api('GET', '/wholesaler/notifications', token);
    check('ws notifications endpoint 200', r.status === 200 && Array.isArray(dataOf(r)?.items), `${r.status}`);
}

(async () => {
    try { await testShopkeeper(); } catch (e) { bad('shopkeeper suite crashed', e.stack || e.message); }
    try { await testWholesaler(); } catch (e) { bad('wholesaler suite crashed', e.stack || e.message); }

    const fails = results.filter((r) => !r.pass);
    const bySuite = {};
    for (const r of results) { bySuite[r.suite] ||= { pass: 0, fail: 0 }; r.pass ? bySuite[r.suite].pass++ : bySuite[r.suite].fail++; }
    console.log('\n================ E2E RESULTS ================');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.fail ? '❌' : '✅'} ${s}: ${c.pass} pass${c.fail ? `, ${c.fail} FAIL` : ''}`);
    if (fails.length) {
        console.log(`\n${fails.length} FAILURES:`);
        for (const f of fails) console.log(`  ❌ [${f.suite}] ${f.name} — ${f.detail || ''}`);
    }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})();
