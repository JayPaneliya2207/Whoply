/**
 * Adding many items at once from a file (POST /products/import): good rows are
 * added with their stock and categories, bad rows are named with the reason,
 * and items that are already there are skipped — never doubled, never changed.
 *
 *   npm run seed:reset && npm run test:import
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 260) }); return !!cond; };
async function api(method, path, token, body) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;
const all = async (tok, base = '/shopkeeper') => d(await api('GET', `${base}/products?limit=100`, tok))?.items || [];

(async () => {
    const st = await login('9000000001');
    const ws = await login('9000000010');

    const FILE = [
        { name: 'Basmati Rice 5kg', sku: 'RICE-5', barcode: '8901111000011', category: 'Grocery', unit: 'bag', hsn: '1006', costPrice: '400', sellPrice: '460', gstRate: '5', stock: '25', lowStock: '5' },
        { name: 'Tata Salt 1kg', barcode: '8901111000028', category: 'grocery', sellPrice: '₹ 28.00', gstRate: '0%', stock: '120' }, // no code, money sign, percent sign
        { name: 'ચોખા ખીચડી 1 કિલો', category: 'કરિયાણું', sellPrice: '95', stock: '0' }, // Gujarati, no code, no barcode
        { name: 'Steel Glass', category: 'Steel', sellPrice: '1,250.50', costPrice: '900' }, // thousands comma
        { name: '', sellPrice: '10' },
        { name: 'No Price Item' },
        { name: 'Bad Price', sellPrice: 'ten' },
        { name: 'Minus Stock', sellPrice: '10', stock: '-4' },
        { name: 'Too Much Tax', sellPrice: '10', gstRate: '140' },
        { name: 'Twice In File', sku: 'RICE-5', sellPrice: '50' },
    ];

    suite('checking a file first');
    let r = await api('POST', '/shopkeeper/products/import', st, { rows: FILE, check: true });
    check('a check says what would happen', r.status === 200 && d(r)?.ready === 4 && d(r)?.created === 0 && d(r)?.errors?.length === 5 && d(r)?.skipped?.length === 1, `${r.status} ${msg(r)} ${JSON.stringify({ ready: d(r)?.ready, e: d(r)?.errors?.length, s: d(r)?.skipped?.length })}`);
    const why = Object.fromEntries((d(r)?.errors || []).map((e) => [e.row, e.reason]));
    check('each bad row is named with a plain reason', /name is missing/i.test(why[5]) && /price is missing/i.test(why[6]) && /not a number/i.test(why[7]) && /less than 0/i.test(why[8]) && /between 0 and 100/i.test(why[9]), JSON.stringify(why));
    check('a code used twice in the file is caught', d(r)?.skipped?.[0]?.row === 10 && /RICE-5/.test(d(r).skipped[0].reason), JSON.stringify(d(r)?.skipped));
    const codes = Object.fromEntries((d(r)?.errors || []).map((e) => [e.row, `${e.why}${e.what ? `:${e.what}` : ''}`]));
    check('each reason also comes as a code, so the app can say it in Hindi or Gujarati', codes[5] === 'noName' && codes[6] === 'noPrice' && codes[7] === 'noPrice' && codes[8] === 'below0:Stock' && codes[9] === 'range100:GST %' && d(r)?.skipped?.[0]?.why === 'sameCode' && d(r).skipped[0].what === 'RICE-5', JSON.stringify(codes));
    check('new categories are listed (capitals do not make a second one)', JSON.stringify(d(r)?.newCategories) === JSON.stringify(['Grocery', 'કરિયાણું', 'Steel']), JSON.stringify(d(r)?.newCategories));
    check('…and nothing was saved', (await all(st)).length === 0, `${(await all(st)).length}`);

    suite('importing');
    r = await api('POST', '/shopkeeper/products/import', st, { rows: FILE });
    check('the good rows are added', r.status === 200 && d(r)?.created === 4 && d(r)?.errors?.length === 5, `${r.status} ${msg(r)} created=${d(r)?.created}`);
    const items = await all(st);
    const rice = items.find((p) => p.sku === 'RICE-5');
    const salt = items.find((p) => p.name === 'Tata Salt 1kg');
    const khichdi = items.find((p) => p.name === 'ચોખા ખીચડી 1 કિલો');
    const glass = items.find((p) => p.name === 'Steel Glass');
    check('prices, GST, unit, HSN and stock are as in the file', rice?.sellPrice === 460 && rice?.costPrice === 400 && rice?.gstRate === 5 && rice?.unit === 'bag' && rice?.hsn === '1006' && rice?.currentStock === 25 && rice?.lowStockThreshold === 5, JSON.stringify(rice));
    check('"₹ 28.00", "0%" and "1,250.50" are read as numbers', salt?.sellPrice === 28 && salt?.gstRate === 0 && glass?.sellPrice === 1250.5, `${salt?.sellPrice} ${salt?.gstRate} ${glass?.sellPrice}`);
    check('a row without a code uses its barcode, or gets the next free code', salt?.sku === '8901111000028' && /^ITM\d{4}$/.test(khichdi?.sku || '') && /^ITM\d{4}$/.test(glass?.sku || '') && khichdi.sku !== glass.sku, `${salt?.sku} ${khichdi?.sku} ${glass?.sku}`);
    check('items land in their categories, "Grocery" and "grocery" being one', rice?.categoryId?.name === 'Grocery' && salt?.categoryId?.name === 'Grocery' && khichdi?.categoryId?.name === 'કરિયાણું', JSON.stringify([rice?.categoryId, salt?.categoryId, khichdi?.categoryId]));
    check('a shop’s prices are saved as MRP (GST included)', rice?.priceIncludesGst === true, `${rice?.priceIncludesGst}`);
    check('stock at or under its alert number is flagged low', khichdi?.isLowStock === true && rice?.isLowStock === false, `${khichdi?.isLowStock} ${rice?.isLowStock}`);
    r = await api('GET', `/shopkeeper/products/${rice?._id}/movements`, st);
    const moves = d(r)?.movements || [];
    check('opening stock is written to the stock history', moves.some((m) => m.reason === 'opening' && m.quantity === 25), JSON.stringify(moves.map((m) => [m.reason, m.quantity])));
    r = await api('POST', '/shopkeeper/billing', st, { items: [{ productId: rice?._id, quantity: 2 }], paymentMode: 'cash' });
    check('an imported item can be billed at once', r.status === 201 && d(r)?.items?.[0]?.name === 'Basmati Rice 5kg', `${r.status} ${msg(r)}`);

    suite('importing the same file again');
    r = await api('POST', '/shopkeeper/products/import', st, { rows: FILE });
    check('nothing is added twice', r.status === 200 && d(r)?.created === 0 && d(r)?.skipped?.length === 5 && (await all(st)).length === 4, `${r.status} created=${d(r)?.created} skipped=${d(r)?.skipped?.length} items=${(await all(st)).length}`);
    check('…and the stock of the item sold in between is untouched', (await all(st)).find((p) => p.sku === 'RICE-5')?.currentStock === 23, `${(await all(st)).find((p) => p.sku === 'RICE-5')?.currentStock}`);
    r = await api('POST', '/shopkeeper/products/import', st, { rows: [{ name: 'Different Name', barcode: '8901111000011', sellPrice: '5' }] });
    check('a barcode that is already there is skipped', d(r)?.created === 0 && /barcode/.test(d(r)?.skipped?.[0]?.reason || ''), JSON.stringify(d(r)?.skipped));

    suite('limits and logins');
    r = await api('POST', '/shopkeeper/products/import', st, { rows: [] });
    check('an empty file is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/products/import', st, { rows: Array.from({ length: 501 }, (_, i) => ({ name: `Bulk ${i}`, sellPrice: '1' })) });
    check('more than 500 rows at once is refused', r.status === 400 && /500/.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/shopkeeper/products/import', st, { rows: Array.from({ length: 500 }, (_, i) => ({ name: `Bulk Item ${i + 1}`, sellPrice: String(10 + i), stock: '3' })) });
    check('500 rows go in one request', r.status === 200 && d(r)?.created === 500, `${r.status} ${msg(r)} created=${d(r)?.created}`);
    r = await api('GET', '/shopkeeper/products?limit=1', st);
    check('…and are all there', d(r)?.meta?.total === 504, `${d(r)?.meta?.total}`);
    r = await api('POST', '/shopkeeper/products/import', st, { rows: [{ name: { $ne: '' }, sellPrice: '1' }] });
    check('an object where text should be is refused', r.status === 400, `${r.status} ${msg(r)}`);
    await api('POST', '/staff', st, { name: 'Import Cashier', mobile: '9811100051', role: 'cashier', password: 'Cashier@2026' });
    const cashier = await login('9811100051', 'Cashier@2026');
    r = await api('POST', '/shopkeeper/products/import', cashier, { rows: [{ name: 'From a cashier', sellPrice: '1' }] });
    check('a cashier can not import', !!cashier && r.status === 403, `${r.status}`);
    r = await api('POST', '/shopkeeper/products/import', null, { rows: [{ name: 'From nobody', sellPrice: '1' }] });
    check('nobody imports without a login', r.status === 401, `${r.status}`);

    suite('each business has its own items');
    r = await api('POST', '/wholesaler/products/import', ws, { rows: [{ name: 'Basmati Rice 5kg', sku: 'RICE-5', sellPrice: '430', stock: '200' }] });
    check('a wholesaler imports the same code into their own list', r.status === 200 && d(r)?.created === 1, `${r.status} ${msg(r)} ${JSON.stringify(d(r)?.skipped)}`);
    const wsItem = (await all(ws, '/wholesaler')).find((p) => p.sku === 'RICE-5');
    check('…with GST on top of the price (wholesale), and the shop’s item unchanged', wsItem?.priceIncludesGst === false && wsItem?.currentStock === 200 && (await all(st)).find((p) => p.sku === 'RICE-5')?.sellPrice === 460, JSON.stringify({ gst: wsItem?.priceIncludesGst, stock: wsItem?.currentStock }));

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ ITEM IMPORT ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
