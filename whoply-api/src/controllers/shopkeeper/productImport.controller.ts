/**
 * Adding many items at once from a file. The app reads the file (CSV) and
 * sends the rows; this checks every row, says in plain words what is wrong
 * with which one, and adds the good ones. With `check: true` nothing is saved
 * — the app shows the result first and the shopkeeper decides.
 *
 * It only ADDS. An item that is already there (same code, same barcode, or —
 * when the row has no code — the same name) is skipped and reported, so
 * importing the same file twice never makes a second copy and never changes
 * a price or the stock of an item already in use.
 */
import type { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import StockMovement from '../../models/StockMovement.js';
import { syncLowStock } from '../../utils/stock.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** Rows in one request. The app sends a big file in pieces of this size. */
export const IMPORT_MAX_ROWS = 500;

interface Row { name: string; sku: string; barcode: string; category: string; unit: string; hsn: string; costPrice: number; sellPrice: number; wholesalePrice: number; gstRate: number; currentStock: number; lowStockThreshold: number }
/**
 * Why a row was left out: `reason` in plain English, and `why` (+ `what`: the
 * column, code or barcode it is about) so the app can say it in its own language.
 */
type Problem = { reason: string; why: 'unreadable' | 'noName' | 'noPrice' | 'notNumber' | 'below0' | 'range100' | 'sameCode' | 'sameBarcode' | 'sameName'; what?: string };
type Issue = { row: number; name: string } & Problem;

const text = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');
/** "1,250.50", "₹ 1250", " 18% " → a number; '' → the fallback; anything else → NaN. */
const num = (v: unknown, fallback: number): number => {
    const s = text(v, 30).replace(/[₹,%\s]|rs\.?/gi, '');
    if (s === '') return fallback;
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
};
const key = (s: string) => s.trim().toLowerCase();

/** One row as typed in the file → a clean row, or why it can't be used. */
function parseRow(raw: any): Row | Problem {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { reason: 'This row could not be read', why: 'unreadable' };
    const name = text(raw.name, 120);
    if (name.length < 1) return { reason: 'The item name is missing', why: 'noName' };
    const sellPrice = num(raw.sellPrice, NaN);
    if (!Number.isFinite(sellPrice)) return { reason: 'The selling price is missing or is not a number', why: 'noPrice' };
    if (sellPrice < 0) return { reason: 'The selling price can not be less than 0', why: 'below0', what: 'Selling price' };
    const row: Row = {
        name,
        sku: text(raw.sku, 40),
        barcode: text(raw.barcode, 40),
        category: text(raw.category, 60),
        unit: text(raw.unit, 12).toLowerCase() || 'pcs',
        hsn: text(raw.hsn, 12),
        sellPrice,
        costPrice: num(raw.costPrice, 0),
        wholesalePrice: num(raw.wholesalePrice, 0),
        gstRate: num(raw.gstRate, 0),
        currentStock: num(raw.stock, 0),
        lowStockThreshold: num(raw.lowStock, 10),
    };
    // `what` is the column as the sample file heads it.
    for (const [label, what, v, max] of [['cost price', 'Cost price', row.costPrice, Infinity], ['wholesale price', 'Wholesale price', row.wholesalePrice, Infinity], ['GST %', 'GST %', row.gstRate, 100], ['stock', 'Stock', row.currentStock, Infinity], ['low-stock number', 'Low stock alert', row.lowStockThreshold, Infinity]] as const) {
        if (!Number.isFinite(v)) return { reason: `The ${label} is not a number`, why: 'notNumber', what };
        if (v < 0) return { reason: `The ${label} can not be less than 0`, why: 'below0', what };
        if (v > max) return { reason: `The ${label} must be between 0 and ${max}`, why: 'range100', what };
    }
    return row;
}

/**
 * POST /products/import  { rows: [...], check?: true }
 * Each row: name, sellPrice (needed) and sku, barcode, category, unit, hsn,
 * costPrice, wholesalePrice, gstRate, stock, lowStock (optional).
 * Answers { created, ready, skipped: [{ row, name, reason, why, what? }], errors: [...], newCategories }
 * — `row` counts from 1 within this request.
 */
export const importProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const rows: unknown = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) throw AppError.badRequest('There are no rows to import');
    if (rows.length > IMPORT_MAX_ROWS) throw AppError.badRequest(`Send at most ${IMPORT_MAX_ROWS} rows at a time`);
    const check = req.body.check === true;

    const errors: Issue[] = [];
    const skipped: Issue[] = [];
    const good: { row: number; data: Row }[] = [];
    rows.forEach((raw, i) => {
        const parsed = parseRow(raw);
        if ('why' in parsed) errors.push({ row: i + 1, name: text((raw as any)?.name, 60), ...parsed });
        else good.push({ row: i + 1, data: parsed });
    });

    // What this business already has. Codes are unique even against removed items (the database index says so).
    const existing = await Product.find({ businessId }).select('name sku barcode isActive').lean();
    const skus = new Set(existing.map((p) => key(p.sku)));
    const barcodes = new Set(existing.filter((p) => p.isActive && p.barcode).map((p) => key(p.barcode!)));
    const names = new Set(existing.filter((p) => p.isActive).map((p) => key(p.name)));

    let nextAuto = existing.length + 1;
    const autoSku = () => {
        let code: string;
        do code = `ITM${String(nextAuto++).padStart(4, '0')}`; while (skus.has(key(code)));
        return code;
    };

    const ready: { row: number; data: Row }[] = [];
    for (const g of good) {
        const d = g.data;
        const skip = (reason: string, why: Problem['why'], what?: string) => skipped.push({ row: g.row, name: d.name, reason, why, ...(what && { what }) });
        if (d.sku && skus.has(key(d.sku))) { skip(`An item with the code ${d.sku} is already there`, 'sameCode', d.sku); continue; }
        if (d.barcode && barcodes.has(key(d.barcode))) { skip(`An item with the barcode ${d.barcode} is already there`, 'sameBarcode', d.barcode); continue; }
        if (!d.sku && names.has(key(d.name))) { skip('An item with this name is already there', 'sameName'); continue; }
        // No code in the file: the barcode serves as the code, else the next free ITM number.
        if (!d.sku) d.sku = d.barcode && !skus.has(key(d.barcode)) ? d.barcode : autoSku();
        skus.add(key(d.sku));
        if (d.barcode) barcodes.add(key(d.barcode));
        names.add(key(d.name));
        ready.push(g);
    }

    // Categories are matched by name without minding capitals; new names are made on save.
    const cats = await Category.find({ businessId }).select('name').lean();
    const catId = new Map(cats.map((c) => [key(c.name), c._id]));
    const fresh = new Map<string, string>(); // lower-case name → the name as first written in the file
    for (const g of ready) {
        const k = key(g.data.category);
        if (k && !catId.has(k) && !fresh.has(k)) fresh.set(k, g.data.category);
    }
    const newCategories = [...fresh.values()];

    if (check || !ready.length) {
        sendSuccess(res, { created: 0, ready: ready.length, skipped, errors, newCategories });
        return;
    }

    for (const name of newCategories) {
        const made = await Category.findOneAndUpdate({ businessId, name }, { $setOnInsert: { businessId, name } }, { upsert: true, new: true }).select('name').lean();
        if (made) catId.set(key(made.name), made._id);
    }
    // MRP-style (GST included) for shops, GST on top for wholesalers — the same rule as adding one item by hand.
    const priceIncludesGst = req.user?.businessType === 'retail';
    const docs = ready.map(({ data: d }) => ({
        _id: new Types.ObjectId(),
        businessId,
        name: d.name, sku: d.sku, barcode: d.barcode || undefined, hsn: d.hsn || undefined, unit: d.unit,
        categoryId: d.category ? catId.get(key(d.category)) : undefined,
        costPrice: d.costPrice, sellPrice: d.sellPrice, wholesalePrice: d.wholesalePrice, gstRate: d.gstRate,
        currentStock: d.currentStock, lowStockThreshold: d.lowStockThreshold, priceIncludesGst,
    }));
    await Product.insertMany(docs, { ordered: false });
    const opening = docs.filter((p) => p.currentStock > 0).map((p) => ({ businessId, productId: p._id, reason: 'opening' as const, quantity: p.currentStock, note: 'Opening stock (imported)' }));
    if (opening.length) await StockMovement.insertMany(opening, { ordered: false });
    await syncLowStock(docs.map((p) => p._id));

    sendSuccess(res, { created: docs.length, ready: 0, skipped, errors, newCategories }, `${docs.length} item${docs.length === 1 ? '' : 's'} added`);
});
