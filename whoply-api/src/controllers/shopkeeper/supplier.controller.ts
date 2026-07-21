import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Supplier from '../../models/Supplier.js';
import Product from '../../models/Product.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import StockMovement from '../../models/StockMovement.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

/* ---- Suppliers ---- */
export const listSuppliers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const items = await Supplier.find({ businessId, isActive: true }).sort({ name: 1 }).lean();
    sendSuccess(res, items);
});

export const createSupplier = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    if (!req.body.name) throw AppError.badRequest('name is required');
    const supplier = await Supplier.create({ ...req.body, businessId });
    sendCreated(res, supplier);
});

/* ---- Purchase Orders ---- */
export const listPurchases = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
        PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/** POST /purchases — create a PO (draft, pending receipt) */
export const createPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { supplierId, items = [], paidAmount = 0 } = req.body;
    if (!supplierId) throw AppError.badRequest('supplierId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');

    const supplier = await Supplier.findOne({ _id: supplierId, businessId });
    if (!supplier) throw AppError.badRequest('Supplier not found');

    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId });
    const map = new Map(products.map((p) => [String(p._id), p]));

    let total = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        const cost = i.costPrice != null ? Number(i.costPrice) : p.costPrice;
        const lineTotal = +(qty * cost).toFixed(2);
        total += lineTotal;
        return { productId: p._id, name: p.name, quantity: qty, costPrice: cost, lineTotal };
    });

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`po:${businessId}:${ym}`);
    const poNo = `PO/${ym}/${String(seq).padStart(4, '0')}`;
    const due = +(total - Number(paidAmount)).toFixed(2);

    const po = await PurchaseOrder.create({
        businessId,
        poNo,
        supplierId,
        supplierName: supplier.name,
        items: lineItems,
        total: +total.toFixed(2),
        paidAmount: Number(paidAmount),
        dueAmount: due,
        status: 'pending',
    });
    if (due > 0) {
        supplier.payableBalance += due;
        await supplier.save();
    }
    sendCreated(res, po);
});

/** POST /purchases/:id/receive — mark received & add stock */
export const receivePurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const po = await PurchaseOrder.findOne({ _id: req.params.id, businessId });
    if (!po) throw AppError.notFound('Purchase order not found');
    if (po.status === 'received') throw AppError.badRequest('Already received');

    for (const li of po.items) {
        await Product.updateOne({ _id: li.productId }, { $inc: { currentStock: li.quantity } });
        await StockMovement.create({
            businessId,
            productId: li.productId,
            reason: 'purchase',
            quantity: li.quantity,
            refType: 'PurchaseOrder',
            refId: po._id,
        });
    }
    po.status = 'received';
    po.receivedAt = new Date();
    await po.save();
    sendSuccess(res, po, 'Stock received');
});
