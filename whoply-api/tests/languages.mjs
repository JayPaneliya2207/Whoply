/**
 * Gujarati and Hindi text. A shop that works in Gujarati types its items,
 * customers, shop name and notes in Gujarati — every one of them must be
 * saved exactly, found by search, kept on the bill, and still readable when
 * the CSV export is opened in Excel (which needs the UTF-8 mark at the start).
 *
 *   npm run seed:reset && npm run test:languages
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 240) }); return !!cond; };
async function api(method, path, token, body) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;
const list = (r) => (Array.isArray(d(r)) ? d(r) : d(r)?.items || []);
const q = encodeURIComponent;

const GU = { item: 'બાસમતી ચોખા ૫ કિલો', category: 'કરિયાણું', customer: 'રમેશભાઈ પટેલ', supplier: 'શ્રી ગણેશ ટ્રેડર્સ', shop: 'શર્મા જનરલ સ્ટોર', address: 'મેઇન બજાર, રાજકોટ', note: 'દુકાનનું ભાડું', staff: 'કિરણ દવે', dealer: 'જય અંબે કિરાણા', ask: 'મારે મારી દુકાન માટે ડેમો જોઈએ છે.' };
const HI = { item: 'टाटा नमक 1 किलो', sku: 'नमक-1', customer: 'सुरेश कुमार', quote: 'अनुमान ग्राहक' };

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');
    const adm = await login('9000000099');

    suite('items in Gujarati and Hindi');
    let r = await api('POST', '/shopkeeper/categories', st, { name: GU.category });
    const cat = d(r);
    check('a category named in Gujarati', r.status === 201 && cat?.name === GU.category, `${r.status} ${msg(r)} ${cat?.name}`);
    r = await api('POST', '/shopkeeper/products', st, { name: GU.item, sku: 'CHOKHA-5', categoryId: cat?._id, sellPrice: 460, costPrice: 400, gstRate: 5, hsn: '1006', unit: 'bag', currentStock: 20 });
    const rice = d(r);
    check('an item named in Gujarati (with Gujarati digits) is saved exactly', r.status === 201 && rice?.name === GU.item, `${r.status} ${msg(r)} ${rice?.name}`);
    r = await api('POST', '/shopkeeper/products', st, { name: HI.item, sku: HI.sku, sellPrice: 28, costPrice: 22, gstRate: 0, unit: 'pcs', currentStock: 50 });
    const salt = d(r);
    check('an item with a Hindi name and a Hindi code', r.status === 201 && salt?.name === HI.item && salt?.sku === HI.sku, `${r.status} ${msg(r)} ${salt?.sku}`);
    r = await api('GET', `/shopkeeper/products?search=${q('ચોખા')}`, st);
    check('search finds the item by a Gujarati word', list(r).length === 1 && list(r)[0].name === GU.item, JSON.stringify(list(r).map((p) => p.name)));
    r = await api('GET', `/shopkeeper/products?search=${q('नमक')}`, st);
    check('…and by a Hindi word', list(r).length === 1 && list(r)[0].name === HI.item, JSON.stringify(list(r).map((p) => p.name)));

    suite('customers, bills and estimates');
    r = await api('POST', '/shopkeeper/customers', st, { name: GU.customer, mobile: '9822700001' });
    const cust = d(r);
    check('a customer named in Gujarati', r.status === 201 && cust?.name === GU.customer, `${r.status} ${msg(r)}`);
    r = await api('GET', `/shopkeeper/customers?search=${q('રમેશ')}`, st);
    check('search finds the customer by part of the name', list(r).some((c) => c.name === GU.customer), JSON.stringify(list(r).map((c) => c.name)));
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: rice?._id, quantity: 2 }, { productId: salt?._id, quantity: 3 }], paymentMode: 'cash', customerId: cust?._id });
    const bill = d(r);
    check('the bill keeps both item names and the customer name', r.status === 201 && bill?.items?.[0]?.name === GU.item && bill?.items?.[1]?.name === HI.item && bill?.customerName === GU.customer, `${r.status} ${msg(r)} ${JSON.stringify([bill?.items?.map((i) => i.name), bill?.customerName])}`);
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: salt?._id, quantity: 1 }], paymentMode: 'cash', walkInName: HI.customer });
    check('a walk-in name typed in Hindi stays on the bill', r.status === 201 && d(r)?.customerName === HI.customer, `${r.status} ${msg(r)} ${d(r)?.customerName}`);
    r = await api('POST', '/shopkeeper/quotations', st, { items: [{ productId: rice?._id, quantity: 1 }], walkInName: HI.quote, walkInMobile: '9822700002', validDays: 7 });
    check('an estimate for a name in Hindi', r.status === 201 && d(r)?.customerName === HI.quote && d(r)?.items?.[0]?.name === GU.item, `${r.status} ${msg(r)} ${d(r)?.customerName}`);

    suite('the CSV export opens right in Excel');
    const res = await fetch(`${BASE}/shopkeeper/reports/export?period=month`, { headers: { Authorization: `Bearer ${st}` } });
    const bytes = Buffer.from(await res.arrayBuffer());
    check('the file starts with the UTF-8 mark, so Excel reads Gujarati and Hindi', res.status === 200 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, `${res.status} first bytes ${[...bytes.subarray(0, 3)].map((b) => b.toString(16)).join(' ')}`);
    const text = bytes.toString('utf8');
    check('…and has the names as they were typed', text.includes(GU.customer) && text.includes(HI.customer), text.split('\n').slice(0, 3).join(' | ').slice(0, 200));

    suite('the shop itself, suppliers, staff and notes');
    r = await api('PATCH', '/shopkeeper/business', st, { name: GU.shop, address: GU.address, city: 'રાજકોટ' });
    check('the shop name and address in Gujarati (they print on every bill)', r.status === 200 && d(r)?.name === GU.shop && d(r)?.address === GU.address, `${r.status} ${msg(r)} ${d(r)?.name}`);
    r = await api('POST', '/shopkeeper/suppliers', st, { name: GU.supplier, mobile: '9822700003' });
    check('a supplier named in Gujarati', r.status === 201 && d(r)?.name === GU.supplier, `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/expenses', st, { category: 'rent', amount: 15000, note: GU.note });
    check('an expense note in Gujarati', r.status === 201 && d(r)?.note === GU.note, `${r.status} ${msg(r)}`);
    r = await api('POST', '/staff', st, { name: GU.staff, mobile: '9822700004', role: 'cashier', salary: 9000, password: 'Cashier@2026' });
    check('a staff member named in Gujarati', r.status === 201 && d(r)?.name === GU.staff, `${r.status} ${msg(r)}`);
    r = await api('POST', '/wholesaler/dealers', ws, { name: GU.dealer, mobile: '9822700005' });
    check('a wholesaler’s dealer named in Gujarati', r.status === 201 && d(r)?.name === GU.dealer, `${r.status} ${msg(r)}`);
    r = await api('GET', `/wholesaler/dealers?search=${q('અંબે')}`, ws);
    check('…and found by search', list(r).some((x) => x.name === GU.dealer), JSON.stringify(list(r).map((x) => x.name)));

    suite('messages to the Whoply team');
    r = await api('POST', '/public/inquiries', null, { kind: 'plan', name: GU.customer, mobile: '9822700006', businessName: GU.shop, businessType: 'retail', city: 'રાજકોટ', message: GU.ask, lang: 'gu' });
    check('a plan request written in Gujarati is accepted', r.status === 201, `${r.status} ${msg(r)}`);
    r = await api('GET', `/admin/inquiries?search=${q('ડેમો')}`, adm);
    const got = (d(r)?.items || [])[0];
    check('…the admin reads it as it was written, and can search it', got?.name === GU.customer && got?.businessName === GU.shop && got?.message === GU.ask, JSON.stringify(got));
    r = await api('POST', '/support/messages', st, { text: GU.ask });
    check('a support message in Gujarati', r.status < 300, `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ GUJARATI + HINDI TEXT ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
