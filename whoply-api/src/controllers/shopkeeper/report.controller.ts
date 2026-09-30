import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf, monthStart, todayRange } from '../../utils/http.js';
import Invoice from '../../models/Invoice.js';
import Product from '../../models/Product.js';
import Expense from '../../models/Expense.js';
import CreditLedger from '../../models/CreditLedger.js';
import CreditNote from '../../models/CreditNote.js';
import User from '../../models/User.js';
import Business from '../../models/Business.js';
import { interStateExpr, splitTax, netRows, rateKey, hsnKey, rateTable, hsnTable } from '../../utils/gstSplit.js';
import { STAFF_ROLES, type AuthRequest } from '../../interfaces/index.js';
import { can } from '../../utils/permissions.js';
import { Types, type PipelineStage } from 'mongoose';
import { IST_TZ, istDateRange, istDaysAgo, istPeriodStart, istYmd, gstMonth } from '../../utils/ist.js';

const salaryMultiplier: Record<string, number> = { week: 7 / 30, month: 1, quarter: 3, year: 12 };

type Period = 'week' | 'month' | 'quarter' | 'year';
const periodStart = (period: Period): Date => istPeriodStart(period);

/**
 * Taxable value of a line: `taxableValue` (after the bill discount) where stored;
 * lines made before it existed only had the pre-discount price × qty.
 */
const ITEM_TAXABLE = { $ifNull: ['$items.taxableValue', { $multiply: ['$items.price', '$items.quantity'] }] };
/** The same, summed over a whole document's lines (no $unwind). */
const DOC_TAXABLE = {
    $reduce: {
        input: '$items',
        initialValue: 0,
        in: { $add: ['$$value', { $ifNull: ['$$this.taxableValue', { $multiply: ['$$this.price', '$$this.quantity'] }] }] },
    },
};
import { RETAIL_CN, costOfLines, retailGrossProfit } from '../../utils/profit.js';

