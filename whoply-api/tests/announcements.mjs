/**
 * App popups (announcements): the admin makes one — headline, poster, dates,
 * on / off — and the app shows it only while it is live, only to the logins
 * it is meant for.
 *
 *   npm run seed:reset && npm run test:popups
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
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// India-time day, n days from today, as YYYY-MM-DD
const ymd = (n) => new Date(Date.now() + 5.5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
const titles = (r) => (d(r)?.items || []).map((a) => a.title);

(async () => {
    const adm = await login('9000000099');
    const shop = await login('9000000001');
    const wholesale = await login('9000000010');

    suite('the admin makes a popup');
    let r = await api('POST', '/admin/announcements', adm, { title: 'Diwali offer: 2 months free on the yearly plan', body: 'Pay for 10 months, use Whoply for 12. Until 31 October.', image: PNG, linkUrl: 'https://whoply.example/offer', linkLabel: 'See the offer', startDate: ymd(-1), endDate: ymd(5) });
    const offer = d(r);
    check('a popup with a headline, text, poster, button and dates is saved', r.status === 201 && offer?._id && offer.status === 'live' && offer.hasImage === true && offer.startDate === ymd(-1) && offer.endDate === ymd(5), `${r.status} ${msg(r)} ${JSON.stringify({ s: offer?.status, a: offer?.startDate, b: offer?.endDate })}`);
    r = await api('POST', '/admin/announcements', adm, { title: ' ', body: 'no headline' });
    check('it needs a headline', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/announcements', adm, { title: 'Bad link', linkUrl: 'javascript:alert(1)' });
    check('a button link that is not https is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/announcements', adm, { title: 'Bad poster', image: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+' });
    check('an SVG (it can carry a script) is refused as a poster', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/announcements', adm, { title: 'Too big', image: 'data:image/png;base64,' + 'A'.repeat(1_500_000) });
    check('a poster over the size limit is refused', r.status === 400 || r.status === 413, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/announcements', adm, { title: 'Backwards dates', startDate: ymd(5), endDate: ymd(2) });
    check('an end date before the start date is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/announcements', adm, { title: 'Not a date', startDate: 'tomorrow' });
    check('a date must be a date', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/announcements', adm, { title: { $ne: '' } });
    check('an object where text should be is refused', r.status === 400, `${r.status} ${msg(r)}`);

    const mk = async (body) => d(await api('POST', '/admin/announcements', adm, body));
    const later = await mk({ title: 'Starts next week', startDate: ymd(7) });
    const past = await mk({ title: 'Ended yesterday', startDate: ymd(-9), endDate: ymd(-1) });
    const off = await mk({ title: 'Switched off', isActive: false });
    const wsOnly = await mk({ title: 'For wholesalers only', audience: 'wholesale' });
    const forAll = await mk({ title: 'New: reports by staff', staffToo: true });
    const today = await mk({ title: 'Today only', startDate: ymd(0), endDate: ymd(0) });
    check('each one knows where it stands', later?.status === 'scheduled' && past?.status === 'ended' && off?.status === 'off' && wsOnly?.status === 'live' && today?.status === 'live', JSON.stringify([later?.status, past?.status, off?.status, wsOnly?.status, today?.status]));
    r = await api('GET', '/admin/announcements', adm);
    check('the list has them all, newest first, without the poster data', d(r)?.items?.length === 7 && d(r).items[0].title === 'Today only' && d(r).items.every((a) => a.image === undefined) && d(r).live === 4, `${d(r)?.items?.length} live=${d(r)?.live}`);
    r = await api('GET', `/admin/announcements/${offer._id}`, adm);
    check('opening one gives the poster back for editing', d(r)?.image === PNG, `${r.status}`);

    suite('what the app shows');
    r = await api('GET', '/announcements', shop);
    check('a shop owner gets only what is live and meant for shops', r.status === 200 && JSON.stringify(titles(r)) === JSON.stringify(['Today only', 'New: reports by staff', 'Diwali offer: 2 months free on the yearly plan']), JSON.stringify(titles(r)));
    const shown = (d(r)?.items || []).find((a) => a._id === offer._id);
    check('…with the text, the button and a picture address — not the picture data', shown?.body?.startsWith('Pay for 10') && shown?.linkUrl === 'https://whoply.example/offer' && shown?.linkLabel === 'See the offer' && shown?.imagePath?.startsWith(`/public/announcements/${offer._id}/image?v=`) && shown.image === undefined, JSON.stringify(shown));
    check('…and no picture address when there is no poster', (d(r)?.items || []).find((a) => a.title === 'Today only')?.imagePath === '', JSON.stringify(d(r)?.items?.[0]));
    r = await api('GET', '/announcements', wholesale);
    check('a wholesaler also gets the wholesale one', titles(r).includes('For wholesalers only') && titles(r).length === 4, JSON.stringify(titles(r)));
    await api('POST', '/staff', shop, { name: 'Counter Cashier', mobile: '9811100041', role: 'cashier', salary: 9000, password: 'Cashier@2026' });
    const cashier = await login('9811100041', 'Cashier@2026');
    r = await api('GET', '/announcements', cashier);
    check('staff get only the ones marked for staff too', !!cashier && JSON.stringify(titles(r)) === JSON.stringify(['New: reports by staff']), JSON.stringify(titles(r)));
    r = await api('GET', '/announcements', null);
    check('nobody gets them without a login', r.status === 401, `${r.status}`);

    suite('the poster picture');
    let img = await fetch(BASE + shown.imagePath);
    const bytes = Buffer.from(await img.arrayBuffer());
    check('a live popup’s poster loads as a real PNG', img.status === 200 && img.headers.get('content-type') === 'image/png' && bytes.subarray(1, 4).toString() === 'PNG', `${img.status} ${img.headers.get('content-type')}`);
    await api('PATCH', `/admin/announcements/${later._id}`, adm, { image: PNG });
    img = await fetch(`${BASE}/public/announcements/${later._id}/image`);
    check('a popup that has not started yet does not give out its poster', img.status === 404, `${img.status}`);
    img = await fetch(`${BASE}/public/announcements/not-an-id/image`);
    check('a made-up id is a clean 400 / 404', [400, 404].includes(img.status), `${img.status}`);

    suite('switching and changing');
    r = await api('PATCH', `/admin/announcements/${offer._id}`, adm, { isActive: false });
    check('the admin switches one off', r.status === 200 && d(r)?.status === 'off' && d(r)?.hasImage === true, `${r.status} ${msg(r)} ${d(r)?.status}`);
    check('…and it is gone from the app at once', !titles(await api('GET', '/announcements', shop)).some((t) => t.startsWith('Diwali')), '');
    img = await fetch(BASE + shown.imagePath);
    check('…and so is its poster', img.status === 404, `${img.status}`);
    r = await api('PATCH', `/admin/announcements/${offer._id}`, adm, { isActive: true, endDate: ymd(-2) });
    check('an end date before the start date is refused on an edit too', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/announcements/${off._id}`, adm, { isActive: true, title: 'Switched on again', endDate: '' });
    check('switching on with a new headline', r.status === 200 && d(r)?.status === 'live' && d(r)?.title === 'Switched on again' && d(r)?.endDate === '', `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/announcements/${past._id}`, adm, { endDate: ymd(3) });
    check('moving the end date forward makes an ended one live again', d(r)?.status === 'live' && d(r)?.endDate === ymd(3), `${d(r)?.status} ${d(r)?.endDate}`);
    r = await api('PATCH', `/admin/announcements/${offer._id}`, adm, { image: '' });
    check('the poster can be removed', r.status === 200 && d(r)?.hasImage === false && d(r)?.image === '', `${r.status} ${d(r)?.hasImage}`);
    r = await api('DELETE', `/admin/announcements/${wsOnly._id}`, adm);
    check('a popup can be deleted', r.status === 200 && !titles(await api('GET', '/announcements', wholesale)).includes('For wholesalers only'), `${r.status}`);
    r = await api('PATCH', `/admin/announcements/${wsOnly._id}`, adm, { title: 'Ghost' });
    check('…and is then not found', r.status === 404, `${r.status}`);

    suite('who may manage popups');
    r = await api('POST', '/admin/announcements', shop, { title: 'From a shop owner' });
    check('a shop owner can not make one', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/announcements', shop);
    check('…or list them', r.status === 403, `${r.status}`);
    await api('POST', '/admin/admins', adm, { name: 'Vik Viewer', mobile: '9811100042', password: 'Viewer@2026x', adminRole: 'viewer' });
    const viewer = await login('9811100042', 'Viewer@2026x');
    r = await api('POST', '/admin/announcements', viewer, { title: 'From a viewer' });
    check('a viewer admin can not make one', !!viewer && r.status === 403, `${r.status} viewer=${!!viewer}`);
    r = await api('GET', '/admin/audit', adm);
    const log = d(r)?.items || d(r) || [];
    check('popup changes are in the activity log', log.some((x) => x.action === 'Created an app popup') && log.some((x) => x.action === 'Deleted an app popup'), JSON.stringify(log.slice(0, 3).map((x) => x.action)));

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ APP POPUPS ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
