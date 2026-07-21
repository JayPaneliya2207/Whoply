import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Expense from '../../models/Expense.js';
import type { AuthRequest } from '../../interfaces/index.js';

export const listExpenses = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const [items, total] = await Promise.all([
        Expense.find({ businessId }).sort({ spentAt: -1 }).skip(skip).limit(limit).lean(),
        Expense.countDocuments({ businessId }),
    ]);
    sendPaginated(res, items, meta(total));
});

export const createExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { category, amount } = req.body;
    if (!category || !amount) throw AppError.badRequest('category and amount are required');
    const expense = await Expense.create({
        businessId,
        category,
        amount: Number(amount),
        note: req.body.note,
        spentAt: req.body.spentAt ? new Date(req.body.spentAt) : new Date(),
        createdBy: req.user!._id,
    });
    sendCreated(res, expense);
});

export const updateExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = {};
    if (req.body.category) patch.category = req.body.category;
    if (req.body.amount != null) patch.amount = Number(req.body.amount);
    if (req.body.note != null) patch.note = req.body.note;
    if (req.body.spentAt) patch.spentAt = new Date(req.body.spentAt);
    const expense = await Expense.findOneAndUpdate({ _id: req.params.id, businessId }, patch, { new: true });
    if (!expense) throw AppError.notFound('Expense not found');
    sendSuccess(res, expense, 'Expense updated');
});

export const deleteExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const del = await Expense.findOneAndDelete({ _id: req.params.id, businessId });
    if (!del) throw AppError.notFound('Expense not found');
    sendSuccess(res, { ok: true }, 'Expense deleted');
});
