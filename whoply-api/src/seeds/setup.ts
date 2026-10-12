/**
 * First run on a new live database — safe to run again.
 *
 *   ADMIN_MOBILE=98xxxxxxxx ADMIN_PASSWORD='a long password' npm run setup:prod
 *   (in Docker: docker compose run --rm -e ADMIN_MOBILE=… -e ADMIN_PASSWORD=… api node dist/seeds/setup.js)
 *
 * - adds the default subscription plans if there are none (the pricing cards
 *   on the landing site read them)
 * - creates the platform admin login with your mobile and password, or — if
 *   that mobile is already an admin — sets the new password. Admin logins are
 *   their own collection (`adminusers`), apart from the shop users.
 * Creates no demo shops or demo logins (those are `seed` / `seed:reset`, for testing).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Plan from '../models/Plan.js';
import AdminUser, { moveAdminsToOwnCollection } from '../models/AdminUser.js';
import { DEFAULT_PLANS } from './plans.js';
import { normalizePhone } from '../utils/phone.js';

async function main() {
    const mobile = normalizePhone(process.env.ADMIN_MOBILE || '');
    const password = process.env.ADMIN_PASSWORD || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Set ADMIN_MOBILE to your 10-digit mobile number');
    if (password.length < 10) throw new Error('Set ADMIN_PASSWORD to at least 10 characters (this login controls every shop)');
    if (/^(whoply123|password|1234567890)/i.test(password)) throw new Error('Pick a password nobody can guess');

    await mongoose.connect(env.MONGODB_URI);
    console.log(`Connected: ${mongoose.connection.name}`);

    if ((await Plan.countDocuments()) === 0) {
        await Plan.insertMany(DEFAULT_PLANS.map((p) => ({ ...p, isActive: true })));
        console.log(`✅ Added ${DEFAULT_PLANS.length} plans (${DEFAULT_PLANS.map((p) => p.name).join(', ')}) — edit them on the admin Plans page`);
    } else console.log('   Plans already set up — left as they are');

    await moveAdminsToOwnCollection(); // a database from before admins had their own collection
    const existing = await AdminUser.findOne({ mobile }).select('+password');
    if (existing) {
        existing.password = password;
        existing.isActive = true;
        await existing.save();
        console.log(`✅ Admin ${mobile}: password updated`);
    } else {
        await AdminUser.create({ name: 'Whoply Admin', mobile, countryCode: '+91', adminRole: 'super', password });
        console.log(`✅ Admin login created: ${mobile} — sign in at the admin site`);
    }
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error('❌ Setup failed:', e?.message || e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
