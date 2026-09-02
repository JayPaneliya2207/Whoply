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

/** GET /products — list with search & low-stock filter */
export const listProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    // Search matches name, barcode or SKU — lets a scanned barcode resolve to its product.
    if (req.query.search) {
        const rx = { $regex: String(req.query.search).trim(), $options: 'i' };
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
    sendPaginated(res, items, meta(total));
});

/** GET /products/:id */
export const getProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const product = await Product.findOne({ _id: req.params.id, businessId }).lean();
    if (!product) throw AppError.notFound('Product not found');
    sendSuccess(res, product);
});

/** POST /products */
export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const b = req.body;
    if (!b.name || !b.sku) throw AppError.badRequest('name and sku are required');

    const product = await Product.create({ ...b, businessId });
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

/** PATCH /products/:id */
export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const product = await Product.findOneAndUpdate({ _id: req.params.id, businessId }, req.body, { new: true });
    if (!product) throw AppError.notFound('Product not found');
    // stock or threshold may have changed — keep the low-stock flag truthful
    await syncLowStock([product._id]);
    sendSuccess(res, product, 'Product updated');
});

/** POST /products/:id/adjust-stock — manual adjustment/damage */
export const adjustStock = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { quantity, reason = 'adjustment', note } = req.body;
    const qty = Number(quantity);
    if (!qty) throw AppError.badRequest('quantity is required');

    const product = await Product.findOne({ _id: req.params.id, businessId });
    if (!product) throw AppError.notFound('Product not found');

    product.currentStock += qty;
    product.isLowStock = product.currentStock <= product.lowStockThreshold;
    await product.save();
    await StockMovement.create({ businessId, productId: product._id, reason, quantity: qty, note });
    sendSuccess(res, product, 'Stock adjusted');
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
