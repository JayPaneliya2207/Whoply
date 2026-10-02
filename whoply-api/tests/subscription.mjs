/**
 * Subscription bills: the admin bills a business for its plan, the owner sees
 * the bill and how to pay, reminders, "I have paid", marking paid, and billing
 * everyone at once — never twice for the same days.
 *
 *   npm run seed:reset && npm run test:subscription
 *   (MONGODB_URI must point at the same database — one check back-dates a bill)
 */
import 'dotenv/config';
import mongoose from 'mongoose';

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
const near = (a, b) => Math.abs(a - b) < 0.011;

(async () => {
    const adm = await login('9000000099');
    const st = await login('9000000001'); // retail owner — Pro plan (₹299 / month)
    const ws = await login('9000000010'); // wholesale owner — Business plan (₹799 / month)
    const shops = d(await api('GET', '/admin/businesses?limit=100&lite=1', adm))?.items || [];
    const shop = shops.find((b) => b.type === 'retail');
    const whole = shops.find((b) => b.type === 'wholesale');

    suite('settings');
    let r = await api('GET', '/admin/settings', adm);
    check('settings come with defaults', r.status === 200 && d(r)?.billing?.gstRate === 18 && d(r)?.billing?.dueDays === 7 && /\{billNo\}/.test(d(r)?.templates?.bill || ''), JSON.stringify(d(r)?.billing));
    r = await api('PUT', '/admin/settings', adm, { billing: { upiId: 'whoply@upi', dueDays: 5 }, support: { whatsapp: '98765 43210' } });
    check('part of the settings can be saved', r.status === 200 && d(r)?.billing?.upiId === 'whoply@upi' && d(r)?.billing?.dueDays === 5 && d(r)?.support?.whatsapp === '9876543210', `${r.status} ${msg(r)}`);
    check('…without wiping the rest', d(r)?.billing?.gstRate === 18 && d(r)?.company?.name === 'Whoply' && d(r)?.templates?.reminder?.length > 10, JSON.stringify(d(r)?.company));
    r = await api('PUT', '/admin/settings', adm, { company: { gstin: 'NOTAGSTIN' } });
    check('a bad GSTIN is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PUT', '/admin/settings', adm, { billing: { upiId: 'no-at-sign' } });
    check('a bad UPI ID is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PUT', '/admin/settings', adm, { billing: { gstRate: 40 } });
    check('GST above 28% is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/settings', st);
    check('a shop owner can not read the platform settings', r.status === 403, `${r.status}`);

    suite('a bill');
    r = await api('POST', '/admin/bills', adm, { businessId: shop._id });
    const bill = d(r)?.bill;
    check('admin bills the shop for its plan', r.status === 201 && bill?.status === 'due' && bill?.amount === 299 && /^SUB\/\d{6}\/\d{4}$/.test(bill?.billNo || ''), `${r.status} ${msg(r)} ${JSON.stringify(bill)}`);
    check('no GST while the company GSTIN is empty', bill?.gstRate === 0 && bill?.gstAmount === 0 && bill?.total === 299, JSON.stringify({ g: bill?.gstRate, t: bill?.total }));
    const days = Math.round((new Date(bill?.dueDate) - new Date(bill?.periodStart)) / 864e5);
    const span = Math.round((new Date(bill?.periodEnd) - new Date(bill?.periodStart)) / 864e5);
    check('due in 5 days; the period is one month', days === 5 && span >= 28 && span <= 31, `due+${days} span ${span}`);
    check('the WhatsApp text is filled in from the template', d(r)?.whatsapp?.mobile === '9000000001' && d(r).whatsapp.text.includes(bill.billNo) && d(r).whatsapp.text.includes('299') && d(r).whatsapp.text.includes('whoply@upi') && !/\{\w+\}/.test(d(r).whatsapp.text), d(r)?.whatsapp?.text);
    r = await api('POST', '/admin/bills', adm, { businessId: shop._id });
    check('the same period is not billed twice — the next bill follows on', r.status === 201 && d(r)?.bill?.periodStart === bill.periodEnd, `${r.status} ${msg(r)} ${d(r)?.bill?.periodStart} vs ${bill?.periodEnd}`);
    const second = d(r)?.bill;
    r = await api('POST', '/admin/bills', adm, { businessId: shop._id, periodStart: bill.periodStart });
    check('a bill overlapping a live one is refused', r.status === 409, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/bills/${second._id}`, adm, { status: 'cancelled' });
    check('a due bill can be cancelled', r.status === 200 && d(r)?.status === 'cancelled', `${r.status} ${msg(r)}`);

    suite('GST and custom amounts');
    await api('PUT', '/admin/settings', adm, { company: { gstin: '24ABCDE1234F1Z5' } });
    r = await api('POST', '/admin/bills', adm, { businessId: whole._id, periods: 3 });
    const wb = d(r)?.bill;
    check('3 months of the Business plan with 18% GST', r.status === 201 && wb?.amount === 2397 && wb?.gstRate === 18 && near(wb?.gstAmount, 431.46) && near(wb?.total, 2828.46), JSON.stringify({ a: wb?.amount, g: wb?.gstAmount, t: wb?.total }));
    const freeBiz = d(await api('POST', '/admin/businesses', adm, { name: 'Free Shop', type: 'retail', ownerName: 'F Owner', mobile: '9822300001', plan: 'free', password: 'free1234' }))?.business;
    r = await api('POST', '/admin/bills', adm, { businessId: freeBiz._id });
    check('the Free plan has nothing to bill', r.status === 400 && /free/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/bills', adm, { businessId: freeBiz._id, amount: 500, note: 'Setup fee' });
    check('…unless an amount is given', r.status === 201 && d(r)?.bill?.amount === 500 && near(d(r)?.bill?.total, 590), `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/bills', adm, { businessId: shop._id, amount: -5 });
    check('a negative amount is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/bills', adm, { businessId: shop._id, periods: 99 });
    check('more than 36 periods is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', '/admin/bills', st, { businessId: shop._id });
    check('a shop owner can not make bills', r.status === 403, `${r.status}`);

    suite('the owner');
    r = await api('GET', '/subscription', st);
    const mine = d(r);
    check('the owner sees the plan and the bill', r.status === 200 && mine?.plan?.key === 'pro' && mine?.bills?.length === 1 && mine.bills[0].billNo === bill.billNo, `${r.status} ${msg(r)} ${JSON.stringify(mine?.bills?.map((b) => b.billNo))}`);
    check('…with the total due and how to pay', mine?.due?.count === 1 && mine.due.total === 299 && mine?.payTo?.upiId === 'whoply@upi' && mine?.support?.whatsapp === '9876543210', JSON.stringify({ due: mine?.due, payTo: mine?.payTo }));
    check('…but not the message templates or reminder rules', !JSON.stringify(mine).includes('remindDaysBefore') && !JSON.stringify(mine).includes('{billNo}'), '');
    check('the cancelled bill is not shown', !mine?.bills?.some((b) => b.billNo === second.billNo), '');
    r = await api('GET', '/shopkeeper/notifications', st);
    check('a notification told the owner about the bill', (d(r)?.items || []).some((n) => n.type === 'subscription' && /bill/i.test(n.title)), JSON.stringify((d(r)?.items || []).map((n) => n.type)));
    r = await api('GET', '/subscription', ws);
    check("another business sees only its own bills", d(r)?.bills?.length === 1 && d(r).bills[0].billNo === wb.billNo, JSON.stringify(d(r)?.bills?.map((b) => b.billNo)));
    await api('POST', '/staff', st, { name: 'Sub Cashier', mobile: '9822300002', role: 'cashier', password: 'Staff@123' });
    const cashier = await login('9822300002', 'Staff@123');
    r = await api('GET', '/subscription', cashier);
    check('staff can not see what the shop pays Whoply', r.status === 403, `${r.status}`);
    r = await api('POST', `/subscription/bills/${wb._id}/claim`, st, { ref: 'UPI123' });
    check("the owner can not claim another business's bill", r.status === 404, `${r.status} ${msg(r)}`);
    r = await api('POST', `/subscription/bills/${bill._id}/claim`, st, { ref: 'UPI-REF-778899' });
    check('"I have paid" is recorded for the admin', r.status === 200 && d(r)?.claimRef === 'UPI-REF-778899' && d(r)?.status === 'due', `${r.status} ${msg(r)}`);

    suite('reminders');
    r = await api('POST', `/admin/bills/${bill._id}/remind`, adm);
    check('admin sends a reminder', r.status === 200 && d(r)?.bill?.reminders === 1 && d(r)?.whatsapp?.text?.includes('Reminder'), `${r.status} ${msg(r)}`);
    r = await api('GET', '/shopkeeper/notifications', st);
    check('…the owner gets it in the app', (d(r)?.items || []).some((n) => n.type === 'subscription' && /reminder/i.test(n.title)), JSON.stringify((d(r)?.items || []).map((n) => n.title)));
    r = await api('GET', '/admin/bills?status=due', adm);
    check('the list shows who says they paid', d(r)?.summary?.claimedCount === 1 && d(r)?.summary?.dueCount === 3 && d(r).items.find((b) => b._id === bill._id)?.claimRef === 'UPI-REF-778899', JSON.stringify(d(r)?.summary));
    // Back-date the wholesaler's bill so it is overdue.
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whoply');
    await mongoose.connection.db.collection('subscriptionbills').updateOne({ billNo: wb.billNo }, { $set: { dueDate: new Date(Date.now() - 3 * 864e5) } });
    await mongoose.disconnect();
    r = await api('GET', '/admin/bills?status=overdue', adm);
    check('overdue bills can be filtered', d(r)?.items?.length === 1 && d(r).items[0].billNo === wb.billNo && d(r).items[0].overdue === true && d(r)?.summary?.overdueCount === 1, JSON.stringify(d(r)?.items?.map((b) => b.billNo)));
    r = await api('GET', '/subscription', ws);
    check('…and the owner is told it is overdue', d(r)?.due?.overdue === true && d(r).bills[0].overdue === true, JSON.stringify(d(r)?.due));
    r = await api('GET', `/admin/bills?search=${encodeURIComponent(bill.billNo)}`, adm);
    check('search by bill number', d(r)?.items?.length === 1 && d(r).items[0]._id === bill._id, JSON.stringify(d(r)?.items?.map((b) => b.billNo)));

    suite('paid');
    r = await api('PATCH', `/admin/bills/${bill._id}`, adm, { status: 'paid', paidMode: 'bitcoin' });
    check('an unknown payment mode is refused', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/bills/${bill._id}`, adm, { status: 'paid', paidMode: 'upi', paidRef: 'UPI-REF-778899' });
    check('admin marks the bill paid', r.status === 200 && d(r)?.status === 'paid' && d(r)?.paidMode === 'upi' && d(r)?.paidAt, `${r.status} ${msg(r)}`);
    r = await api('GET', '/subscription', st);
    check('the plan is paid up to the end of the period', d(r)?.paidUntil === bill.periodEnd && d(r)?.due?.count === 0 && d(r).bills[0].status === 'paid', JSON.stringify({ paidUntil: d(r)?.paidUntil, end: bill.periodEnd }));
    r = await api('PATCH', `/admin/bills/${bill._id}`, adm, { status: 'paid' });
    check('a paid bill can not be paid again', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('PATCH', `/admin/bills/${bill._id}`, adm, { status: 'cancelled' });
    check('…or cancelled', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('POST', `/admin/bills/${bill._id}/remind`, adm);
    check('…or reminded', r.status === 400, `${r.status} ${msg(r)}`);
    r = await api('GET', '/admin/stats', adm);
    check('the dashboard shows money collected and still due', d(r)?.billing?.collectedThisMonth === 299 && d(r)?.billing?.dueCount === 2 && d(r)?.billing?.overdueCount === 1, JSON.stringify(d(r)?.billing));

    suite('bill everyone');
    const proShop = d(await api('POST', '/admin/businesses', adm, { name: 'Second Pro Shop', type: 'retail', ownerName: 'P Owner', mobile: '9822300003', plan: 'pro', password: 'pro12345' }))?.business;
    r = await api('POST', '/admin/bills/run', adm);
    check('only businesses without a live bill are billed', r.status === 200 && d(r)?.created === 1, `${r.status} ${JSON.stringify(d(r))}`);
    r = await api('GET', `/admin/bills?businessId=${proShop._id}`, adm);
    check('…the new Pro shop got its bill', d(r)?.items?.length === 1 && d(r).items[0].amount === 299, JSON.stringify(d(r)?.items?.map((b) => b.amount)));
    r = await api('POST', '/admin/bills/run', adm);
    check('running it again bills nobody twice', r.status === 200 && d(r)?.created === 0, JSON.stringify(d(r)));
    r = await api('GET', `/admin/bills/${wb._id}`, adm);
    check('one bill opens with the issuer details for printing', r.status === 200 && d(r)?.bill?.billNo === wb.billNo && d(r)?.company?.gstin === '24ABCDE1234F1Z5' && d(r)?.billing?.upiId === 'whoply@upi', `${r.status} ${msg(r)}`);

    const fails = results.filter((x) => !x.pass);
    const bySuite = {};
    for (const x of results) { bySuite[x.S] ||= { p: 0, f: 0 }; x.pass ? bySuite[x.S].p++ : bySuite[x.S].f++; }
    console.log('\n============ SUBSCRIPTION ============');
    for (const [s, c] of Object.entries(bySuite)) console.log(`${c.f ? '❌' : '✅'} ${s}: ${c.p} pass${c.f ? `, ${c.f} FAIL` : ''}`);
    if (fails.length) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  ❌ [${f.S}] ${f.name} — ${f.detail}`); }
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
