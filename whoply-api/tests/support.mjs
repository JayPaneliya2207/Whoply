/**
 * Support chat: an owner writes to the Whoply team, the admin sees it with an
 * unread count, replies, marks it solved; only the owner and manager of that
 * business can read it; floods and empty messages are refused.
 *
 *   npm run seed:reset && npm run test:support
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
const login = async (mobile, password = 'whoply123') => d(await api('POST', '/auth/password-login', null, { mobile, password }))?.token;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const adm = await login('9000000099');
    const st = await login('9000000001');
    const ws = await login('9000000010');
    await api('POST', '/staff', st, { name: 'Chat Manager', mobile: '9822400001', role: 'manager', password: 'Staff@123' });
    await api('POST', '/staff', st, { name: 'Chat Cashier', mobile: '9822400002', role: 'cashier', password: 'Staff@123' });
    const manager = await login('9822400001', 'Staff@123');
    const cashier = await login('9822400002', 'Staff@123');

    suite('the owner writes');
    let r = await api('GET', '/support', st);
    check('an empty chat opens fine', r.status === 200 && d(r)?.messages?.length === 0 && d(r)?.status === 'open', `${r.status} ${msg(r)}`);
    r = await api('POST', '/support/messages', st, { text: '  My printer bill is cut off at the bottom.  ' });
    check('the owner sends a message (trimmed)', r.status === 201 && d(r)?.text === 'My printer bill is cut off at the bottom.' && d(r)?.from === 'business', `${r.status} ${msg(r)}`);
    r = await api('POST', '/support/messages', st, { text: '   ' });
    check('an empty message is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/support/messages', st, { text: 'x'.repeat(2001) });
    check('a message over 2000 characters is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/support/messages', manager, { text: 'I am the manager — same problem here.' });
    check('the manager can write too', r.status === 201 && d(r)?.senderName === 'Chat Manager', `${r.status} ${msg(r)}`);
    r = await api('GET', '/support', cashier);
    check('a cashier can not open the support chat', r.status === 403, `${r.status}`);
    r = await api('POST', '/support/messages', cashier, { text: 'hi' });
    check('…or write in it', r.status === 403, `${r.status}`);
    r = await api('GET', '/support', null);
    check('nobody without a login', r.status === 401, `${r.status}`);

    suite('the admin answers');
    r = await api('GET', '/admin/support/summary', adm);
    check('the badge counts 2 unread messages in 1 chat', d(r)?.unread === 2 && d(r)?.waiting === 1 && d(r)?.open === 1, JSON.stringify(d(r)));
    r = await api('GET', '/admin/support/threads', adm);
    const thread = d(r)?.items?.[0];
    check('the chat list shows the shop with a preview', d(r)?.items?.length === 1 && thread?.unreadAdmin === 2 && /manager/i.test(thread?.lastText || '') && thread?.businessName, JSON.stringify(thread));
    r = await api('GET', `/admin/support/threads/${thread._id}`, adm);
    check('opening it shows both messages and the owner', d(r)?.messages?.length === 2 && d(r).messages[0].text.startsWith('My printer') && d(r)?.owner?.mobile === '9000000001', JSON.stringify(d(r)?.messages?.map((m) => m.text)));
    r = await api('GET', '/admin/support/summary', adm);
    check('…and clears the unread count', d(r)?.unread === 0 && d(r)?.waiting === 0, JSON.stringify(d(r)));
    await pause(15);
    const before = new Date().toISOString();
    await pause(15);
    r = await api('POST', `/admin/support/threads/${thread._id}/messages`, adm, { text: 'Please choose the A4 template in Settings → Bill design.' });
    check('the admin replies', r.status === 201 && d(r)?.from === 'admin', `${r.status} ${msg(r)}`);
    await api('POST', `/admin/support/threads/${thread._id}/messages`, adm, { text: 'Tell us if that fixes it.' });
    r = await api('GET', '/support/unread', st);
    check('the owner has 2 unread replies', d(r)?.unread === 2, JSON.stringify(d(r)));
    r = await api('GET', '/shopkeeper/notifications', st);
    const supportNotes = (d(r)?.items || []).filter((n) => n.type === 'support');
    check('one bell notification for the two replies', supportNotes.length === 1 && !supportNotes[0].isRead && /A4 template/.test(supportNotes[0].body), JSON.stringify(supportNotes.map((n) => n.body)));
    r = await api('GET', `/support?after=${encodeURIComponent(before)}`, st);
    check('polling returns only what is new', d(r)?.messages?.length === 2 && d(r).messages.every((m) => m.from === 'admin'), JSON.stringify(d(r)?.messages?.map((m) => m.text)));
    r = await api('GET', '/support/unread', st);
    check('reading the chat clears the unread count', d(r)?.unread === 0, JSON.stringify(d(r)));
    r = await api('GET', '/shopkeeper/notifications', st);
    check('…and marks the bell notification read', (d(r)?.items || []).filter((n) => n.type === 'support').every((n) => n.isRead), '');
    r = await api('GET', '/support', st);
    check('the whole chat is in order', d(r)?.messages?.length === 4 && d(r).messages.map((m) => m.from).join() === 'business,business,admin,admin', d(r)?.messages?.map((m) => m.from).join());

    suite('walls between businesses');
    r = await api('GET', '/support', ws);
    check("another business's chat is empty", d(r)?.messages?.length === 0, JSON.stringify(d(r)?.messages?.length));
    r = await api('GET', `/admin/support/threads/${thread._id}`, st);
    check('a shop owner can not use the admin chat API', r.status === 403, `${r.status}`);
    r = await api('GET', '/admin/support/threads/not-an-id', adm);
    check('a bad chat id is a clean 404', r.status === 404, `${r.status} ${msg(r)}`);

    suite('solved and reopened');
    r = await api('PATCH', `/admin/support/threads/${thread._id}`, adm, { status: 'resolved' });
    check('the admin marks the chat solved', r.status === 200 && d(r)?.status === 'resolved', `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/support/threads?status=open', adm);
    check('it leaves the open list', d(r)?.items?.length === 0 && d(r)?.summary?.open === 0, JSON.stringify(d(r)?.summary));
    r = await api('GET', '/support', st);
    check('the owner sees it is solved', d(r)?.status === 'resolved', JSON.stringify(d(r)?.status));
    await api('POST', '/support/messages', st, { text: 'It still happens on the thermal printer.' });
    r = await api('GET', '/admin/support/threads?status=open', adm);
    check('a new message opens it again', d(r)?.items?.length === 1 && d(r).items[0].unreadAdmin === 1, JSON.stringify(d(r)?.items?.map((t) => t.status)));
    r = await api('PATCH', `/admin/support/threads/${thread._id}`, adm, { status: 'deleted' });
    check('an unknown status is refused', r.status === 400, `${r.status} ${msg(r)}`);

    suite('the admin writes first');
    const whole = (d(await api('GET', '/admin/businesses?limit=100&lite=1&type=wholesale', adm))?.items || [])[0];
    r = await api('POST', '/admin/support/threads', adm, { businessId: whole._id, text: 'Welcome to Whoply! Tell us if you need help setting up dealers.' });
    check('the admin starts a chat with a business', r.status === 201 && d(r)?._id, `${r.status} ${msg(r)}`);
    r = await api('GET', '/support', ws);
    check('…and that owner sees it', d(r)?.messages?.length === 1 && d(r).messages[0].from === 'admin', JSON.stringify(d(r)?.messages));
    r = await api('GET', '/admin/support/threads?search=wholesale', adm);
    check('chats can be searched by business name', d(r)?.items?.length === 1 && d(r).items[0].businessType === 'wholesale', JSON.stringify(d(r)?.items?.map((t) => t.businessName)));
    r = await api('POST', '/admin/support/threads', adm, { businessId: whole._id, text: '' });
    check('an empty first message is refused', r.status === 400, `${r.status} ${msg(r)}`);

    suite('flood guard');
    let last;
    for (let i = 0; i < 20; i++) last = await api('POST', '/support/messages', ws, { text: `msg ${i}` });
    check('20 messages in a minute go through', last.status === 201, `${last.status} ${msg(last)}`);
    r = await api('POST', '/support/messages', ws, { text: 'one too many' });
    check('the 21st is refused (429)', r.status === 429, `${r.status} ${msg(r)}`);
    r = await api('POST', '/support/messages', st, { text: 'I am someone else' });
    check('…without stopping other people', r.status === 201, `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ SUPPORT ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
