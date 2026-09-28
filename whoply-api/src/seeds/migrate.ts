/**
 * Whoply migration — safe to run repeatedly, on an existing production database.
 *
 *   npm run migrate
 *
 * 1. Builds any newly-added indexes (syncIndexes per model).
 * 2. Backfills Product.isLowStock, which low-stock counts/filters now rely on.
 * 3. Rewords plan feature lines the product can't back (see seeds/plans.ts) —
 *    they appear on the landing page's pricing cards.
 * 4. Money & stock fixes (seeds/backfills.ts): order advances get Payment rows,
 *    return ledger rows stop counting as collections, credit notes get their
 *    cash refund, auto-filled price-list rows are dropped.
 *
 * Note: syncIndexes also DROPS indexes that are no longer declared on a schema.
 * Everything here is declared in code, so that's intended — but run it against a
 * staging copy first if you have hand-made indexes in Atlas.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';
import StockMovement from '../models/StockMovement.js';
import Notification from '../models/Notification.js';
import CreditNote from '../models/CreditNote.js';
import CreditLedger from '../models/CreditLedger.js';
import Customer from '../models/Customer.js';
import Dealer from '../models/Dealer.js';
import Payment from '../models/Payment.js';
import JobLock from '../models/JobLock.js';
import Plan from '../models/Plan.js';
import { PLAN_FEATURE_RENAMES } from './plans.js';
import { backfillOrderAdvances, relabelReturnLedgerRows, backfillCashRefunds, dropDefaultTierRows } from './backfills.js';

const MODELS = [
    ['Product', Product], ['Invoice', Invoice], ['Order', Order], ['StockMovement', StockMovement],
    ['Notification', Notification], ['CreditNote', CreditNote], ['CreditLedger', CreditLedger],
    ['Customer', Customer], ['Dealer', Dealer], ['Payment', Payment], ['JobLock', JobLock],
] as const;

async function run() {
    await mongoose.connect(env.MONGODB_URI);
    console.log(`Connected: ${mongoose.connection.name}\n`);

    console.log('→ Building indexes…');
    for (const [name, model] of MODELS) {
        const t = Date.now();
        await (model as any).syncIndexes();
        console.log(`   ✓ ${name} (${Date.now() - t}ms)`);
    }

    console.log('\n→ Backfilling Product.isLowStock…');
    const res = await Product.updateMany(
        {},
        [{ $set: { isLowStock: { $lte: ['$currentStock', '$lowStockThreshold'] } } }] as any,
        { updatePipeline: true } as any
    );
    console.log(`   ✓ ${res.modifiedCount} product(s) updated`);

    const low = await Product.countDocuments({ isActive: true, isLowStock: true });
    console.log(`   ℹ ${low} active product(s) currently low on stock`);

    console.log('\n→ Rewording plan features…');
    let reworded = 0;
    for (const plan of await Plan.find({})) {
        const features = plan.features.map((f) => PLAN_FEATURE_RENAMES[f] ?? f);
        if (features.some((f, i) => f !== plan.features[i])) {
            plan.features = features;
            await plan.save();
            reworded++;
        }
    }
    console.log(`   ✓ ${reworded} plan(s) updated`);

    console.log('\n→ Money & stock fixes…');
    console.log(`   ✓ ${await backfillOrderAdvances()} order advance(s) recorded as payments`);
    console.log(`   ✓ ${await relabelReturnLedgerRows()} return ledger row(s) relabelled (no longer counted as collected)`);
    console.log(`   ✓ ${await backfillCashRefunds()} credit note(s) given their cash refund`);
    console.log(`   ✓ ${await dropDefaultTierRows()} auto-filled price-list row(s) dropped (defaults now follow the base price)`);

    console.log('\n✅ Migration complete.');
    await mongoose.connection.close();
    process.exit(0);
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
