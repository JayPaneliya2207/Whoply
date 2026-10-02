import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import StockMovement from '../../models/StockMovement.js';
import { syncLowStock } from '../../utils/stock.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { can } from '../../utils/permissions.js';
import { containsText } from '../../utils/search.js';
import { lineQty } from '../../utils/qty.js';
import { cleanImage } from '../../utils/image.js';

/** Cost price shows the margin, so only roles allowed to see it get it (not a cashier or sales rep). */
function hideCost<T extends { costPrice?: number }>(req: AuthRequest, p: T): T {
    if (can(req.user?.role, 'products.cost')) return p;
    const { costPrice: _cost, ...rest } = p;
    return rest as T;
}

/** GET /products — list with search & low-stock filter */
export const listProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    // Search matches name, barcode or SKU — lets a scanned barcode resolve to its product.
    if (req.query.search) {
        const rx = containsText(req.query.search);
        filter.$or = [{ name: rx }, { barcode: rx }, { sku: rx }];
    }
    // Exact barcode lookup (used by scan-to-add flows).
    if (req.query.barcode) filter.barcode = String(req.query.barcode).trim();
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.lowStock === 'true') filter.isLowStock = true;

    const [items, total] = await Promise.all([
        Product.find(filter).populate('categoryId', 'name').sort({ name: 1 }).skip(skip).limit(limit).lean(),
        Product.countDocuments(filter),
    ]);
    sendPaginated(res, items.map((p) => hideCost(req, p)), meta(total));
});

/** GET /products/:id */
export const getProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const product = await Product.findOne({ _id: req.params.id, businessId }).lean();
    if (!product) throw AppError.notFound('Product not found');
    sendSuccess(res, hideCost(req, product));
});

const TEXT_FIELDS = ['name', 'sku', 'barcode', 'hsn', 'unit', 'image'] as const;
const MONEY_FIELDS = ['costPrice', 'sellPrice', 'wholesalePrice'] as const;

/**
 * The product fields a client may set, validated. `currentStock` is only
 * accepted on create (opening stock) — after that stock changes only through
 * sales, purchases, returns and POST /adjust-stock, each with a StockMovement,
 * so an edit made from an out-of-date screen can't overwrite live stock.
 */
function productFields(b: any, opts: { create: boolean }): Record<string, any> {
    const out: Record<string, any> = {};
    const num = (k: string, min: number, max = Infinity) => {
        if (b[k] === undefined || b[k] === '') return;
        const n = Number(b[k]);
        if (!Number.isFinite(n) || n < min || n > max) {
            throw AppError.badRequest(`${k} must be a number${max === Infinity ? ` of at least ${min}` : ` between ${min} and ${max}`}`);
        }
        out[k] = n;
    };
    for (const k of TEXT_FIELDS) if (b[k] !== undefined) out[k] = typeof b[k] === 'string' ? b[k].trim() : b[k];
    if (out.image !== undefined) out.image = cleanImage(out.image, 400_000, 'Product picture');
    for (const k of MONEY_FIELDS) num(k, 0);
    num('discountPct', 0, 100);
    num('gstRate', 0, 100);
    num('lowStockThreshold', 0);
    if (opts.create) num('currentStock', 0);
    if (b.priceIncludesGst !== undefined) out.priceIncludesGst = b.priceIncludesGst === true || b.priceIncludesGst === 'true';
    if (b.trackExpiry !== undefined) out.trackExpiry = !!b.trackExpiry;
    if (b.categoryId !== undefined) out.categoryId = b.categoryId || null; // '' clears it
    return out;
}

/** POST /products */
export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const fields = productFields(req.body, { create: true });
    if (!fields.name || !fields.sku) throw AppError.badRequest('name and sku are required');
    // MRP-style (GST included) for shops, GST on top for wholesalers — unless the client says otherwise.
    if (fields.priceIncludesGst === undefined) fields.priceIncludesGst = req.user?.businessType === 'retail';

    const product = await Product.create({ ...fields, businessId });
    if (product.currentStock > 0) {
        await StockMovement.create({
            businessId,
            productId: product._id,
            reason: 'opening',
            quantity: product.currentStock,
            note: 'Opening stock',
        });
    }
    await syncLowStock([product._id]);
    sendCreated(res, product);
});

/** PATCH /products/:id — edits details and prices; stock is ignored here (see productFields). */
export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const fields = productFields(req.body, { create: false });
    if (fields.name === '' || fields.sku === '') throw AppError.badRequest('name and sku cannot be empty');
    const product = await Product.findOneAndUpdate({ _id: req.params.id, businessId }, { $set: fields }, { new: true });
    if (!product) throw AppError.notFound('Product not found');
    // the threshold may have changed — keep the low-stock flag truthful
    await syncLowStock([product._id]);
    sendSuccess(res, product, 'Product updated');
});

