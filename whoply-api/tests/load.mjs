/**
 * Load check — many people using the app at the same moment. Not part of
 * `test:all`; run it by hand against a seeded database:
 *
 *   npm run seed && npm run test:load
 *   USERS=200 SECONDS=30 npm run test:load     (defaults: 50 users for 20 seconds)
 *
 * Each "user" is signed in as a demo owner and keeps opening the screens a
 * shop or a wholesaler opens all day, and makes a bill now and then. Passes
 * when under 1% of requests fail and 95% answer within P95_MS (default 1500).
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const USERS = Number(process.env.USERS) || 50;
const SECONDS = Number(process.env.SECONDS) || 20;
const P95_MS = Number(process.env.P95_MS) || 1500;

async function api(method, path, token, body) {
    const t0 = performance.now();
    try {
        const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body != null ? JSON.stringify(body) : undefined });
        const json = await res.json().catch(() => null);
        return { status: res.status, json, ms: performance.now() - t0 };
    } catch (e) {
        return { status: 0, json: null, ms: performance.now() - t0, error: String(e?.cause?.code || e?.message || e) };
    }
}
const login = async (mobile) => (await api('POST', '/auth/password-login', null, { mobile, password: 'whoply123' })).json?.data?.token;

const SHOP_READS = ['/shopkeeper/dashboard', '/shopkeeper/products?limit=50', '/shopkeeper/billing?limit=20', '/shopkeeper/customers?limit=20', '/shopkeeper/notifications', '/shopkeeper/reports/sales?period=monthly', '/shopkeeper/products?search=a'];
const WS_READS = ['/wholesaler/dashboard', '/wholesaler/orders?limit=20', '/wholesaler/dealers?limit=20', '/wholesaler/products?limit=50', '/wholesaler/notifications'];

(async () => {
    const [shop, whole] = await Promise.all([login('9000000001'), login('9000000010')]);
    if (!shop || !whole) { console.error('Could not sign in — run `npm run seed` first (demo logins).'); process.exit(2); }
    const products = (await api('GET', '/shopkeeper/products?limit=20', shop)).json?.data?.items || [];
    const sellable = products.filter((p) => p.currentStock > 50).slice(0, 5);

    const samples = [];
    const byStatus = {};
    const errors = {};
    const until = Date.now() + SECONDS * 1000;
    const pick = (list) => list[Math.floor(Math.random() * list.length)];

    async function user(i) {
        const wholesale = i % 3 === 0; // a third are wholesalers
        const token = wholesale ? whole : shop;
        while (Date.now() < until) {
            let r;
            // Roughly one request in fifteen is a new bill — writes are the costly part.
            if (!wholesale && sellable.length && Math.random() < 1 / 15) {
                r = await api('POST', '/shopkeeper/billing', token, { items: [{ productId: pick(sellable)._id, quantity: 1 }], paymentMode: 'cash' });
            } else {
                r = await api('GET', pick(wholesale ? WS_READS : SHOP_READS), token);
            }
            samples.push(r.ms);
            byStatus[r.status] = (byStatus[r.status] || 0) + 1;
            if (r.status === 0 || r.status >= 500) errors[r.error || r.json?.error?.message || r.status] = (errors[r.error || r.json?.error?.message || r.status] || 0) + 1;
        }
    }

    console.log(`Load: ${USERS} users for ${SECONDS}s against ${BASE} …`);
    const t0 = Date.now();
    await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
    const took = (Date.now() - t0) / 1000;

    samples.sort((a, b) => a - b);
    const at = (p) => Math.round(samples[Math.min(samples.length - 1, Math.floor(samples.length * p))] || 0);
    const failed = Object.entries(byStatus).filter(([s]) => s === '0' || Number(s) >= 500).reduce((n, [, c]) => n + c, 0);
    const failPct = samples.length ? (failed / samples.length) * 100 : 100;
    const health = await api('GET', '/health', null);

    console.log(`\n============ LOAD ============`);
    console.log(`requests      ${samples.length}  (${Math.round(samples.length / took)} a second)`);
    console.log(`answer time   median ${at(0.5)} ms · 95% under ${at(0.95)} ms · slowest ${at(1)} ms`);
    console.log(`by status     ${Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(' · ')}`);
    console.log(`failed        ${failed} (${failPct.toFixed(2)}%)${failed ? '  ' + JSON.stringify(errors) : ''}`);
    console.log(`after the run the API is ${health.status === 200 ? 'still up and the database is connected' : 'NOT healthy: ' + health.status}`);
    const ok = failPct < 1 && at(0.95) <= P95_MS && health.status === 200;
    console.log(ok ? `\n✅ PASS (under 1% failed, 95% within ${P95_MS} ms)` : `\n❌ FAIL (needs under 1% failed and 95% within ${P95_MS} ms)`);
    process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
