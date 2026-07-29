/**
 * Whoply seed — populates mongodb://localhost:27017/whoply with realistic dummy
 * data so every dashboard tile and report is alive on first run.
 *
 *   npm run seed
 *
 * Demo logins (OTP is always 123456 in dev; password is "whoply123"):
 *   Retail owner   : 9000000001   (Sharma General Store)
 *   Retail cashier : 9000000002
 *   Wholesale owner: 9000000010   (Gupta Distributors)
 *   Warehouse      : 9000000011
 *   Sales staff    : 9000000012
 *   Platform admin : 9000000099
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
import Plan from '../models/Plan.js';

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)];

async function run() {
    await mongoose.connect(env.MONGODB_URI);
    console.log(`Connected: ${mongoose.connection.name}`);

    // Wipe existing collections (idempotent seed)
    await Promise.all([
        Business.deleteMany({}),
        User.deleteMany({}),
        Category.deleteMany({}),
        Product.deleteMany({}),
        Customer.deleteMany({}),
        CreditLedger.deleteMany({}),
        Supplier.deleteMany({}),
        Invoice.deleteMany({}),
        Expense.deleteMany({}),
        StockMovement.deleteMany({}),
        Counter.deleteMany({}),
        Dealer.deleteMany({}),
        PriceList.deleteMany({}),
        Order.deleteMany({}),
        Visit.deleteMany({}),
        Notification.deleteMany({}),
        Plan.deleteMany({}),
    ]);

    /* ---------------- Subscription plans ---------------- */
    await Plan.insertMany([
        { key: 'free', name: 'Free', price: 0, period: 'month', order: 1, highlight: false, features: ['1 shop', 'Unlimited billing', 'Basic inventory', 'Udhar tracking'] },
        { key: 'pro', name: 'Pro', price: 299, period: 'month', order: 2, highlight: true, features: ['Everything in Free', 'WhatsApp reminders', 'GST reports', 'Barcode scanning', '3 staff logins'] },
        { key: 'business', name: 'Business', price: 799, period: 'month', order: 3, highlight: false, features: ['Everything in Pro', 'Wholesale suite', 'Dealers & price-lists', 'Dispatch & sales-team', 'AI reorder'] },
    ]);
    console.log('Created 3 subscription plans');
    console.log('Cleared old data');

    const passwordHash = await bcrypt.hash('whoply123', 10);

    /* ---------------- Businesses ---------------- */
    const retail = await Business.create({
        name: 'Sharma General Store',
        type: 'retail',
        ownerName: 'Rakesh Sharma',
        mobile: '9000000001',
        gstin: '24ABCDE1234F1Z5',
        city: 'Surat',
        state: 'Gujarat',
        plan: 'pro',
        settings: { lowStockThreshold: 10, enableUdharReminders: true, invoicePrefix: 'INV' },
    });
    const wholesale = await Business.create({
        name: 'Gupta Distributors',
        type: 'wholesale',
        ownerName: 'Mahesh Gupta',
        mobile: '9000000010',
        gstin: '24XYZAB6789K2Z1',
        city: 'Ahmedabad',
        state: 'Gujarat',
        plan: 'business',
        settings: { lowStockThreshold: 25, enableUdharReminders: true, invoicePrefix: 'GST' },
    });

    /* ---------------- Users ---------------- */
    await User.insertMany([
        { name: 'Rakesh Sharma', mobile: '9000000001', role: 'owner', businessId: retail._id, password: passwordHash },
        { name: 'Anita Desai', mobile: '9000000002', role: 'cashier', businessId: retail._id, password: passwordHash, salary: 15000, kyc: { docType: 'aadhaar', docNumber: 'XXXX-XXXX-4521', verified: true } },
        { name: 'Vijay Rana', mobile: '9000000003', role: 'manager', businessId: retail._id, password: passwordHash, salary: 25000, kyc: { docType: 'pan', docNumber: 'ABCPR1234K', verified: true } },
        { name: 'Mahesh Gupta', mobile: '9000000010', role: 'owner', businessId: wholesale._id, password: passwordHash },
        { name: 'Ramesh Warehouse', mobile: '9000000011', role: 'warehouse', businessId: wholesale._id, password: passwordHash, salary: 18000, kyc: { docType: 'aadhaar', docNumber: 'XXXX-XXXX-8890', verified: true } },
        { name: 'Sunil Yadav', mobile: '9000000012', role: 'salesStaff', businessId: wholesale._id, password: passwordHash, salary: 20000, kyc: { docType: 'aadhaar', docNumber: 'XXXX-XXXX-2213', verified: true } },
        { name: 'Farhan Sales', mobile: '9000000013', role: 'salesStaff', businessId: wholesale._id, password: passwordHash, salary: 20000, kyc: { docType: 'pan', docNumber: 'FGHPS8821L', verified: false } },
        { name: 'Whoply Admin', mobile: '9000000099', role: 'admin', password: passwordHash },
    ]);
    console.log('Created businesses + users');

    /* ---------------- Categories & products (retail) ---------------- */
    const catalog: Record<string, { name: string; hsn: string; gst: number; unit: string; cost: number; sell: number; expiry?: boolean }[]> = {
        'Imitation Jewellery': [
            { name: 'Kundan Necklace Set', hsn: '7117', gst: 3, unit: 'pcs', cost: 240, sell: 499 },
            { name: 'Gold-plated Jhumka', hsn: '7117', gst: 3, unit: 'pair', cost: 90, sell: 199 },
            { name: 'Bangles Set (Dozen)', hsn: '7117', gst: 3, unit: 'box', cost: 150, sell: 320 },
        ],
        Toys: [
            { name: 'Remote Car', hsn: '9503', gst: 12, unit: 'pcs', cost: 180, sell: 399 },
            { name: 'Soft Teddy Bear', hsn: '9503', gst: 12, unit: 'pcs', cost: 120, sell: 275 },
            { name: 'Building Blocks', hsn: '9503', gst: 12, unit: 'box', cost: 140, sell: 349 },
        ],
        Cutlery: [
            { name: 'Steel Spoon Set', hsn: '8215', gst: 12, unit: 'set', cost: 95, sell: 199 },
            { name: 'Dinner Plate (Steel)', hsn: '7323', gst: 12, unit: 'pcs', cost: 60, sell: 130 },
        ],
        Undergarments: [
            { name: "Men's Vest (Pack)", hsn: '6109', gst: 5, unit: 'pack', cost: 130, sell: 260 },
            { name: "Women's Innerwear", hsn: '6212', gst: 12, unit: 'pcs', cost: 90, sell: 199 },
            { name: "Kids' Briefs (Pack)", hsn: '6107', gst: 5, unit: 'pack', cost: 70, sell: 150 },
        ],
        Saree: [
            { name: 'Cotton Saree', hsn: '5208', gst: 5, unit: 'pcs', cost: 350, sell: 699 },
            { name: 'Silk Saree', hsn: '5007', gst: 5, unit: 'pcs', cost: 900, sell: 1799 },
        ],
        Kurtis: [
            { name: 'Rayon Kurti', hsn: '6211', gst: 5, unit: 'pcs', cost: 220, sell: 449 },
            { name: 'Anarkali Kurti', hsn: '6211', gst: 5, unit: 'pcs', cost: 380, sell: 799 },
        ],
        Groceries: [
            { name: 'Toor Dal 1kg', hsn: '0713', gst: 0, unit: 'kg', cost: 110, sell: 135, expiry: true },
            { name: 'Sunflower Oil 1L', hsn: '1512', gst: 5, unit: 'pcs', cost: 120, sell: 145, expiry: true },
            { name: 'Basmati Rice 5kg', hsn: '1006', gst: 5, unit: 'bag', cost: 380, sell: 460, expiry: true },
            { name: 'Sugar 1kg', hsn: '1701', gst: 5, unit: 'kg', cost: 40, sell: 48, expiry: true },
        ],
        Bakery: [
            { name: 'Bread Loaf', hsn: '1905', gst: 5, unit: 'pcs', cost: 28, sell: 40, expiry: true },
            { name: 'Cream Biscuits', hsn: '1905', gst: 18, unit: 'pcs', cost: 22, sell: 35, expiry: true },
            { name: 'Rusk Pack', hsn: '1905', gst: 5, unit: 'pcs', cost: 45, sell: 60, expiry: true },
        ],
        Namkeen: [
            { name: 'Aloo Bhujia 200g', hsn: '2106', gst: 12, unit: 'pcs', cost: 38, sell: 55, expiry: true },
            { name: 'Mixture 1kg', hsn: '2106', gst: 12, unit: 'kg', cost: 160, sell: 220, expiry: true },
            { name: 'Sev 500g', hsn: '2106', gst: 12, unit: 'pcs', cost: 70, sell: 99, expiry: true },
        ],
    };

    let skuCounter = 1000;
    const retailProducts: any[] = [];
    for (const [catName, items] of Object.entries(catalog)) {
        const cat = await Category.create({ businessId: retail._id, name: catName });
        for (const it of items) {
            const stock = rand(3, 60);
            const p = await Product.create({
                businessId: retail._id,
                categoryId: cat._id,
                name: it.name,
                sku: `SKU${skuCounter++}`,
                barcode: `890${rand(1000000000, 9999999999)}`,
                hsn: it.hsn,
                unit: it.unit,
                costPrice: it.cost,
                sellPrice: it.sell,
                wholesalePrice: +(it.cost * 1.1).toFixed(0),
                gstRate: it.gst,
                currentStock: stock,
                lowStockThreshold: 10,
                trackExpiry: !!it.expiry,
            });
            await StockMovement.create({ businessId: retail._id, productId: p._id, reason: 'opening', quantity: stock, note: 'Opening stock' });
            retailProducts.push(p);
        }
    }
    console.log(`Created ${retailProducts.length} retail products across ${Object.keys(catalog).length} categories`);

    // A handful of wholesale products too (so wholesale dashboard has stock)
    for (const [catName, items] of Object.entries(catalog)) {
        const cat = await Category.create({ businessId: wholesale._id, name: catName });
        for (const it of items.slice(0, 2)) {
            const stock = rand(80, 400);
            await Product.create({
                businessId: wholesale._id,
                categoryId: cat._id,
                name: it.name,
                sku: `WSKU${skuCounter++}`,
                hsn: it.hsn,
                unit: it.unit,
                costPrice: it.cost,
                sellPrice: it.sell,
                wholesalePrice: +(it.cost * 1.08).toFixed(0),
                gstRate: it.gst,
                currentStock: stock,
                lowStockThreshold: 25,
            });
        }
    }

    /* ---------------- Suppliers ---------------- */
    await Supplier.insertMany([
        { businessId: retail._id, name: 'Metro Wholesale Mart', mobile: '9811111111', payableBalance: 4200 },
        { businessId: retail._id, name: 'Kirana Supply Co.', mobile: '9822222222', payableBalance: 0 },
        { businessId: retail._id, name: 'Fashion Hub Distributors', mobile: '9833333333', payableBalance: 8600 },
    ]);

    /* ---------------- Customers with udhar ---------------- */
    const custNames = ['Ramesh Bhai', 'Priya Patel', 'Imran Khan', 'Neha Shah', 'Kiran Rao', 'Deepak Modi'];
    const customers: any[] = [];
    for (const name of custNames) {
        const bal = pick([0, 0, 250, 480, 1200, 2100]);
        const c = await Customer.create({
            businessId: retail._id,
            name,
            mobile: `98${rand(10000000, 99999999)}`,
            creditBalance: bal,
            creditLimit: 5000,
            loyaltyPoints: rand(0, 120),
        });
        if (bal > 0) {
            await CreditLedger.create({
                businessId: retail._id,
                customerId: c._id,
                type: 'credit',
                amount: bal,
                balanceAfter: bal,
                note: 'Opening udhar balance',
            });
        }
        customers.push(c);
    }
    console.log(`Created ${customers.length} customers`);

    /* ---------------- Invoices over the last ~20 days ---------------- */
    const paymentModes = ['cash', 'upi', 'card', 'credit'] as const;
    let invCount = 0;
    for (let day = 20; day >= 0; day--) {
        const perDay = rand(2, 6);
        for (let n = 0; n < perDay; n++) {
            const when = new Date();
            when.setDate(when.getDate() - day);
            when.setHours(rand(9, 20), rand(0, 59), 0, 0);
            // never seed a future timestamp — clamp "today" bills to the recent past
            if (when.getTime() > Date.now()) when.setTime(Date.now() - rand(2, 240) * 60000);

            const lineCount = rand(1, 4);
            const items: any[] = [];
            let subtotal = 0;
            let totalGst = 0;
            for (let l = 0; l < lineCount; l++) {
                const p = pick(retailProducts);
                const qty = rand(1, 5);
                const base = p.sellPrice * qty;
                const gstAmount = +((base * p.gstRate) / 100).toFixed(2);
                subtotal += base;
                totalGst += gstAmount;
                items.push({
                    productId: p._id,
                    name: p.name,
                    hsn: p.hsn,
                    quantity: qty,
                    unit: p.unit,
                    price: p.sellPrice,
                    gstRate: p.gstRate,
                    gstAmount,
                    lineTotal: +(base + gstAmount).toFixed(2),
                });
            }
            const grandTotal = +(subtotal + totalGst).toFixed(2);
            const mode = pick(paymentModes);
            const isCredit = mode === 'credit';
            const cust = isCredit ? pick(customers) : rand(0, 1) ? pick(customers) : null;
            const paid = isCredit ? 0 : grandTotal;
            const due = +(grandTotal - paid).toFixed(2);

            const seqKey = `invoice:${retail._id}:${when.toISOString().slice(0, 7).replace('-', '')}`;
            const seqDoc = await Counter.findOneAndUpdate({ key: seqKey }, { $inc: { value: 1 } }, { upsert: true, new: true });
            const ym = when.toISOString().slice(0, 7).replace('-', '');
            const invoiceNo = `INV/${ym}/${String(seqDoc!.value).padStart(4, '0')}`;

            const inv = await Invoice.create({
                businessId: retail._id,
                invoiceNo,
                customerId: cust?._id,
                customerName: cust?.name,
                items,
                subtotal: +subtotal.toFixed(2),
                totalGst: +totalGst.toFixed(2),
                discount: 0,
                grandTotal,
                paidAmount: paid,
                dueAmount: due,
                paymentMode: mode,
                status: due <= 0 ? 'paid' : 'credit',
                createdAt: when,
            });
            invCount++;

            if (isCredit && cust) {
                cust.creditBalance = +(cust.creditBalance + due).toFixed(2);
                await cust.save();
                await CreditLedger.create({
                    businessId: retail._id,
                    customerId: cust._id,
                    type: 'credit',
                    amount: due,
                    balanceAfter: cust.creditBalance,
                    refType: 'Invoice',
                    refId: inv._id,
                    note: `Credit sale ${invoiceNo}`,
                    createdAt: when,
                });
            }
        }
    }
    console.log(`Created ${invCount} invoices`);

    /* ---------------- Expenses ---------------- */
    const expenseCats = ['rent', 'electricity', 'salary', 'transport', 'supplies', 'marketing'] as const;
    for (let i = 0; i < 10; i++) {
        const when = new Date();
        when.setDate(when.getDate() - rand(0, 25));
        await Expense.create({
            businessId: retail._id,
            category: pick(expenseCats),
            amount: rand(500, 3500),
            note: 'Monthly operating expense',
            spentAt: when,
        });
    }
    console.log('Created expenses');

    /* ---------------- Wholesale: dealers, price-lists, orders, visits ---------------- */
    const wsProducts = await Product.find({ businessId: wholesale._id }).lean();
    const salesRep = await User.findOne({ businessId: wholesale._id, role: 'salesStaff' }).lean();

    // Tier price-lists: A cheapest, then B, then C
    for (const p of wsProducts) {
        const base = p.wholesalePrice || p.sellPrice;
        await PriceList.insertMany([
            { businessId: wholesale._id, productId: p._id, tier: 'A', price: +(base * 0.95).toFixed(0) },
            { businessId: wholesale._id, productId: p._id, tier: 'B', price: +(base * 1.0).toFixed(0) },
            { businessId: wholesale._id, productId: p._id, tier: 'C', price: +(base * 1.06).toFixed(0) },
        ]);
    }

    const dealerData = [
        { name: 'Ravi Traders', shopName: 'Ravi Kirana', city: 'Rajkot', tier: 'A' as const },
        { name: 'Shakti Stores', shopName: 'Shakti General', city: 'Vadodara', tier: 'B' as const },
        { name: 'Balaji Mart', shopName: 'Balaji Provision', city: 'Surat', tier: 'B' as const },
        { name: 'New India Shop', shopName: 'New India', city: 'Bhavnagar', tier: 'C' as const },
        { name: 'Krishna Kirana', shopName: 'Krishna', city: 'Jamnagar', tier: 'A' as const },
    ];
    const dealers: any[] = [];
    for (const d of dealerData) {
        dealers.push(
            await Dealer.create({
                businessId: wholesale._id,
                ...d,
                mobile: `97${rand(10000000, 99999999)}`,
                gstin: `24${['ABCDS', 'PQRST', 'LMNOP', 'WXYZK', 'EFGHJ'][dealers.length % 5]}${rand(1000, 9999)}K1Z${dealers.length % 9}`,
                creditLimit: 100000,
                assignedRepId: salesRep?._id,
            })
        );
    }
    console.log(`Created ${dealers.length} dealers + tier price-lists`);

    const sources = ['whatsapp', 'phone', 'manual', 'field'] as const;
    const statuses = ['pending', 'confirmed', 'dispatched', 'delivered'] as const;
    let ordCount = 0;
    for (let day = 14; day >= 0; day--) {
        const perDay = rand(1, 3);
        for (let n = 0; n < perDay; n++) {
            const when = new Date();
            when.setDate(when.getDate() - day);
            when.setHours(rand(9, 19), rand(0, 59), 0, 0);
            if (when.getTime() > Date.now()) when.setTime(Date.now() - rand(2, 240) * 60000);
            const dealer = pick(dealers);
            const rows = await PriceList.find({ businessId: wholesale._id, tier: dealer.tier }).lean();
            const priceMap = new Map(rows.map((r) => [String(r.productId), r.price]));

            const lineCount = rand(2, 5);
            const items: any[] = [];
            let subtotal = 0, totalGst = 0;
            for (let l = 0; l < lineCount; l++) {
                const p = pick(wsProducts);
                const qty = rand(10, 100);
                const price = priceMap.get(String(p._id)) || p.wholesalePrice || p.sellPrice;
                const base = price * qty;
                const gstAmount = +((base * (p.gstRate || 0)) / 100).toFixed(2);
                subtotal += base; totalGst += gstAmount;
                items.push({ productId: p._id, name: p.name, hsn: p.hsn, unit: p.unit, quantity: qty, price, gstRate: p.gstRate || 0, gstAmount, lineTotal: +(base + gstAmount).toFixed(2) });
            }
            const total = +(subtotal + totalGst).toFixed(2);
            const status = day > 3 ? pick(['dispatched', 'delivered'] as const) : pick(statuses);
            const paid = status === 'delivered' ? +total.toFixed(2) : pick([0, +(total / 2).toFixed(2)]);
            const due = +(total - paid).toFixed(2);

            const seqKey = `order:${wholesale._id}:${when.toISOString().slice(0, 7).replace('-', '')}`;
            const seqDoc = await Counter.findOneAndUpdate({ key: seqKey }, { $inc: { value: 1 } }, { upsert: true, new: true });
            const ym = when.toISOString().slice(0, 7).replace('-', '');
            const orderNo = `ORD/${ym}/${String(seqDoc!.value).padStart(4, '0')}`;

            await Order.create({
                businessId: wholesale._id,
                orderNo,
                dealerId: dealer._id,
                dealerName: dealer.name,
                dealerGstin: dealer.gstin,
                items,
                subtotal: +subtotal.toFixed(2),
                totalGst: +totalGst.toFixed(2),
                total,
                paidAmount: paid,
                dueAmount: due,
                status,
                source: pick(sources),
                salesRepId: salesRep?._id,
                dispatchedAt: ['dispatched', 'delivered'].includes(status) ? when : undefined,
                deliveredAt: status === 'delivered' ? when : undefined,
                createdAt: when,
            });
            ordCount++;
            // Dealer outstanding is derived from these order dues at read time — nothing to persist.
            // a field visit for some orders
            if (salesRep && Math.random() > 0.5) {
                await Visit.create({
                    businessId: wholesale._id,
                    salesRepId: salesRep._id,
                    salesRepName: salesRep.name,
                    dealerId: dealer._id,
                    dealerName: dealer.name,
                    outcome: 'order',
                    note: 'Collected order on route',
                    visitedAt: when,
                });
            }
        }
    }
    console.log(`Created ${ordCount} wholesale orders + visits`);

    console.log('\n✅ Seed complete. Demo logins (password: whoply123 / OTP: 123456):');
    console.log('   Retail owner    9000000001  (Sharma General Store)');
    console.log('   Retail cashier  9000000002');
    console.log('   Wholesale owner 9000000010  (Gupta Distributors)');
    console.log('   Platform admin  9000000099');

    await mongoose.connection.close();
    process.exit(0);
}

run().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
