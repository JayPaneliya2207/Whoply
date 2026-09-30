import type { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Supplier from '../../models/Supplier.js';
import Product from '../../models/Product.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import { applyStockChanges } from '../../utils/stock.js';
import { lineQty } from '../../utils/qty.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { istYm } from '../../utils/ist.js';
import { round2, priceLines } from '../../utils/tax.js';
import { cleanGstin } from '../../utils/gstin.js';
import { isInterState } from '../../utils/gstSplit.js';
import { istDaysAgo } from '../../utils/ist.js';
import Business from '../../models/Business.js';

/* ---- Suppliers ---- */
const SUPPLIER_FIELDS = ['name', 'mobile', 'countryCode', 'gstin', 'address'] as const;

/** Only the form fields — never a balance, active flag or id from the request. */
function supplierFields(body: any, creating: boolean) {
    const patch: Record<string, any> = {};
    for (const k of SUPPLIER_FIELDS) if (body[k] !== undefined) patch[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
    // A wrong GSTIN would put the wrong tax (IGST vs CGST + SGST) and wrong credit on its bills.
    if (patch.gstin !== undefined) patch.gstin = cleanGstin(patch.gstin, (m) => AppError.badRequest(m)) ?? '';
    if ((creating || patch.name !== undefined) && !patch.name) throw AppError.badRequest('Supplier name is required');
    return patch;
}

/** Move what we owe a supplier — an atomic $inc, so two writes at once can't lose each other. */
const addToPayable = (businessId: any, supplierId: any, amount: number) =>
    amount ? Supplier.updateOne({ _id: supplierId, businessId }, { $inc: { payableBalance: round2(amount) } }) : Promise.resolve();

export const listSuppliers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const items = await Supplier.find({ businessId, isActive: true }).sort({ name: 1 }).lean();
    sendSuccess(res, items);
});

export const createSupplier = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const supplier = await Supplier.create({ ...supplierFields(req.body, true), businessId });
    sendCreated(res, supplier);
});

export const updateSupplier = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const supplier = await Supplier.findOneAndUpdate({ _id: req.params.id, businessId, isActive: true }, supplierFields(req.body, false), { new: true });
    if (!supplier) throw AppError.notFound('Supplier not found');
    sendSuccess(res, supplier, 'Supplier updated');
});

/** DELETE /suppliers/:id — refused while you still owe them (the due would vanish from the dashboard and reminders). */
export const deleteSupplier = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const owed = await PurchaseOrder.aggregate([
        { $match: { businessId: new Types.ObjectId(String(businessId)), supplierId: new Types.ObjectId(String(req.params.id)), status: { $ne: 'cancelled' }, dueAmount: { $gt: 0 } } },
        { $group: { _id: null, due: { $sum: '$dueAmount' } } },
    ]);
    if (owed[0]?.due > 0) throw AppError.badRequest(`You still owe this supplier ₹${round2(owed[0].due)} — pay or cancel those purchase orders first`);
    const supplier = await Supplier.findOneAndUpdate({ _id: req.params.id, businessId }, { isActive: false }, { new: true });
    if (!supplier) throw AppError.notFound('Supplier not found');
    sendSuccess(res, { ok: true }, 'Supplier removed');
});

/* ---- Purchase Orders ---- */

