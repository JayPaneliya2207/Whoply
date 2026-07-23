import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf, monthStart, todayRange } from '../../utils/http.js';
import Invoice from '../../models/Invoice.js';
import Product from '../../models/Product.js';
import Expense from '../../models/Expense.js';
import CreditLedger from '../../models/CreditLedger.js';
import User from '../../models/User.js';
import { STAFF_ROLES, type AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

const salaryMultiplier: Record<string, number> = { week: 7 / 30, month: 1, quarter: 3, year: 12 };

type Period = 'week' | 'month' | 'quarter' | 'year';
const periodStart = (period: Period): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    else if (period === 'quarter') d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
};

/** COGS for a period from actual product cost prices (join invoice items → products). */
async function cogsSince(bId: Types.ObjectId, since: Date): Promise<number> {
    const rows = await Invoice.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, cogs: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$p.costPrice', 0] }] } } } },
    ]);
    return rows[0]?.cogs || 0;
}

/** GET /reports/sales — daily sales for the last N days */
export const salesReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const days = Math.min(90, Number(req.query.days) || 30);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const daily = await Invoice.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                sales: { $sum: '$grandTotal' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);
    sendSuccess(res, { days, daily: daily.map((d) => ({ date: d._id, sales: d.sales, orders: d.orders })) });
});

/** GET /reports/products — best & slow movers this month */
export const productReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const movers = await Invoice.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: monthStart() } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
        { $sort: { qty: -1 } },
    ]);
    const slow = await Product.find({ businessId: bId, isActive: true }).sort({ currentStock: -1 }).limit(5).lean();
    sendSuccess(res, {
        best: movers.slice(0, 5).map((m) => ({ name: m._id, qty: m.qty, revenue: m.revenue })),
        slow: slow.map((p) => ({ name: p.name, stock: p.currentStock })),
    });
});

/** GET /reports/profit — month revenue vs expenses */
export const profitReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const [rev, exp] = await Promise.all([
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: monthStart() } } },
            { $group: { _id: null, sales: { $sum: '$grandTotal' }, gst: { $sum: '$totalGst' } } },
        ]),
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: monthStart() } } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
        ]),
    ]);
    const sales = rev[0]?.sales || 0;
    const totalExpense = exp.reduce((s, e) => s + e.total, 0);
    sendSuccess(res, {
        monthSales: sales,
        totalGst: rev[0]?.gst || 0,
        expenseByCategory: exp.map((e) => ({ category: e._id, total: e.total })),
        totalExpense,
        netProfit: +(sales * 0.3 - totalExpense).toFixed(2),
    });
});

/** GET /reports/summary?period=week|month|quarter|year — investment + P&L tally */
export const summaryReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const period = (['week', 'month', 'quarter', 'year'].includes(String(req.query.period)) ? req.query.period : 'month') as Period;
    const since = periodStart(period);

    const [inventory, revAgg, expAgg, cogs, salaryAgg] = await Promise.all([
        Product.aggregate([
            { $match: { businessId: bId, isActive: true } },
            { $group: { _id: null, atCost: { $sum: { $multiply: ['$currentStock', '$costPrice'] } }, atSell: { $sum: { $multiply: ['$currentStock', '$sellPrice'] } } } },
        ]),
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: since } } },
            { $group: { _id: null, revenue: { $sum: '$grandTotal' }, gst: { $sum: '$totalGst' }, orders: { $sum: 1 } } },
        ]),
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: since } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        cogsSince(bId, since),
        User.aggregate([
            { $match: { businessId: bId, role: { $in: STAFF_ROLES }, isActive: true } },
            { $group: { _id: null, monthly: { $sum: '$salary' } } },
        ]),
    ]);

    const revenue = revAgg[0]?.revenue || 0;
    const otherExpenses = expAgg[0]?.total || 0;
    const monthlyStaffSalary = salaryAgg[0]?.monthly || 0;
    const salaryForPeriod = +(monthlyStaffSalary * (salaryMultiplier[period] || 1)).toFixed(2);
    const expenses = +(otherExpenses + salaryForPeriod).toFixed(2);
    const grossProfit = +(revenue - (revAgg[0]?.gst || 0) - cogs).toFixed(2);
    const netProfit = +(grossProfit - expenses).toFixed(2);

    sendSuccess(res, {
        period,
        investmentAtCost: +(inventory[0]?.atCost || 0).toFixed(2), // money tied up in stock
        inventoryAtSell: +(inventory[0]?.atSell || 0).toFixed(2),
        revenue,
        orders: revAgg[0]?.orders || 0,
        cogs: +cogs.toFixed(2),
        grossProfit,
        otherExpenses,
        monthlyStaffSalary,
        staffSalaryForPeriod: salaryForPeriod,
        expenses,
        netProfit,
    });
});

/** GET /reports/day-close?date=YYYY-MM-DD — end-of-day cash tally */
export const dayCloseReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    let start: Date;
    let end: Date;
    if (req.query.date) {
        start = new Date(String(req.query.date));
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
    } else {
        ({ start, end } = todayRange());
    }

    const [byMode, totals, ledgerAgg, expAgg] = await Promise.all([
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: '$paymentMode', collected: { $sum: '$paidAmount' }, sales: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, sales: { $sum: '$grandTotal' }, collected: { $sum: '$paidAmount' }, udharGiven: { $sum: '$dueAmount' }, count: { $sum: 1 } } },
        ]),
        // udhar collected today (repayments)
        CreditLedger.aggregate([
            { $match: { businessId: bId, type: 'repayment', createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    const m: Record<string, any> = Object.fromEntries(byMode.map((x) => [x._id, x]));
    const cash = m.cash?.collected || 0;
    const upi = m.upi?.collected || 0;
    const card = m.card?.collected || 0;
    const udharCollected = ledgerAgg[0]?.total || 0;
    const expenses = expAgg[0]?.total || 0;

    sendSuccess(res, {
        date: start.toISOString().slice(0, 10),
        billCount: totals[0]?.count || 0,
        totalSales: +(totals[0]?.sales || 0).toFixed(2),
        totalCollected: +(totals[0]?.collected || 0).toFixed(2),
        cash, upi, card,
        udharGiven: +(totals[0]?.udharGiven || 0).toFixed(2),
        udharCollected,
        expenses,
        // rough cash expected in the drawer: cash sales + udhar collected − expenses
        cashInDrawer: +(cash + udharCollected - expenses).toFixed(2),
    });
});

/** GET /reports/export?period=... — CSV of the period's invoices */
export const exportInvoicesCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const period = (['week', 'month', 'quarter', 'year'].includes(String(req.query.period)) ? req.query.period : 'month') as Period;
    const since = periodStart(period);
    const invoices = await Invoice.find({ businessId: bId, createdAt: { $gte: since } }).sort({ createdAt: 1 }).lean();

    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Invoice No', 'Date', 'Customer', 'Mobile', 'Payment', 'Subtotal', 'GST', 'Discount', 'Total', 'Paid', 'Due', 'Status'];
    const lines = invoices.map((i) =>
        [
            i.invoiceNo,
            new Date(i.createdAt).toLocaleString('en-IN'),
            i.customerName || 'Walk-in',
            i.customerMobile || '',
            i.paymentMode,
            i.subtotal,
            i.totalGst,
            i.discount,
            i.grandTotal,
            i.paidAmount,
            i.dueAmount,
            i.status,
        ].map(esc).join(',')
    );
    const csv = [header.map(esc).join(','), ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="whoply-invoices-${period}.csv"`);
    res.send(csv);
});
