/**
 * Index health check — proves the hot list queries are index-backed.
 *
 *   npm run test:explain
 *
 * Fails if MongoDB has to do a blocking in-memory SORT (the failure mode that
 * eventually throws "Sort exceeded memory limit" on a large tenant) or a COLLSCAN
 * for the low-stock count. Run after `npm run migrate` on any environment.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whoply';
await mongoose.connect(uri);
const db = mongoose.connection.db;

const biz = await db.collection('businesses').findOne({});
if (!biz) { console.log('No business found — seed some data first.'); process.exit(0); }
const bId = biz._id;

let allGood = true;
const indexOf = (s) => (JSON.stringify(s).match(/"indexName":"([^"]+)"/) || [])[1] || 'NONE';

async function checkSort(label, coll, filter, sort) {
    const ex = await db.collection(coll).find(filter).sort(sort).limit(20).explain('queryPlanner');
    const plan = JSON.stringify(ex.queryPlanner.winningPlan);
    const blocking = plan.includes('"stage":"SORT"');
    if (blocking) allGood = false;
    console.log(`${blocking ? '❌' : '✅'} ${label}`);
    console.log(`     index: ${indexOf(ex.queryPlanner.winningPlan)}  |  blocking SORT: ${blocking}`);
}

async function checkScan(label, coll, filter) {
    const ex = await db.collection(coll).find(filter).explain('queryPlanner');
    const plan = JSON.stringify(ex.queryPlanner.winningPlan);
    const collscan = plan.includes('COLLSCAN');
    if (collscan) allGood = false;
    console.log(`${collscan ? '❌' : '✅'} ${label}`);
    console.log(`     index: ${indexOf(ex.queryPlanner.winningPlan)}  |  COLLSCAN: ${collscan}`);
}

console.log(`Index health for "${biz.name}" (✅ = index-backed)\n`);
await checkSort('invoices        find({businessId}).sort({createdAt:-1})', 'invoices', { businessId: bId }, { createdAt: -1 });
await checkSort('orders          find({businessId}).sort({createdAt:-1})', 'orders', { businessId: bId }, { createdAt: -1 });
await checkSort('stock_movements find({businessId}).sort({createdAt:-1})', 'stock_movements', { businessId: bId }, { createdAt: -1 });
await checkSort('notifications   find({businessId}).sort({createdAt:-1})', 'notifications', { businessId: bId }, { createdAt: -1 });
await checkSort('credit_notes    find({businessId}).sort({createdAt:-1})', 'credit_notes', { businessId: bId }, { createdAt: -1 });
await checkScan('products        low-stock count (was a $expr COLLSCAN)', 'products', { businessId: bId, isActive: true, isLowStock: true });
await checkScan('customers       hasDue filter', 'customers', { businessId: bId, isActive: true, creditBalance: { $gt: 0 } });

console.log(`\n${allGood ? '✅ All hot queries are index-backed.' : '❌ Some queries still scan/sort in memory — run `npm run migrate`.'}`);
await mongoose.connection.close();
process.exit(allGood ? 0 : 1);
