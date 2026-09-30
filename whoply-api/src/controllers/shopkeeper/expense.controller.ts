import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Expense from '../../models/Expense.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { istDaysAgo } from '../../utils/ist.js';

export const listExpenses = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const [items, total] = await Promise.all([
        Expense.find({ businessId }).sort({ spentAt: -1 }).skip(skip).limit(limit).lean(),
        Expense.countDocuments({ businessId }),
    ]);
    sendPaginated(res, items, meta(total));
});

const CATEGORIES = ['rent', 'electricity', 'salary', 'transport', 'supplies', 'marketing', 'other'];

/**
 * The fields of an expense, checked: amount above 0, a known category, a real
 * date that isn't in the future (a future expense would count in every report
 * window from today on), note up to 200 characters.
 */
function expenseFields(body: any, creating: boolean) {
    const patch: Record<string, any> = {};
    if (creating || body.category !== undefined) {
        if (!CATEGORIES.includes(body.category)) throw AppError.badRequest(`Category must be one of: ${CATEGORIES.join(', ')}`);
        patch.category = body.category;
    }
    if (creating || body.amount !== undefined) {
        const amount = +Number(body.amount).toFixed(2);
        if (!Number.isFinite(amount) || amount <= 0) throw AppError.badRequest('Amount must be more than 0');
        patch.amount = amount;
    }
    if (body.note !== undefined) {
        patch.note = String(body.note ?? '').trim();
        if (patch.note.length > 200) throw AppError.badRequest('Note can be at most 200 characters');
    }
    if (body.spentAt) {
        const d = new Date(body.spentAt);
        if (Number.isNaN(d.getTime())) throw AppError.badRequest('Invalid date');
        if (d.getTime() > istDaysAgo(-1).getTime()) throw AppError.badRequest('An expense date can not be in the future');
        patch.spentAt = d;
    } else if (creating) patch.spentAt = new Date();
    return patch;
}

export const createExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const expense = await Expense.create({ businessId, ...expenseFields(req.body, true), createdBy: req.user!._id });
    sendCreated(res, expense);
});

export const updateExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const expense = await Expense.findOneAndUpdate({ _id: req.params.id, businessId }, expenseFields(req.body, false), { new: true, runValidators: true });
    if (!expense) throw AppError.notFound('Expense not found');
    sendSuccess(res, expense, 'Expense updated');
});

export const deleteExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const del = await Expense.findOneAndDelete({ _id: req.params.id, businessId });
    if (!del) throw AppError.notFound('Expense not found');
    sendSuccess(res, { ok: true }, 'Expense deleted');
});
