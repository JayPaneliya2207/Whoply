/**
 * PlatformSettings — one document ('main') the platform admin edits on the
 * admin Settings page: who issues subscription bills (company), how they are
 * billed and collected, when owners are reminded, and how to reach support.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export const DEFAULT_BILL_TEMPLATE =
    'Hello {owner}, your Whoply {plan} plan bill {billNo} for {business} is ₹{amount} ({period}). Please pay by {dueDate}. Thank you!';
export const DEFAULT_REMINDER_TEMPLATE =
    'Reminder: Whoply bill {billNo} of ₹{amount} for {business} is due on {dueDate}. Please pay to keep your {plan} plan active.';

export interface IPlatformSettings {
    key: string; // always 'main'
    company: { name: string; address: string; gstin: string; email: string; phone: string };
    billing: {
        gstRate: number; // % added to bills — only when company.gstin is filled
        dueDays: number; // days from bill date to due date
        upiId: string;
        bank: { name: string; holder: string; account: string; ifsc: string };
        autoBill: boolean; // daily job bills every paid-plan business whose period ran out
        remindDaysBefore: number; // in-app reminder this many days before the due date
        remindOverdueEvery: number; // …and every N days once overdue
    };
    support: { whatsapp: string; email: string; hours: string };
    templates: { bill: string; reminder: string };
}
export interface IPlatformSettingsDocument extends IPlatformSettings, Document {
    _id: Types.ObjectId;
    updatedAt: Date;
}

const s = (def = '') => ({ type: String, default: def, trim: true });

const platformSettingsSchema = new Schema<IPlatformSettingsDocument>(
    {
        key: { type: String, required: true, unique: true, default: 'main' },
        company: { name: s('Whoply'), address: s(), gstin: { ...s(), uppercase: true }, email: s(), phone: s() },
        billing: {
            gstRate: { type: Number, default: 18, min: 0, max: 28 },
            dueDays: { type: Number, default: 7, min: 0, max: 60 },
            upiId: s(),
            bank: { name: s(), holder: s(), account: s(), ifsc: { ...s(), uppercase: true } },
            autoBill: { type: Boolean, default: false },
            remindDaysBefore: { type: Number, default: 3, min: 0, max: 30 },
            remindOverdueEvery: { type: Number, default: 3, min: 1, max: 30 },
        },
        support: { whatsapp: s(), email: s(), hours: s() },
        templates: { bill: s(DEFAULT_BILL_TEMPLATE), reminder: s(DEFAULT_REMINDER_TEMPLATE) },
    },
    { timestamps: true, collection: 'platformsettings', minimize: false }
);

const PlatformSettings: Model<IPlatformSettingsDocument> =
    mongoose.models.PlatformSettings || mongoose.model<IPlatformSettingsDocument>('PlatformSettings', platformSettingsSchema);

/** The settings document, created with defaults the first time it is asked for. */
export async function getPlatformSettings(): Promise<IPlatformSettings> {
    const doc = await PlatformSettings.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    return doc as unknown as IPlatformSettings;
}

export default PlatformSettings;
