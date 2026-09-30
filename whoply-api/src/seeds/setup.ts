/**
 * First run on a new live database — safe to run again.
 *
 *   ADMIN_MOBILE=98xxxxxxxx ADMIN_PASSWORD='a long password' npm run setup:prod
 *   (in Docker: docker compose run --rm -e ADMIN_MOBILE=… -e ADMIN_PASSWORD=… api node dist/seeds/setup.js)
 *
 * - adds the default subscription plans if there are none (the pricing cards
 *   on the landing site read them)
 * - creates the platform admin login with your mobile and password, or — if
 *   that mobile is already the admin — sets the new password
 * Creates no demo shops or demo logins (those are `seed` / `seed:reset`, for testing).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
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

    const existing = await User.findOne({ mobile }).select('+password');
    if (existing && existing.role !== 'admin') throw new Error(`${mobile} is already a ${existing.role} login of a shop — use another mobile for the admin`);
    if (existing) {
        existing.password = password;
        existing.isActive = true;
        await existing.save();
        console.log(`✅ Admin ${mobile}: password updated`);
    } else {
        await User.create({ name: 'Whoply Admin', mobile, countryCode: '+91', role: 'admin', password });
        console.log(`✅ Admin login created: ${mobile} — sign in at the admin site`);
    }
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error('❌ Setup failed:', e?.message || e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
