/**
 * Moving admin logins out of `users` into their own collection `adminusers`
 * (moveAdminsToOwnCollection in src/models/AdminUser.ts) — what the API does
 * when it starts on a database from before the split.
 * Needs MongoDB (MONGODB_URI's server), not the API. Uses a throwaway database
 * and removes it afterwards.
 *
 *   npx tsx tests/admin-move.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import AdminUser, { moveAdminsToOwnCollection } from '../src/models/AdminUser.js';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: unknown, detail = '') => results.push({ name, pass: !!cond, detail: String(detail).slice(0, 300) });

const server = (process.env.MONGODB_URI || 'mongodb://localhost:27017/whoply').replace(/\/[^/]*$/, '').replace(/\/$/, '');
const NAME = 'whoply_admin_move_test';
const { ObjectId } = mongoose.Types;

(async () => {
    await mongoose.connect(`${server}/${NAME}`);
    const db = mongoose.connection.db!;
    if (db.databaseName !== NAME) throw new Error('wrong database');
    await db.dropDatabase();
    await AdminUser.syncIndexes();
    const users = db.collection('users');
    const admins = db.collection('adminusers');
    const sessions = db.collection('sessions');

    const hash = await bcrypt.hash('Legacy#Pass26', 10);
    const created = new Date('2026-01-05T10:00:00Z');
    const A = new ObjectId(), B = new ObjectId(), C = new ObjectId(), OWNER = new ObjectId(), STAFF = new ObjectId(), EXISTING = new ObjectId();
    await users.insertMany([
        // an admin as it was kept before: a row of `users` with role "admin"
        { _id: A, name: 'Old Billing Admin', mobile: '9811000001', countryCode: '+91', role: 'admin', adminRole: 'billing', password: hash, isActive: true, language: 'en', salary: 0, kyc: { verified: false, documents: [] }, otp: '123456', lastLogin: new Date('2026-10-01T08:00:00Z'), loginFails: 2, twoFactor: { on: true, secret: 'v1.aaa.bbb.ccc', lastStep: 58000000, recovery: ['hash-one', 'hash-two'], since: created }, createdAt: created, updatedAt: created },
        // the very first admin: no adminRole (= super), switched off
        { _id: B, name: 'First Admin', mobile: '9811000002', role: 'admin', password: hash, isActive: false, createdAt: created, updatedAt: created },
        // an admin whose mobile already has a login in the new collection
        { _id: C, name: 'Twice', mobile: '9811000003', role: 'admin', password: hash, isActive: true, createdAt: created, updatedAt: created },
        // shop logins: must not be touched
        { _id: OWNER, name: 'Shop Owner', mobile: '9811000001', role: 'owner', businessId: new ObjectId(), password: hash, isActive: true },
        { _id: STAFF, name: 'Cashier', mobile: '9811000009', role: 'cashier', businessId: new ObjectId(), password: hash, isActive: true },
    ] as any[]);
    await admins.insertOne({ _id: EXISTING, name: 'Already Here', mobile: '9811000003', adminRole: 'viewer', password: 'kept-as-it-is', isActive: true, createdAt: new Date(), updatedAt: new Date() });
    await sessions.insertOne({ token: 'tok-a', userId: A, isActive: true });

    const moved = await moveAdminsToOwnCollection();
    check('it reports the three admin rows it found', moved === 3, `${moved}`);
    check('no admin is left among the users', (await users.countDocuments({ role: 'admin' })) === 0);
    const left = await users.find({}).sort({ name: 1 }).toArray();
    check('shop logins are untouched — even one with an admin’s mobile number', left.length === 2 && left.some((u) => String(u._id) === String(OWNER) && u.role === 'owner' && u.password === hash) && left.some((u) => String(u._id) === String(STAFF)), left.map((u) => `${u.name}:${u.role}`).join(' '));

    const a = await admins.findOne({ _id: A });
    check('the admin is in the admin collection under the same id', !!a && a.name === 'Old Billing Admin' && a.mobile === '9811000001' && a.adminRole === 'billing' && a.isActive === true, JSON.stringify(a && { name: a.name, adminRole: a.adminRole }));
    check('the password travelled as the hash it was — the old password still signs in', a?.password === hash && (await (await AdminUser.findById(A).select('+password'))!.comparePassword('Legacy#Pass26')) === true);
    check('the two-step setup, the wrong-try count and the dates came along', a?.twoFactor?.on === true && a.twoFactor.secret === 'v1.aaa.bbb.ccc' && a.twoFactor.lastStep === 58000000 && a.twoFactor.recovery?.length === 2 && a.loginFails === 2 && +a.createdAt === +created && +a.lastLogin === +new Date('2026-10-01T08:00:00Z'), JSON.stringify(a?.twoFactor));
    const extra = Object.keys(a || {}).filter((k) => !['_id', 'name', 'mobile', 'countryCode', 'email', 'password', 'adminRole', 'isActive', 'lastLogin', 'loginFails', 'loginFailAt', 'lockedUntil', 'twoFactor', 'createdAt', 'updatedAt'].includes(k));
    check('only what an admin signs in with was copied (no role, shop, salary, KYC or OTP fields)', extra.length === 0, `extra: ${extra.join(',')}`);
    check('its open session still points at it', (await sessions.countDocuments({ userId: A, isActive: true })) === 1 && !!(await AdminUser.findById((await sessions.findOne({ token: 'tok-a' }))!.userId)));
    const b = await admins.findOne({ _id: B });
    check('an admin from before roles existed becomes a super admin; "switched off" stays off', b?.adminRole === 'super' && b.isActive === false && b.countryCode === '+91', JSON.stringify(b && { adminRole: b.adminRole, isActive: b.isActive }));
    const sameMobile = await admins.find({ mobile: '9811000003' }).toArray();
    check('a mobile that already has an admin login keeps that one; the old row is simply removed', sameMobile.length === 1 && String(sameMobile[0]._id) === String(EXISTING) && sameMobile[0].password === 'kept-as-it-is' && sameMobile[0].adminRole === 'viewer' && !(await users.findOne({ _id: C })), JSON.stringify(sameMobile.map((x) => x.name)));
    check('three admin logins in all', (await admins.countDocuments({})) === 3, `${await admins.countDocuments({})}`);

    const again = await moveAdminsToOwnCollection();
    const after = await admins.findOne({ _id: A });
    check('running it again changes nothing', again === 0 && (await admins.countDocuments({})) === 3 && (await users.countDocuments({})) === 2 && after?.password === hash, `${again}`);
    await users.insertOne({ _id: new ObjectId(), name: 'Late Admin', mobile: '9811000004', role: 'admin', password: hash, isActive: true } as any);
    const both = await Promise.all([moveAdminsToOwnCollection(), moveAdminsToOwnCollection(), moveAdminsToOwnCollection()]);
    check('several API processes starting at once move an admin exactly once', (await admins.countDocuments({ mobile: '9811000004' })) === 1 && (await users.countDocuments({ role: 'admin' })) === 0, `returned ${both.join(',')}`);

    await db.dropDatabase();
    await mongoose.disconnect();
    const fails = results.filter((r) => !r.pass);
    console.log('\n============ ADMINS MOVE TO THEIR OWN COLLECTION ============');
    for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch(async (e) => {
    console.error('CRASH', e);
    await mongoose.connection.db?.dropDatabase().catch(() => {});
    process.exit(2);
});
