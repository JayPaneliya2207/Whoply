/**
 * Admin logins are their own collection (models/AdminUser.ts), apart from the
 * shop users: two separate sign-in doors, one mobile number may be both an
 * admin and a shop login without the two touching each other, and an admin's
 * token has no place in a shop login's account.
 *
 *   npm run seed:reset && npm run test:adminusers
 */
const BASE = process.env.API_URL || 'http://localhost:7000/api';
const results = [];
let S = '';
const suite = (s) => (S = s);
const check = (name, cond, detail = '') => { results.push({ S, name, pass: !!cond, detail: String(detail).slice(0, 260) }); return !!cond; };
async function api(method, path, token, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
}
const d = (r) => r.json?.data;
const msg = (r) => r.json?.error?.message || '';
const shopDoor = (mobile, password = 'whoply123', headers) => api('POST', '/auth/password-login', null, { mobile, password }, headers);
const adminDoor = (mobile, password = 'whoply123', headers) => api('POST', '/auth/admin-login', null, { mobile, password }, headers);

(async () => {
    suite('two separate doors');
    let r = await adminDoor('9000000099');
    const adm = d(r)?.token;
    const admin = d(r)?.user;
    check('the admin signs in at the admin door', r.status === 200 && !!adm && admin?.role === 'admin' && admin?.adminRole === 'super' && admin?.business === null, `${r.status} ${msg(r)} ${JSON.stringify(admin)}`);
    r = await shopDoor('9000000099');
    const otp = await api('POST', '/auth/login', null, { mobile: '9000000099' });
    check('the shop app’s doors (password, OTP) do not know the admin', r.status === 404 && !d(r)?.token && otp.status === 404, `${r.status} ${otp.status}`);
    r = await shopDoor('9000000001');
    const st = d(r)?.token;
    const owner = d(r)?.user;
    check('a shop owner signs in at the shop door, with nothing admin about the login', r.status === 200 && !!st && owner?.role === 'owner' && owner?.adminRole === undefined && owner?.twoStep === undefined, JSON.stringify(owner));
    r = await adminDoor('9000000001');
    check('the admin door does not know a shop owner', r.status === 404 && !d(r)?.token && /no admin login/i.test(msg(r)), `${r.status} ${msg(r)}`);
    const meAdmin = d(await api('GET', '/auth/me', adm))?.user;
    const meOwner = d(await api('GET', '/auth/me', st))?.user;
    check('"who am I" answers each with their own kind of login', meAdmin?.role === 'admin' && meAdmin?.mobile === '9000000099' && meOwner?.role === 'owner' && meOwner?.business?.name === 'My Retail Shop', JSON.stringify([meAdmin?.role, meOwner?.role]));
    const users = d(await api('GET', '/admin/users?limit=100', adm))?.items || [];
    const admins = d(await api('GET', '/admin/admins', adm)) || [];
    check('the Users page lists no admin, the admin list no shop login', users.length >= 2 && users.every((u) => u.mobile !== '9000000099' && u.role !== 'admin') && admins.length === 1 && admins[0].mobile === '9000000099', `users: ${users.map((u) => u.mobile).join(',')} | admins: ${admins.map((a) => a.mobile).join(',')}`);

    suite('one mobile number, two logins');
    r = await api('POST', '/admin/admins', adm, { name: 'Owner Who Is Also Admin', mobile: '9000000001', password: 'Admin#Owner26', adminRole: 'support' });
    const twinId = d(r)?._id;
    check('a shop owner’s mobile can be given an admin login of its own', r.status === 201 && !!twinId && twinId !== owner?.id, `${r.status} ${msg(r)}`);
    r = await adminDoor('9000000001', 'Admin#Owner26');
    const twin = d(r)?.token;
    const asShop = await adminDoor('9000000001', 'whoply123');
    check('at the admin door it opens with the admin password only', r.status === 200 && d(r)?.user?.adminRole === 'support' && d(r)?.user?.id === twinId && asShop.status === 400 && /incorrect password/i.test(msg(asShop)), `${r.status} ${asShop.status} ${msg(asShop)}`);
    r = await shopDoor('9000000001', 'whoply123');
    const asAdmin = await shopDoor('9000000001', 'Admin#Owner26');
    check('at the shop door it opens with the shop password only', r.status === 200 && d(r)?.user?.role === 'owner' && d(r)?.user?.id === owner?.id && asAdmin.status === 400, `${r.status} ${asAdmin.status} ${msg(asAdmin)}`);
    const a1 = await api('GET', '/admin/access', twin);
    const a2 = await api('GET', '/admin/access', st);
    const s1 = await api('GET', '/shopkeeper/dashboard', twin);
    const s2 = await api('GET', '/shopkeeper/dashboard', st);
    check('each token opens only its own side: admin panel or shop', a1.status === 200 && a2.status === 403 && s1.status === 403 && s2.status === 200, `admin panel ${a1.status}/${a2.status} · shop ${s1.status}/${s2.status}`);
    r = await api('PATCH', `/admin/admins/${twinId}`, adm, { isActive: false });
    const offAdmin = await adminDoor('9000000001', 'Admin#Owner26');
    const stillShop = await shopDoor('9000000001');
    check('switching the admin login off leaves the shop login alone', r.status === 200 && offAdmin.status === 403 && stillShop.status === 200 && (await api('GET', '/shopkeeper/dashboard', st)).status === 200, `${r.status} admin ${offAdmin.status} shop ${stillShop.status}`);
    r = await api('DELETE', `/admin/admins/${twinId}`, adm);
    const goneAdmin = await adminDoor('9000000001', 'Admin#Owner26');
    check('deleting the admin login leaves the shop login and its shop', r.status === 200 && goneAdmin.status === 404 && (await shopDoor('9000000001')).status === 200 && d(await api('GET', '/auth/me', st))?.user?.business?.name === 'My Retail Shop', `${r.status} ${goneAdmin.status}`);
    r = await api('PATCH', `/admin/users/${owner?.id}`, adm, { isActive: false });
    const adminAfter = await api('GET', '/admin/access', adm);
    await api('PATCH', `/admin/users/${owner?.id}`, adm, { isActive: true });
    check('…and switching a shop login off never touches an admin', adminAfter.status === 200, `${r.status} ${adminAfter.status}`);

    suite('an admin’s token stays out of shop accounts');
    const p = await api('PATCH', '/auth/profile', adm, { name: 'Not A Shop' });
    const c = await api('POST', '/auth/change-password', adm, { currentPassword: 'whoply123', newPassword: 'Changed#By26' });
    const o = await api('POST', '/auth/onboarding', adm, { businessName: 'Admin Made Shop', type: 'retail' });
    check('profile, password change and "create my business" are for shop logins', p.status === 403 && c.status === 403 && o.status === 403, `${p.status} ${c.status} ${o.status}`);
    check('…so the admin’s password is unchanged and no business appeared', (await adminDoor('9000000099')).status === 200 && (d(await api('GET', '/admin/businesses?limit=100', adm))?.items || []).every((b) => b.name !== 'Admin Made Shop'));
    // (the owner was switched off and on above, which ended the old session: sign in again)
    r = await api('GET', '/auth/two-step', d(await shopDoor('9000000001'))?.token);
    check('two-step sign-in stays an admin thing', r.status === 403, `${r.status}`);

    suite('wrong tries at one door do not lock the other');
    await api('POST', '/admin/admins', adm, { name: 'Wholesaler Twin', mobile: '9000000010', password: 'Admin#Whole26', adminRole: 'viewer' });
    const n = () => 1 + Math.floor(Math.random() * 250);
    const from = { 'X-Forwarded-For': `10.${n()}.${n()}.${n()}` }; // a new address every run — the API keeps the counts in memory
    const tries = [];
    for (let i = 0; i < 5; i++) tries.push((await adminDoor('9000000010', 'wrong-guess', from)).status);
    r = await adminDoor('9000000010', 'Admin#Whole26', from);
    check('5 wrong passwords at the admin door lock that admin login', tries.slice(0, 4).every((x) => x === 400) && tries[4] === 429 && r.status === 429, `${tries.join(',')} → ${r.status}`);
    r = await shopDoor('9000000010', 'whoply123', from);
    check('the shop login with the same mobile is not locked by it', r.status === 200 && d(r)?.user?.role === 'owner', `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ ADMIN LOGINS, APART FROM SHOP USERS ============');
    for (const [s, c2] of Object.entries(bySuite)) console.log(`${c2.f ? '❌' : '✅'} ${s}: ${c2.p} pass${c2.f ? `, ${c2.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
