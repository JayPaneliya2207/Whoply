/**
 * Switches off two-step sign-in for one admin login — for when the phone with
 * the authenticator app is lost and no recovery code is left, or after
 * JWT_SECRET was changed (the stored secrets can then no longer be read).
 *
 *   npm run admin:2fa-off -- 98xxxxxxxx
 *   (on a live server: npm run admin:2fa-off:prod -- 98xxxxxxxx
 *    in Docker: docker compose run --rm api node dist/seeds/two-step-off.js 98xxxxxxxx)
 *
 * The admin then signs in with the password alone and can turn it on again.
 * Their open sessions are ended.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import AdminUser, { moveAdminsToOwnCollection } from '../models/AdminUser.js';
import Session from '../models/Session.js';
import { normalizePhone } from '../utils/phone.js';

async function main() {
    const mobile = normalizePhone(process.argv[2] || process.env.ADMIN_MOBILE || '');
    if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Give the admin’s 10-digit mobile number: npm run admin:2fa-off -- 98xxxxxxxx');

    await mongoose.connect(env.MONGODB_URI);
    console.log(`Connected: ${mongoose.connection.name}`);

    await moveAdminsToOwnCollection(); // a database from before admins had their own collection
    const admin = await AdminUser.findOne({ mobile }).select('name twoFactor.on');
    if (!admin) throw new Error(`No admin login with the mobile ${mobile}`);
    if (!admin.twoFactor?.on) console.log(`   Two-step sign-in was not on for ${admin.name} (${mobile}) — nothing to do`);
    else {
        await AdminUser.updateOne({ _id: admin._id }, { $unset: { twoFactor: 1 } });
        await Session.updateMany({ userId: admin._id, isActive: true }, { isActive: false });
        console.log(`✅ Two-step sign-in is off for ${admin.name} (${mobile}). They sign in with the password and can turn it on again.`);
    }
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error('❌ Failed:', e?.message || e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
