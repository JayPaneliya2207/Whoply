/**
 * Whoply RESET — backs up the database, wipes every collection and re-creates ONLY
 * what you need to log in and start testing with a clean slate. No demo products /
 * bills / orders / dealers / customers.
 *
 *   npm run db:clear        (same as npm run seed:reset)
 *
 * The backup goes to ../backups/<database>/ like `npm run backup`; undo with
 * `npm run restore`. Set RESET_BACKUP=off to skip it (the tests do).
 *
 * Logins (password: whoply123 · dev OTP: 123456):
 *   Shopkeeper (retail) owner   : 9000000001
 *   Wholesaler owner            : 9000000010
 *   Platform admin              : 9000000099
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { refuseOnLiveDatabase } from './guard.js';
import Business from '../models/Business.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import { DEFAULT_PLANS } from './plans.js';
import { backupDatabase, backupFolder } from '../utils/backup.js';

async function run() {
    refuseOnLiveDatabase('npm run seed:reset');
    await mongoose.connect(env.MONGODB_URI);
    console.log(`Connected: ${mongoose.connection.name}`);

    const db = mongoose.connection.db!;
    // Every collection in the database — also ones added later (credit notes, estimates,
    // payments, batches, sign-in sessions …). Indexes stay.
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((c) => c.name)
        .filter((n) => !n.startsWith('system.'));

    let records = 0;
    for (const n of collections) records += await db.collection(n).estimatedDocumentCount();
    if (records && process.env.RESET_BACKUP !== 'off') {
        const dir = backupFolder(env.BACKUP_DIR === 'off' ? '../backups' : env.BACKUP_DIR, db.databaseName)!;
        const { path: saved } = await backupDatabase(db, dir, env.BACKUP_KEEP);
        console.log(`Backed up ${records} records first → ${saved}`);
    }

    // Wipe everything.
    for (const n of collections) await db.collection(n).deleteMany({});
    console.log(`Cleared all ${collections.length} collections`);

    // Subscription plans are config the landing/pricing needs — keep them.
    await Plan.insertMany(DEFAULT_PLANS);
    console.log('Created 3 subscription plans');

    // Two empty businesses so each owner logs straight into a clean dashboard.
    const retail = await Business.create({
        name: 'My Retail Shop', type: 'retail', ownerName: 'Shopkeeper', mobile: '9000000001',
        city: 'Surat', state: 'Gujarat', plan: 'pro',
        settings: { lowStockThreshold: 10, enableUdharReminders: true, invoicePrefix: 'INV' },
    });
    const wholesale = await Business.create({
        name: 'My Wholesale Business', type: 'wholesale', ownerName: 'Wholesaler', mobile: '9000000010',
        city: 'Ahmedabad', state: 'Gujarat', plan: 'business',
        settings: { lowStockThreshold: 25, enableUdharReminders: true, invoicePrefix: 'INV' },
    });

    const passwordHash = await bcrypt.hash('whoply123', 10);
    await User.insertMany([
        { name: 'Shopkeeper', mobile: '9000000001', role: 'owner', businessId: retail._id, password: passwordHash },
        { name: 'Wholesaler', mobile: '9000000010', role: 'owner', businessId: wholesale._id, password: passwordHash },
        { name: 'Whoply Admin', mobile: '9000000099', role: 'admin', password: passwordHash },
    ]);

    console.log('\n✅ Clean reset done. Logins (password: whoply123 · dev OTP: 123456):');
    console.log('   Shopkeeper (retail) owner   9000000001');
    console.log('   Wholesaler owner            9000000010');
    console.log('   Platform admin              9000000099  (admin panel :7300)');

    await mongoose.connection.close();
    process.exit(0);
}

run().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
});
