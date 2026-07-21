import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type ExpenseCategory =
    | 'rent'
    | 'electricity'
    | 'salary'
    | 'transport'
    | 'supplies'
    | 'marketing'
    | 'other';

export interface IExpense {
    businessId: Types.ObjectId;
    category: ExpenseCategory;
    amount: number;
    note?: string;
    spentAt: Date;
    createdBy?: Types.ObjectId;
}
export interface IExpenseDocument extends IExpense, Document {
    _id: Types.ObjectId;
}

const expenseSchema = new Schema<IExpenseDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        category: {
            type: String,
            enum: ['rent', 'electricity', 'salary', 'transport', 'supplies', 'marketing', 'other'],
            required: true,
        },
        amount: { type: Number, required: true },
        note: String,
        spentAt: { type: Date, default: Date.now, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'expenses' }
);

const Expense: Model<IExpenseDocument> =
    mongoose.models.Expense || mongoose.model<IExpenseDocument>('Expense', expenseSchema);
export default Expense;
