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
import { round2 } from '../../utils/tax.js';

/* ---- Suppliers ---- */
const SUPPLIER_FIELDS = ['name', 'mobile', 'countryCode', 'gstin', 'address'] as const;

/** Only the form fields — never a balance, active flag or id from the request. */
function supplierFields(body: any, creating: boolean) {
    const patch: Record<string, any> = {};
    for (const k of SUPPLIER_FIELDS) if (body[k] !== undefined) patch[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
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

/** POST /purchases — create a PO (pending receipt). body: { supplierId, items:[{ productId, quantity, costPrice? }], paidAmount? } */
export const createPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { supplierId, items = [], paidAmount = 0 } = req.body;
    if (!supplierId) throw AppError.badRequest('supplierId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');

    const supplier = await Supplier.findOne({ _id: supplierId, businessId, isActive: true });
    if (!supplier) throw AppError.badRequest('Supplier not found');

    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId, isActive: true });
    const map = new Map(products.map((p) => [String(p._id), p]));

    let total = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = lineQty(i.quantity, p);
        const cost = i.costPrice != null ? Number(i.costPrice) : p.costPrice;
        if (!(cost >= 0)) throw AppError.badRequest(`Cost price for ${p.name} must be 0 or more`);
        const lineTotal = round2(qty * cost);
        total += lineTotal;
        return { productId: p._id, name: p.name, quantity: qty, costPrice: cost, lineTotal };
    });
    total = round2(total);

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
        items: lineItems,
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

/** POST /purchases/:id/receive — mark received & add stock. Only once: a double tap or a second phone gets "Already received". */
export const receivePurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const po = await PurchaseOrder.findOneAndUpdate(
        { _id: req.params.id, businessId, status: 'pending' },
        { $set: { status: 'received', receivedAt: new Date() } },
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