/**
 * POST /products/:id/adjust-stock — correct stock by hand.
 * body: { quantity } to add (+) or remove (−) — or { countedStock } after a
 * physical count; reason 'damage' (broken / expired — removes stock) or
 * 'adjustment' (default); note?
 * Applied as one conditional update, so a sale at the same moment is never
 * lost and stock never goes below zero. Quantities follow the product's unit
 * (whole numbers for pcs, decimals for kg / litre…).
 */
export const adjustStock = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const reason = req.body.reason === 'damage' ? 'damage' : 'adjustment';
    const note = String(req.body.note ?? '').trim().slice(0, 200) || undefined;
    const product = await Product.findOne({ _id: req.params.id, businessId }).select('name unit currentStock').lean();
    if (!product) throw AppError.notFound('Product not found');
    const unit = product.unit || 'pcs';
    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    const byCount = req.body.countedStock !== undefined && req.body.countedStock !== '';
    const filter: Record<string, any> = { _id: product._id, businessId };
    let delta: number;
    let counted = 0;
    if (byCount) {
        const n = Number(req.body.countedStock);
        if (!Number.isFinite(n) || n < 0) throw AppError.badRequest('Counted stock must be 0 or more');
        counted = n === 0 ? 0 : lineQty(n, product);
        delta = round3(counted - product.currentStock);
        if (delta === 0) {
            sendSuccess(res, product, 'Stock already matches the count');
            return;
        }
        // Only if nothing was sold or bought since the stock we compared with.
        filter.currentStock = product.currentStock;
    } else {
        const n = Number(req.body.quantity);
        if (!n || !Number.isFinite(n)) throw AppError.badRequest('Enter how many to add or remove');
        const size = lineQty(Math.abs(n), product);
        delta = n < 0 ? -size : size;
        if (delta < 0) filter.currentStock = { $gte: -delta };
    }
    if (reason === 'damage' && delta > 0) throw AppError.badRequest('Damage removes stock — enter the quantity lost');

    const updated = await Product.findOneAndUpdate(filter, { $inc: { currentStock: delta } }, { new: true });
    if (!updated) {
        const now = await Product.findById(product._id).select('currentStock').lean();
        if (byCount) {
            throw AppError.conflict(`Stock changed while you were counting (a sale or purchase just happened) — it is now ${now?.currentStock ?? 0} ${unit}. Check the count and save again.`);
        }
        throw AppError.badRequest(`Only ${now?.currentStock ?? 0} ${unit} in stock — can't remove ${-delta}`);
    }
    // Stored to 3 decimals so kg / litre stock doesn't drift (0.1 + 0.2 …).
    if (updated.currentStock !== round3(updated.currentStock)) {
        await Product.updateOne({ _id: updated._id }, { $set: { currentStock: round3(updated.currentStock) } });
    }
    await Promise.all([
        syncLowStock([updated._id]),
        StockMovement.create({
            businessId,
            productId: updated._id,
            reason,
            quantity: delta,
            note: byCount ? [`Counted ${counted} ${unit}`, note].filter(Boolean).join(' — ') : note,
        }),
    ]);
    const fresh = await Product.findById(updated._id).lean();
    sendSuccess(res, fresh, 'Stock adjusted');
});

/** GET /products/:id/movements — the product's last 50 stock changes, newest first. */
export const productMovements = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const product = await Product.findOne({ _id: req.params.id, businessId }).select('name unit currentStock').lean();
    if (!product) throw AppError.notFound('Product not found');
    const movements = await StockMovement.find({ businessId, productId: product._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('reason quantity note refType createdAt')
        .lean();
    sendSuccess(res, { product, movements });
});

/** DELETE /products/:id — soft delete */
export const deleteProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const product = await Product.findOneAndUpdate({ _id: req.params.id, businessId }, { isActive: false }, { new: true });
    if (!product) throw AppError.notFound('Product not found');
    sendSuccess(res, { ok: true }, 'Product deleted');
});

/** Categories */
export const listCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const items = await Category.find({ businessId, isActive: true }).sort({ name: 1 }).lean();
    // attach product counts per category
    const counts = await Product.aggregate([
        { $match: { businessId, isActive: true } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    sendSuccess(res, items.map((c) => ({ ...c, productCount: countMap.get(String(c._id)) || 0 })));
});

export const createCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    if (!req.body.name) throw AppError.badRequest('name is required');
    const category = await Category.create({ businessId, name: req.body.name, icon: req.body.icon });
    sendCreated(res, category);
});

export const updateCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const category = await Category.findOneAndUpdate(
        { _id: req.params.id, businessId },
        { name: req.body.name, icon: req.body.icon },
        { new: true }
    );
    if (!category) throw AppError.notFound('Category not found');
    sendSuccess(res, category, 'Category updated');
});

export const deleteCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const inUse = await Product.countDocuments({ businessId, categoryId: req.params.id, isActive: true });
    if (inUse > 0) throw AppError.badRequest(`Cannot delete — ${inUse} product(s) use this category`);
    const category = await Category.findOneAndUpdate({ _id: req.params.id, businessId }, { isActive: false }, { new: true });
    if (!category) throw AppError.notFound('Category not found');
    sendSuccess(res, { ok: true }, 'Category deleted');
});
