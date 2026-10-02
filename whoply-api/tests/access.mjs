/**
 * Access control and contact inquiries.
 *
 * Admin roles (super / support / billing / viewer): each can do its own job
 * and nothing else, nobody can lock the panel for everyone, writes are logged
 * without passwords. The public "Contact us" form: validation, the hidden
 * bot field, the per-address limit — and the admin's list of inquiries.
 *
 *   npm run seed:reset && npm run test:access
 *   (the per-address checks need the API started with TRUST_PROXY=1)
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 220) }); return !!cond; };
async function api(method, path, token, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* non-json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const pw = (mobile, password = 'whoply123') => api('POST', '/auth/password-login', null, { mobile, password });
const login = async (mobile, password) => d(await pw(mobile, password))?.token;
const from = (ip) => ({ 'X-Forwarded-For': ip });

(async () => {
    const adm = await login('9000000099');
    const st = await login('9000000001');
    const me = d(await api('GET', '/auth/me', adm))?.user;
    const shop = (d(await api('GET', '/admin/businesses?limit=100&lite=1&type=retail', adm))?.items || [])[0];

    suite('admin logins');
    let r = await api('GET', '/admin/access', adm);
    check('the first admin is a super admin with every permission', d(r)?.me?.adminRole === 'super' && d(r).me.perms.includes('admins.manage') && d(r)?.roles?.length === 4, JSON.stringify(d(r)?.me));
    r = await api('POST', '/admin/admins', adm, { name: 'Sana Support', mobile: '9822500001', password: 'Support@2026', adminRole: 'support' });
    check('a support admin is added', r.status === 201 && d(r)?.adminRole === 'support', `${r.status} ${msg(r)}`);
    const supportId = d(r)?._id;
    r = await api('POST', '/admin/admins', adm, { name: 'Bina Billing', mobile: '9822500002', password: 'Billing@2026', adminRole: 'billing' });
    const billingId = d(r)?._id;
    check('a billing admin is added', r.status === 201, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/admins', adm, { name: 'Vik Viewer', mobile: '9822500003', password: 'Viewer@2026', adminRole: 'viewer' });
    check('a viewer is added', r.status === 201, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/admins', adm, { name: 'Weak', mobile: '9822500004', password: 'short', adminRole: 'viewer' });
    check('a short admin password is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/admins', adm, { name: 'Demo', mobile: '9822500004', password: 'whoply123', adminRole: 'viewer' });
    check('the demo password is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/admins', adm, { name: 'Dup', mobile: '9000000001', password: 'Another@2026', adminRole: 'viewer' });
    check('a mobile already in use is refused', r.status === 409, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/admins', adm, { name: 'Odd', mobile: '9822500004', password: 'Another@2026', adminRole: 'owner' });
    check('an unknown admin role is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/admins', adm);
    check('the list shows all four, no passwords', d(r)?.length === 4 && !JSON.stringify(d(r)).includes('password'), JSON.stringify(d(r)?.map((a) => a.adminRole)));

    const sup = await login('9822500001', 'Support@2026');
    const bil = await login('9822500002', 'Billing@2026');
    const vie = await login('9822500003', 'Viewer@2026');
    check('new admins can sign in; the login says which role', !!sup && !!bil && !!vie && d(await pw('9822500001', 'Support@2026'))?.user?.adminRole === 'support', '');

    suite('support role');
    r = await api('GET', '/admin/support/threads', sup);
    check('can open support chats', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/users', sup);
    check('can see users', r.status === 200, `${r.status}`);
    r = await api('PATCH', `/admin/businesses/${shop._id}`, sup, { isActive: false });
    check('can not suspend a business', r.status === 403, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/users', sup, { businessId: shop._id, name: 'X', mobile: '9822500010', role: 'cashier' });
    check('can not add users', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/bills', sup);
    check('can not see bills', r.status === 403, `${r.status}`);
    r = await api('PUT', '/admin/settings', sup, { billing: { upiId: 'evil@upi' } });
    check('can not change settings', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/admins', sup);
    check('can not see admin logins', r.status === 403, `${r.status}`);
    r = await api('POST', '/admin/admins', sup, { name: 'Sneaky', mobile: '9822500011', password: 'Sneaky@2026', adminRole: 'super' });
    check('can not make itself a super admin friend', r.status === 403, `${r.status}`);

    suite('billing role');
    r = await api('POST', '/admin/bills', bil, { businessId: shop._id });
    check('can create a bill', r.status === 201, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/settings', bil);
    check('can read settings (to print bills)', r.status === 200, `${r.status}`);
    r = await api('PUT', '/admin/settings', bil, { billing: { dueDays: 30 } });
    check('…but not change them', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/support/threads', bil);
    check('can not open support chats', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/users', bil);
    check('can not see users', r.status === 403, `${r.status}`);

    suite('viewer role');
    r = await api('GET', '/admin/stats', vie);
    const r2 = await api('GET', '/admin/bills', vie);
    check('can look at the dashboard and bills', r.status === 200 && r2.status === 200, `${r.status} ${r2.status}`);
    r = await api('POST', '/admin/bills/run', vie);
    check('can not bill anyone', r.status === 403, `${r.status}`);
    r = await api('POST', '/admin/plans', vie, { key: 'vip', name: 'VIP', price: 1 });
    check('can not add plans', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/access', vie);
    check('its own access info lists only view permissions', d(r)?.me?.adminRole === 'viewer' && d(r).me.perms.every((p) => p.endsWith('.view')), JSON.stringify(d(r)?.me?.perms));

    suite('nobody gets locked out');
    r = await api('PATCH', `/admin/admins/${me.id}`, adm, { adminRole: 'viewer' });
    check('you can not change your own role', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/admins/${me.id}`, adm, { isActive: false });
    check('…or turn off your own login', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('DELETE', `/admin/admins/${me.id}`, adm);
    check('…or delete yourself', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/admins/${supportId}`, adm, { adminRole: 'super' });
    check('a second super admin can be made', r.status === 200 && d(r)?.adminRole === 'super', `${r.status} ${msg(r)}`);
    const sup2 = await login('9822500001', 'Support@2026');
    r = await api('PATCH', `/admin/admins/${me.id}`, sup2, { adminRole: 'viewer' });
    check('…who may demote the first one (one super remains)', r.status === 200 && d(r)?.adminRole === 'viewer', `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/admins', adm);
    check('the demoted admin loses access at once', r.status === 403, `${r.status}`);
    r = await api('PATCH', `/admin/admins/${supportId}`, sup2, { adminRole: 'support' });
    check('the last super admin can not demote itself', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/admins/${me.id}`, sup2, { adminRole: 'super' });
    check('roles can be given back', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/admins/${supportId}`, adm, { adminRole: 'support' });
    check('…and the helper returned to support', r.status === 200 && d(r)?.adminRole === 'support', `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/admins/${billingId}`, adm, { password: 'NewBilling@2026' });
    check('a password reset works', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/bills', bil);
    check('…and signs that admin out', r.status === 401, `${r.status}`);
    r = await api('PATCH', `/admin/admins/${billingId}`, adm, { isActive: false });
    check('an admin login can be switched off', r.status === 200 && d(r)?.isActive === false, `${r.status} ${msg(r)}`);
    r = await pw('9822500002', 'NewBilling@2026');
    check('…and then can not sign in', r.status !== 200, `${r.status}`);
    r = await api('DELETE', `/admin/admins/${billingId}`, adm);
    check('an admin login can be deleted', r.status === 200, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/admins', st);
    check('a shop owner can not touch admin logins', r.status === 403, `${r.status}`);

    suite('activity log');
    r = await api('GET', '/admin/audit?limit=100', adm);
    const log = d(r)?.items || [];
    check('writes are logged with who and what', log.some((x) => x.action === 'Added an admin login' && x.adminName === me.name) && log.some((x) => x.action === 'Created a subscription bill' && x.adminName === 'Bina Billing'), JSON.stringify(log.slice(0, 4).map((x) => x.action)));
    check('refused requests and reads are not logged', !log.some((x) => /evil|Sneaky/.test(JSON.stringify(x))) && log.every((x) => x.action), `${log.length} rows`);
    check('no password ever reaches the log', !/Support@2026|Billing@2026|password/i.test(JSON.stringify(log)), '');
    r = await api('GET', '/admin/audit', sup);
    check('only a super admin reads the log', r.status === 403, `${r.status}`);

    suite('contact form');
    const good = { name: 'Kiran Patel', mobile: '98225 60001', email: 'kiran@example.com', businessType: 'retail', city: 'Surat', message: 'I want a demo for my kirana shop.', lang: 'en' };
    r = await api('POST', '/public/inquiries', null, good, from('203.0.113.10'));
    check('anyone can send an inquiry', r.status === 201 && d(r)?.ok === true, `${r.status} ${msg(r)}`);
    r = await api('POST', '/public/inquiries', null, good, from('203.0.113.10'));
    check('the same message again is accepted but kept once', r.status === 201, `${r.status}`);
    r = await api('POST', '/public/inquiries', null, { ...good, mobile: '12345' }, from('203.0.113.11'));
    check('a bad mobile is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/public/inquiries', null, { ...good, message: 'hi' }, from('203.0.113.11'));
    check('a too-short message is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/public/inquiries', null, { ...good, email: 'not-an-email' }, from('203.0.113.11'));
    check('a bad email is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/public/inquiries', null, { ...good, message: 'x'.repeat(1001) }, from('203.0.113.11'));
    check('a message over 1000 characters is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/public/inquiries', null, { ...good, mobile: '9822560002', message: 'Buy cheap followers now!!!', website: 'http://spam.example' }, from('203.0.113.12'));
    check('a bot that fills the hidden field gets a polite thanks', r.status === 201, `${r.status}`);
    r = await api('POST', '/public/inquiries', null, { ...good, mobile: '9822560003', message: { $ne: '' } }, from('203.0.113.13'));
    check('an object where text should be is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/inquiries', adm);
    const list = d(r)?.items || [];
    check('the admin sees one inquiry — no duplicate, no bot message', list.length === 1 && list[0].mobile === '9822560001' && list[0].status === 'new' && d(r)?.summary?.new === 1 && list[0].ip === undefined, JSON.stringify(list.map((i) => i.message)));
    const perIp = (await api('GET', '/health', null)).status === 200; // the limit only counts per address behind TRUST_PROXY
    let last;
    for (let i = 0; i < 5; i++) last = await api('POST', '/public/inquiries', null, { ...good, mobile: `982257000${i}`, message: `Question number ${i} from the same office.` }, from('203.0.113.50'));
    check('5 inquiries an hour from one address go through', last.status === 201, `${last.status} ${msg(last)}`);
    r = await api('POST', '/public/inquiries', null, { ...good, mobile: '9822570009', message: 'A sixth one from the same office.' }, from('203.0.113.50'));
    check('the 6th is refused (429)', perIp && r.status === 429, `${r.status} ${msg(r)}`);
    r = await api('POST', '/public/inquiries', null, { ...good, mobile: '9822570010', message: 'From a different office.' }, from('203.0.113.51'));
    check('…another address is not affected', r.status === 201, `${r.status} ${msg(r)}`);

    suite('inquiries in the admin panel');
    r = await api('PATCH', `/admin/inquiries/${list[0]._id}`, sup, { status: 'contacted', note: 'Called, demo on Monday.' });
    check('the support admin marks one contacted with a note', r.status === 200 && d(r)?.status === 'contacted' && d(r)?.note === 'Called, demo on Monday.', `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/inquiries?status=new', adm);
    check('filter by status', d(r)?.items?.length === 6 && d(r).items.every((i) => i.status === 'new'), `${d(r)?.items?.length}`);
    r = await api('GET', '/admin/inquiries?search=kirana', adm);
    check('search in the message', d(r)?.items?.length === 1 && d(r).items[0].name === 'Kiran Patel', JSON.stringify(d(r)?.items?.map((i) => i.name)));
    r = await api('GET', '/admin/inquiries/summary', adm);
    check('the badge counts the new ones', d(r)?.new === 6, JSON.stringify(d(r)));
    r = await api('PATCH', `/admin/inquiries/${list[0]._id}`, adm, { status: 'spam' });
    check('an unknown status is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/inquiries/${list[0]._id}`, vie, { status: 'closed' });
    check('a viewer can read but not change inquiries', r.status === 403 && (await api('GET', '/admin/inquiries', vie)).status === 200, `${r.status}`);
    r = await api('DELETE', `/admin/inquiries/${list[0]._id}`, adm);
    check('an inquiry can be deleted', r.status === 200 && (d(await api('GET', '/admin/inquiries?search=kirana', adm))?.items || []).length === 0, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/inquiries', st);
    check('a shop owner can not read inquiries', r.status === 403, `${r.status}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ ACCESS + INQUIRIES ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