/** The supplier's bill number (GST allows 16 characters) and date (not in the future) — for GSTR-2B matching. */
function billFields(body: any) {
    const out: Record<string, any> = {};
    if (body.supplierInvoiceNo !== undefined) {
        const no = String(body.supplierInvoiceNo ?? '').trim();
        if (no.length > 16) throw AppError.badRequest('Supplier bill number can be at most 16 characters');
        out.supplierInvoiceNo = no || undefined;
    }
    if (body.supplierInvoiceDate) {
        const d = new Date(body.supplierInvoiceDate);
        if (Number.isNaN(d.getTime())) throw AppError.badRequest('Invalid supplier bill date');
        if (d.getTime() > istDaysAgo(-1).getTime()) throw AppError.badRequest('The supplier bill date can not be in the future');
        out.supplierInvoiceDate = d;
    }
    return out;
}
export const listPurchases = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.status) filter.status = String(req.query.status);
    const [items, total] = await Promise.all([
        PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/**
 * POST /purchases — create a PO (pending receipt).
 * body: { supplierId, items:[{ productId, quantity, costPrice? }], pricesIncludeGst?, paidAmount?,
 *         supplierInvoiceNo?, supplierInvoiceDate? }
 * Cost is before GST unless pricesIncludeGst; GST is worked out per line at the product's rate,
 * the same way bills are (utils/tax.ts). IGST when the supplier is in another state. The total,
 * GST included, is what the business owes the supplier.
 */
export const createPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { supplierId, items = [], paidAmount = 0 } = req.body;
    const inclusive = req.body.pricesIncludeGst === true;
    const bill = billFields(req.body);
    if (!supplierId) throw AppError.badRequest('supplierId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');

    const supplier = await Supplier.findOne({ _id: supplierId, businessId, isActive: true });
    if (!supplier) throw AppError.badRequest('Supplier not found');

    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId, isActive: true });
    const map = new Map(products.map((p) => [String(p._id), p]));

    const rows = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = lineQty(i.quantity, p);
        const cost = i.costPrice != null && i.costPrice !== '' ? Number(i.costPrice) : p.costPrice;
        if (!Number.isFinite(cost) || cost < 0) throw AppError.badRequest(`Cost price for ${p.name} must be 0 or more`);
        return { p, qty, cost };
    });
    const priced = priceLines(rows.map((r) => ({ unitPrice: r.cost, quantity: r.qty, gstRate: r.p.gstRate || 0, inclusive })), 0);
    const lineItems = rows.map((r, k) => ({
        productId: r.p._id, name: r.p.name, hsn: r.p.hsn, unit: r.p.unit, quantity: r.qty, costPrice: r.cost,
        gstRate: r.p.gstRate || 0, taxableValue: priced.lines[k].taxableValue, gstAmount: priced.lines[k].gstAmount, lineTotal: priced.lines[k].lineTotal,
    }));
    const total = priced.grandTotal;
    const biz = await Business.findById(businessId).select('gstin').lean();

    const paid = round2(Number(paidAmount) || 0);
    if (paid < 0) throw AppError.badRequest('Paid amount can not be negative');
    if (paid > total + 0.005) throw AppError.badRequest(`Paid now (₹${paid}) is more than the order total of ₹${total}`);
    const due = round2(total - paid);

    const ym = istYm();
    const seq = await nextSequence(`po:${businessId}:${ym}`);
    const po = await PurchaseOrder.create({
        businessId,
        poNo: `PO/${ym}/${String(seq).padStart(4, '0')}`,
        supplierId,
        supplierName: supplier.name,
        supplierGstin: supplier.gstin || undefined,
        ...bill,
        items: lineItems,
        pricesIncludeGst: inclusive,
        subtotal: priced.subtotal,
        totalGst: priced.totalGst,
        interState: isInterState(supplier.gstin, biz?.gstin),
        total,
        paidAmount: paid,
        dueAmount: due,
        status: 'pending',
    });
    await addToPayable(businessId, supplier._id, due);
    sendCreated(res, po);
});

