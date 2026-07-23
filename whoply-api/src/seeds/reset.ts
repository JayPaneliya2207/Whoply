/**
 * Whoply RESET — wipes every collection and re-creates ONLY what you need to log
 * in and start testing with a clean slate. No demo products / bills / orders /
 * dealers / customers.
 *
 *   npm run seed:reset
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
import Business from '../models/Business.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import CreditLedger from '../models/CreditLedger.js';
import Supplier from '../models/Supplier.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import StockMovement from '../models/StockMovement.js';
import Counter from '../models/Counter.js';
import Dealer from '../models/Dealer.js';
import PriceList from '../models/PriceList.js';
import Order from '../models/Order.js';
import Visit from '../models/Visit.js';
import Notification from '../models/Notification.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Plan from '../models/Plan.js';

async function run() {
    await mongoose.connect(env.MONGODB_URI);
    console.log(`Connected: ${mongoose.connection.name}`);

    // Wipe everything.
    await Promise.all([
        Business.deleteMany({}), User.deleteMany({}), Category.deleteMany({}), Product.deleteMany({}),
        Customer.deleteMany({}), CreditLedger.deleteMany({}), Supplier.deleteMany({}), Invoice.deleteMany({}),
        Expense.deleteMany({}), StockMovement.deleteMany({}), Counter.deleteMany({}), Dealer.deleteMany({}),
        PriceList.deleteMany({}), Order.deleteMany({}), Visit.deleteMany({}), Notification.deleteMany({}),
        PurchaseOrder.deleteMany({}), Plan.deleteMany({}),
    ]);
    console.log('Cleared all collections');

    // Subscription plans are config the landing/pricing needs — keep them.
    await Plan.insertMany([
        { key: 'free', name: 'Free', price: 0, period: 'month', order: 1, highlight: false, features: ['1 shop', 'Unlimited billing', 'Basic inventory', 'Udhar tracking'] },
        { key: 'pro', name: 'Pro', price: 299, period: 'month', order: 2, highlight: true, features: ['Everything in Free', 'WhatsApp reminders', 'GST reports', 'Barcode scanning', '3 staff logins'] },
        { key: 'business', name: 'Business', price: 799, period: 'month', order: 3, highlight: false, features: ['Everything in Pro', 'Wholesale suite', 'Dealers & price-lists', 'Dispatch & sales-team', 'AI reorder'] },
    ]);
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
