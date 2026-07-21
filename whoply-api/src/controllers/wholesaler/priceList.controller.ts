import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Product from '../../models/Product.js';
import PriceList from '../../models/PriceList.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** GET /price-lists — products with their A/B/C tier prices merged in */
export const getPriceList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [products, rows] = await Promise.all([
        Product.find({ businessId, isActive: true }).sort({ name: 1 }).lean(),
        PriceList.find({ businessId }).lean(),
    ]);
    const byProduct = new Map<string, any>();
    rows.forEach((r) => {
        const key = String(r.productId);
        if (!byProduct.has(key)) byProduct.set(key, {});
        byProduct.get(key)[r.tier] = r.price;
    });
    const items = products.map((p) => {
        const tiers = byProduct.get(String(p._id)) || {};
        return {
            productId: p._id,
            name: p.name,
            unit: p.unit,
            base: p.wholesalePrice || p.sellPrice,
            A: tiers.A ?? null,
            B: tiers.B ?? null,
            C: tiers.C ?? null,
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
    const row = await PriceList.findOneAndUpdate(
        { businessId, productId, tier },
        { price: Number(price) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    sendCreated(res, row, 'Price saved');
});