/** POST /purchases/:id/payment — record a payment YOU make to the supplier. Refused if more than the due. */
export const payPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const amount = round2(Number(req.body.amount));
    if (!(amount > 0)) throw AppError.badRequest('Enter a valid payment amount');
    const current = await PurchaseOrder.findOne({ _id: req.params.id, businessId });
    if (!current) throw AppError.notFound('Purchase order not found');
    if (current.status === 'cancelled') throw AppError.badRequest('This purchase order was cancelled');
    if (current.dueAmount <= 0) throw AppError.badRequest('This purchase order is already fully paid');
    if (amount > current.dueAmount + 0.005) throw AppError.badRequest(`₹${amount} is more than the ₹${current.dueAmount} still due on this purchase order`);

    // Atomic: only goes through while the due still covers it, so two payments at once can't both land.
    const po = await PurchaseOrder.findOneAndUpdate(
        { _id: current._id, businessId, status: { $ne: 'cancelled' }, dueAmount: { $gte: amount - 0.005 } },
        [{ $set: { paidAmount: { $round: [{ $add: ['$paidAmount', amount] }, 2] }, dueAmount: { $max: [0, { $round: [{ $subtract: ['$dueAmount', amount] }, 2] }] } } }],
        { new: true, updatePipeline: true }
    );
    if (!po) throw AppError.badRequest('The due changed while you were paying — open the purchase order again');
    await addToPayable(businessId, po.supplierId, -amount);
    sendSuccess(res, po, 'Payment recorded');
});

/**
 * POST /purchases/:id/receive — mark received & add stock. Only once: a double tap or a second phone
 * gets "Already received". body (optional): { supplierInvoiceNo, supplierInvoiceDate } — input tax
 * credit counts in the month the goods are received.
 */
export const receivePurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bill = billFields(req.body || {});
    const po = await PurchaseOrder.findOneAndUpdate(
        { _id: req.params.id, businessId, status: 'pending' },
        { $set: { status: 'received', receivedAt: new Date(), ...bill } },
        { new: true }
    );
    if (!po) {
        const other = await PurchaseOrder.findOne({ _id: req.params.id, businessId }).select('status').lean();
        if (!other) throw AppError.notFound('Purchase order not found');
        throw AppError.badRequest(other.status === 'cancelled' ? 'This purchase order was cancelled' : 'Already received');
    }
    try {
        await applyStockChanges(
            businessId,
            po.items.map((li) => ({ productId: li.productId, delta: li.quantity })),
            { reason: 'purchase', refType: 'PurchaseOrder', refId: po._id }
        );
    } catch (e) {
        await PurchaseOrder.updateOne({ _id: po._id }, { $set: { status: 'pending' }, $unset: { receivedAt: 1 } }).catch(() => {});
        throw e;
    }
    sendSuccess(res, po, 'Stock received');
});

/**
 * POST /purchases/:id/cancel — cancel a PO entered by mistake: only while it is
 * pending (not received) and nothing has been paid on it. Its due comes off the
 * supplier's balance.
 */
export const cancelPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const po = await PurchaseOrder.findOneAndUpdate(
        { _id: req.params.id, businessId, status: 'pending', paidAmount: { $lte: 0 } },
        { $set: { status: 'cancelled' } },
        { new: true }
    );
    if (!po) {
        const other = await PurchaseOrder.findOne({ _id: req.params.id, businessId }).select('status paidAmount').lean();
        if (!other) throw AppError.notFound('Purchase order not found');
        if (other.status === 'received') throw AppError.badRequest('This purchase order is already received — its stock is in your shop');
        if (other.status === 'cancelled') throw AppError.badRequest('Already cancelled');
        throw AppError.badRequest(`₹${other.paidAmount} was already paid on this purchase order, so it can not be cancelled`);
    }
    await addToPayable(businessId, po.supplierId, -po.dueAmount);
    sendSuccess(res, po, 'Purchase order cancelled');
});

/** PATCH /purchases/:id/bill — add or correct the supplier's bill number / date (any time unless cancelled). */
export const updatePurchaseBill = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bill = billFields(req.body || {});
    if (!Object.keys(bill).length) throw AppError.badRequest('Send supplierInvoiceNo and/or supplierInvoiceDate');
    const po = await PurchaseOrder.findOneAndUpdate({ _id: req.params.id, businessId, status: { $ne: 'cancelled' } }, { $set: bill }, { new: true });
    if (!po) throw AppError.notFound('Purchase order not found');
    sendSuccess(res, po, 'Supplier bill saved');
});
