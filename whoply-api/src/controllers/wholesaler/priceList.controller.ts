import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Product from '../../models/Product.js';
import PriceList from '../../models/PriceList.js';
import { defaultTierPrice, tierBase } from '../../utils/wholesaler.js';
import type { AuthRequest } from '../../interfaces/index.js';

/**
 * GET /price-lists — products with their A/B/C tier prices merged in.
 * A tier the wholesaler hasn't set shows the default (base × tier multiplier),
 * computed here and NOT stored — so it keeps following the base price, and
 * orders price it the same way (utils/wholesaler.ts). `custom` marks the tiers
 * that are saved overrides. Read-only: opening this page changes nothing.
 */
export const getPriceList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [products, rows] = await Promise.all([
        Product.find({ businessId, isActive: true }).sort({ name: 1 }).lean(),
        PriceList.find({ businessId }).lean(),
    ]);
    const saved = new Map<string, Record<string, number>>();
    rows.forEach((r) => {
        const key = String(r.productId);
        if (!saved.has(key)) saved.set(key, {});
        saved.get(key)![r.tier] = r.price;
    });

    const items = products.map((p) => {
        const own = saved.get(String(p._id)) || {};
        const price = (tier: 'A' | 'B' | 'C') => (own[tier] != null ? own[tier] : tierBase(p) > 0 ? defaultTierPrice(p, tier) : null);
        return {
            productId: p._id,
            name: p.name,
            unit: p.unit,
            base: tierBase(p),
            A: price('A'),
            B: price('B'),
            C: price('C'),
            custom: { A: own.A != null, B: own.B != null, C: own.C != null },
        };
    });
    sendSuccess(res, items);
});

/** PUT /price-lists — upsert a tier price for a product */
export const setPrice = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { productId, tier, price } = req.body;
    if (!productId || !['A', 'B', 'C'].includes(tier) || price == null) {
        throw AppError.badRequest('productId, tier (A/B/C) and price are required');
    }
    if (!(Number(price) >= 0)) throw AppError.badRequest('Price must be a number, 0 or more');
    if (!(await Product.exists({ _id: productId, businessId }))) throw AppError.notFound('Product not found');
    const row = await PriceList.findOneAndUpdate(
        { businessId, productId, tier },
        { price: Number(price) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    sendCreated(res, row, 'Price saved');
});