/** A CSV cell: quoted, and never read as a formula by Excel (a name like "=HYPERLINK(…)" stays text). */
export const csvCell = (v: any) => {
    const s = String(v ?? '');
    const risky = typeof v !== 'number' && /^[=+\-@\t\r]/.test(s); // numbers (a -500 refund) stay numbers
    return `"${(risky ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** COGS for a period from actual product cost prices, less goods that came back on returns. */
async function cogsSince(bId: Types.ObjectId, since: Date): Promise<number> {
    const [sold, returned] = await Promise.all([
        costOfLines(Invoice, { businessId: bId, createdAt: { $gte: since } }),
        costOfLines(CreditNote, { businessId: bId, ...RETAIL_CN, createdAt: { $gte: since } }),
    ]);
    return sold - returned;
}

/** GET /reports/sales — daily sales for the last N days */
export const salesReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const days = Math.min(90, Number(req.query.days) || 30);
    const since = istDaysAgo(days);

    const daily = await Invoice.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } },
                sales: { $sum: '$grandTotal' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);
    sendSuccess(res, { days, daily: daily.map((d) => ({ date: d._id, sales: d.sales, orders: d.orders })) });
});

/**
 * GET /reports/products — this month's best sellers (by product, returns taken
 * off) and slow movers (in stock but sold least this month).
 */
export const productReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const since = monthStart();
    const byProduct = (model: typeof Invoice | typeof CreditNote, extra: Record<string, any> = {}) =>
        (model as any).aggregate([
            { $match: { businessId: bId, createdAt: { $gte: since }, ...extra } },
            { $unwind: '$items' },
            { $group: { _id: '$items.productId', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
        ]);
    const [sold, returned, products] = await Promise.all([
        byProduct(Invoice),
        byProduct(CreditNote, RETAIL_CN),
        Product.find({ businessId: bId, isActive: true }).select('name currentStock').lean(),
    ]);
    const back = new Map<string, any>(returned.map((r: any) => [String(r._id), r]));
    const net = new Map<string, { qty: number; revenue: number }>(
        sold.map((s: any) => {
            const r = back.get(String(s._id));
            return [String(s._id), { qty: +(s.qty - (r?.qty || 0)).toFixed(3), revenue: +(s.revenue - (r?.revenue || 0)).toFixed(2) }];
        })
    );
    const best = products
        .map((p) => ({ name: p.name, ...(net.get(String(p._id)) || { qty: 0, revenue: 0 }) }))
        .filter((p) => p.qty > 0)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
    const slow = products
        .filter((p) => p.currentStock > 0)
        .map((p) => ({ name: p.name, stock: p.currentStock, sold: net.get(String(p._id))?.qty || 0 }))
        .sort((a, b) => a.sold - b.sold || b.stock - a.stock)
        .slice(0, 5);
    sendSuccess(res, { best, slow });
});

/** GET /reports/profit — this month's sales, expenses and profit (real cost prices, returns taken off) */
export const profitReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const [rev, exp, gross] = await Promise.all([
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: monthStart() } } },
            { $group: { _id: null, sales: { $sum: '$grandTotal' }, gst: { $sum: '$totalGst' } } },
        ]),
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: monthStart() } } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
        ]),
        retailGrossProfit(bId, monthStart()),
    ]);
    const sales = rev[0]?.sales || 0;
    const totalExpense = exp.reduce((s, e) => s + e.total, 0);
    sendSuccess(res, {
        monthSales: sales,
        totalGst: rev[0]?.gst || 0,
        expenseByCategory: exp.map((e) => ({ category: e._id, total: e.total })),
        totalExpense,
        grossProfit: gross.grossProfit,
        netProfit: +(gross.grossProfit - totalExpense).toFixed(2),
    });
});

/** GET /reports/summary?period=week|month|quarter|year — investment + P&L tally */
export const summaryReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const period = (['week', 'month', 'quarter', 'year'].includes(String(req.query.period)) ? req.query.period : 'month') as Period;
    const since = periodStart(period);

    const [inventory, revAgg, expAgg, cogs, salaryAgg, cnAgg] = await Promise.all([
        Product.aggregate([
            { $match: { businessId: bId, isActive: true } },
            { $group: { _id: null, atCost: { $sum: { $multiply: ['$currentStock', '$costPrice'] } }, atSell: { $sum: { $multiply: ['$currentStock', '$sellPrice'] } } } },
        ]),
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: since } } },
            { $group: { _id: null, revenue: { $sum: '$grandTotal' }, gst: { $sum: '$totalGst' }, orders: { $sum: 1 } } },
        ]),
        // Salary expenses apart from the rest (see below).
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: since } } },
            { $group: { _id: { $eq: ['$category', 'salary'] }, total: { $sum: '$amount' } } },
        ]),
        cogsSince(bId, since),
        User.aggregate([
            { $match: { businessId: bId, role: { $in: STAFF_ROLES }, isActive: true } },
            { $group: { _id: null, monthly: { $sum: '$salary' } } },
        ]),
        // Returns take sales back out of revenue (and their GST out of tax).
        CreditNote.aggregate([
            { $match: { businessId: bId, ...RETAIL_CN, createdAt: { $gte: since } } },
            { $group: { _id: null, total: { $sum: '$total' }, gst: { $sum: '$totalGst' } } },
        ]),
    ]);

    const revenue = +((revAgg[0]?.revenue || 0) - (cnAgg[0]?.total || 0)).toFixed(2);
    const netGst = (revAgg[0]?.gst || 0) - (cnAgg[0]?.gst || 0);
    const otherExpenses = +(expAgg.find((e) => e._id === false)?.total || 0).toFixed(2);
    const salaryPaid = +(expAgg.find((e) => e._id === true)?.total || 0).toFixed(2);
    const monthlyStaffSalary = salaryAgg[0]?.monthly || 0;
    // Salary counts once. Salary the shop recorded as expenses in this period is
    // what was really paid; only when there is none do we estimate it from the
    // staff list. Adding both counted the same pay twice.
    const salaryEstimate = +(monthlyStaffSalary * (salaryMultiplier[period] || 1)).toFixed(2);
    const salaryFromExpenses = salaryPaid > 0;
    const salaryForPeriod = salaryFromExpenses ? salaryPaid : salaryEstimate;
    const expenses = +(otherExpenses + salaryForPeriod).toFixed(2);
    const grossProfit = +(revenue - netGst - cogs).toFixed(2);
    const netProfit = +(grossProfit - expenses).toFixed(2);

    sendSuccess(res, {
        period,
        investmentAtCost: +(inventory[0]?.atCost || 0).toFixed(2), // money tied up in stock
        inventoryAtSell: +(inventory[0]?.atSell || 0).toFixed(2),
        revenue,
        returns: +(cnAgg[0]?.total || 0).toFixed(2),
        orders: revAgg[0]?.orders || 0,
        cogs: +cogs.toFixed(2),
        grossProfit,
        otherExpenses,
        monthlyStaffSalary,
        staffSalaryForPeriod: salaryForPeriod,
        /** 'expenses' = salary recorded as expenses; 'staff' = estimated from staff salaries. */
        salarySource: salaryFromExpenses ? 'expenses' : 'staff',
        expenses,
        netProfit,
    });
});

/** GET /reports/day-close?date=YYYY-MM-DD — end-of-day cash tally */
export const dayCloseReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    let start: Date;
    let end: Date;
    // Roles with only the day-close permission (a cashier) get today's tally, never older days.
    const picked = req.query.date && can(req.user?.role, 'reports.view') ? istDateRange(String(req.query.date)) : null;
    if (picked) {
        ({ start, end } = picked);
    } else {
        ({ start, end } = todayRange());
    }

    const [byMode, totals, ledgerAgg, expAgg, refundAgg] = await Promise.all([
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
            // Money in by mode, from each bill's payments (a split bill counts in several
            // modes). Bills made before split payment only have paymentMode + paidAmount;
            // for an old udhar bill with a part payment, that part came in cash.
            {
                $project: {
                    pays: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$payments', []] } }, 0] },
                            '$payments',
                            [{ mode: { $cond: [{ $eq: ['$paymentMode', 'credit'] }, 'cash', '$paymentMode'] }, amount: '$paidAmount' }],
                        ],
                    },
                },
            },
            { $unwind: '$pays' },
            { $group: { _id: '$pays.mode', collected: { $sum: '$pays.amount' } } },
        ]),
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, sales: { $sum: '$grandTotal' }, collected: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
        ]),
        // Udhar given (credit) and collected (repayment) today, from the ledger — a
        // bill's dueAmount drops when it's repaid, so it can't say what was given.
        // 'return' rows move no money.
        CreditLedger.aggregate([
            { $match: { businessId: bId, type: { $in: ['credit', 'repayment'] }, createdAt: { $gte: start, $lt: end } } },
            // Repayments by how they were paid; older rows have no mode and were cash.
            { $group: { _id: { type: '$type', mode: { $ifNull: ['$mode', 'cash'] } }, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        // cash handed back on returns today
        CreditNote.aggregate([
            { $match: { businessId: bId, ...RETAIL_CN, createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, total: { $sum: '$cashRefund' } } },
        ]),
    ]);

    const m: Record<string, any> = Object.fromEntries(byMode.map((x) => [x._id, x]));
    const cash = m.cash?.collected || 0;
    const upi = m.upi?.collected || 0;
    const card = m.card?.collected || 0;
    const wallet = m.wallet?.collected || 0;
    const sumOf = (type: string, mode?: string) => ledgerAgg.filter((x) => x._id.type === type && (!mode || x._id.mode === mode)).reduce((s, x) => s + x.total, 0);
    const udharCollected = +sumOf('repayment').toFixed(2);
    const udharCollectedCash = +sumOf('repayment', 'cash').toFixed(2);
    const udharGiven = sumOf('credit');
    const expenses = expAgg[0]?.total || 0;
    const refunds = +(refundAgg[0]?.total || 0).toFixed(2);

    sendSuccess(res, {
        date: istYmd(start),
        billCount: totals[0]?.count || 0,
        totalSales: +(totals[0]?.sales || 0).toFixed(2),
        totalCollected: +(totals[0]?.collected || 0).toFixed(2),
        cash, upi, card, wallet,
        udharGiven: +udharGiven.toFixed(2),
        udharCollected,
        udharCollectedCash,
        udharCollectedByMode: { cash: udharCollectedCash, upi: +sumOf('repayment', 'upi').toFixed(2), card: +sumOf('repayment', 'card').toFixed(2) },
        expenses,
        refunds,
        // rough cash expected in the drawer: cash sales + udhar paid back in cash − expenses − cash refunds
        cashInDrawer: +(cash + udharCollectedCash - expenses - refunds).toFixed(2),
    });
});

/** GET /reports/export?period=... — CSV of the period's invoices */
export const exportInvoicesCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const period = (['week', 'month', 'quarter', 'year'].includes(String(req.query.period)) ? req.query.period : 'month') as Period;
    const since = periodStart(period);
    const invoices = await Invoice.find({ businessId: bId, createdAt: { $gte: since } })
        .select('invoiceNo createdAt customerName customerMobile payments paymentMode subtotal totalGst discount grandTotal paidAmount dueAmount status')
        .sort({ createdAt: 1 })
        .lean();

    const esc = csvCell;
    const header = ['Invoice No', 'Date', 'Customer', 'Mobile', 'Payment', 'Subtotal', 'GST', 'Discount', 'Total', 'Paid', 'Due', 'Status'];
    const lines = invoices.map((i) =>
        [
            i.invoiceNo,
            new Date(i.createdAt).toLocaleString('en-IN', { timeZone: IST_TZ }),
            i.customerName || 'Walk-in',
            i.customerMobile || '',
            i.payments && i.payments.length > 1 ? i.payments.map((p) => `${p.mode} ${p.amount}`).join(' + ') : i.paymentMode,
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

/**
 * GET /reports/gst?month=YYYY-MM — GST filing data for one calendar month (IST).
 * Returns a GSTR-3B summary + GSTR-1 breakups (rate-wise B2C, HSN summary, B2B).
 * Tax on a bill to a buyer registered in another state is IGST; everything else
 * (same state, or no buyer GSTIN) is CGST + SGST — see utils/gstSplit.ts.
 * Taxable value is after the bill discount (bills made before lines stored
 * `taxableValue` fall back to pre-discount). Returns (credit notes) dated in the
 * month are netted off the 3B summary, rate-wise and HSN tables and B2C; B2B
 * invoices stay gross, with their credit notes listed separately under `cdnr`.
 */
export const gstReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const { from, to, label } = gstMonth(req.query.month);
    const biz = await Business.findById(bId).select('gstin').lean();
    const INTER = interStateExpr(biz?.gstin, '$customerGstin');
    const igstOf = (amount: string) => ({ $sum: { $cond: [INTER, amount, 0] } });

    const match = { businessId: bId, createdAt: { $gte: from, $lt: to } };
    const cnMatch = { ...match, ...RETAIL_CN };
    const hasGstin = { customerGstin: { $exists: true, $nin: [null, ''] } };
    const byRate: PipelineStage[] = [{ $unwind: '$items' }, { $group: { _id: '$items.gstRate', taxable: { $sum: ITEM_TAXABLE }, gst: { $sum: '$items.gstAmount' }, igst: igstOf('$items.gstAmount') } }];
    const byHsn: PipelineStage[] = [
        { $unwind: '$items' },
        { $group: { _id: { hsn: { $ifNull: ['$items.hsn', '—'] }, rate: '$items.gstRate' }, name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, taxable: { $sum: ITEM_TAXABLE }, gst: { $sum: '$items.gstAmount' }, igst: igstOf('$items.gstAmount') } },
    ];
    const byGstin = (total: string): PipelineStage[] => [
        { $match: hasGstin },
        { $group: { _id: '$customerGstin', name: { $first: '$customerName' }, count: { $sum: 1 }, taxable: { $sum: DOC_TAXABLE }, gst: { $sum: '$totalGst' }, igst: igstOf('$totalGst'), total: { $sum: total } } },
        { $sort: { taxable: -1 } },
    ];
    const totals = (total: string): PipelineStage[] => [{ $group: { _id: null, count: { $sum: 1 }, taxable: { $sum: DOC_TAXABLE }, gst: { $sum: '$totalGst' }, igst: igstOf('$totalGst'), discount: { $sum: '$discount' }, total: { $sum: total } } }];

    const [summaryAgg, rateAgg, hsnAgg, b2bAgg, cnSummaryAgg, cnRateAgg, cnHsnAgg, cdnrAgg] = await Promise.all([
        Invoice.aggregate([{ $match: match }, ...totals('$grandTotal')]),
        Invoice.aggregate([{ $match: match }, ...byRate]),
        Invoice.aggregate([{ $match: match }, ...byHsn]),
        Invoice.aggregate([{ $match: match }, ...byGstin('$grandTotal')]),
        CreditNote.aggregate([{ $match: cnMatch }, ...totals('$total')]),
        CreditNote.aggregate([{ $match: cnMatch }, ...byRate]),
        CreditNote.aggregate([{ $match: cnMatch }, ...byHsn]),
        CreditNote.aggregate([{ $match: cnMatch }, ...byGstin('$total')]),
    ]);

    const zero = { count: 0, taxable: 0, gst: 0, igst: 0, discount: 0, total: 0 };
    const s = summaryAgg[0] || zero;
    const cn = cnSummaryAgg[0] || zero;
    const r2 = (n: number) => +n.toFixed(2);

    // Rate-wise and HSN tables, net of the month's returns.
    const rateWise = rateTable(netRows(rateAgg, cnRateAgg, rateKey));
    const hsnWise = hsnTable(netRows(hsnAgg, cnHsnAgg, hsnKey));

    const b2b = b2bAgg.map((b) => ({ gstin: b._id, name: b.name, invoices: b.count, taxable: r2(b.taxable), gst: r2(b.gst), igst: r2(b.igst), total: r2(b.total) }));
    const cdnr = cdnrAgg.map((b) => ({ gstin: b._id, name: b.name, notes: b.count, taxable: r2(b.taxable), gst: r2(b.gst), igst: r2(b.igst), total: r2(b.total) }));
    const b2bTaxable = b2b.reduce((a, x) => a + x.taxable, 0);
    const b2bGst = b2b.reduce((a, x) => a + x.gst, 0);
    const cdnrTaxable = cdnr.reduce((a, x) => a + x.taxable, 0);
    const cdnrGst = cdnr.reduce((a, x) => a + x.gst, 0);
    const netTaxable = s.taxable - cn.taxable;
    const netGst = s.gst - cn.gst;

    sendSuccess(res, {
        month: label,
        from,
        to,
        summary: {
            invoices: s.count,
            taxableValue: r2(netTaxable),
            ...splitTax(netGst, s.igst - cn.igst),
            totalTax: r2(netGst),
            discount: r2(s.discount),
            invoiceValue: r2(s.total - cn.total),
            creditNotes: { count: cn.count, taxable: r2(cn.taxable), gst: r2(cn.gst), total: r2(cn.total) },
        },
        rateWise,
        hsnWise,
        b2b,
        cdnr,
        b2bTaxable: r2(b2bTaxable),
        b2bGst: r2(b2bGst),
        b2cTaxable: r2(s.taxable - b2bTaxable - (cn.taxable - cdnrTaxable)),
        b2cGst: r2(s.gst - b2bGst - (cn.gst - cdnrGst)),
    });
});
