/**
 * AdminAudit — who changed what in the admin panel. One row per successful
 * write (never a read, never a request body: bodies can hold passwords).
 * Rows remove themselves after 180 days.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../interfaces/index.js';

export interface IAdminAudit {
    adminId: Types.ObjectId;
    adminName: string;
    action: string; // "Marked a bill paid"
    detail: string; // a few safe fields: "status=paid"
    method: string;
    path: string; // /bills/66f…
    ip: string;
}
export interface IAdminAuditDocument extends IAdminAudit, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const adminAuditSchema = new Schema<IAdminAuditDocument>(
    {
        adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        adminName: { type: String, default: '' },
        action: { type: String, required: true },
        detail: { type: String, default: '' },
        method: { type: String, required: true },
        path: { type: String, required: true },
        ip: { type: String, default: '' },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'adminaudits' }
);
adminAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const AdminAudit: Model<IAdminAuditDocument> = mongoose.models.AdminAudit || mongoose.model<IAdminAuditDocument>('AdminAudit', adminAuditSchema);
export default AdminAudit;

/** Plain-words name for a write, from its method and path (ids shown as :id). */
const ACTIONS: [string, RegExp, string][] = [
    ['POST', /^\/businesses$/, 'Created a business'],
    ['PATCH', /^\/businesses\/:id$/, 'Changed a business'],
    ['DELETE', /^\/businesses\/:id$/, 'Suspended a business'],
    ['POST', /^\/users$/, 'Added a user'],
    ['PATCH', /^\/users\/:id$/, 'Changed a user'],
    ['DELETE', /^\/users\/:id$/, 'Deleted a user'],
    ['POST', /^\/plans$/, 'Created a plan'],
    ['PATCH', /^\/plans\/:id$/, 'Changed a plan'],
    ['DELETE', /^\/plans\/:id$/, 'Deleted a plan'],
    ['PUT', /^\/settings$/, 'Changed platform settings'],
    ['POST', /^\/bills$/, 'Created a subscription bill'],
    ['POST', /^\/bills\/run$/, 'Billed every business'],
    ['POST', /^\/bills\/:id\/remind$/, 'Sent a bill reminder'],
    ['PATCH', /^\/bills\/:id$/, 'Updated a subscription bill'],
    ['PATCH', /^\/support\/threads\/:id$/, 'Changed a support chat status'],
    ['PATCH', /^\/inquiries\/:id$/, 'Updated an inquiry'],
    ['DELETE', /^\/inquiries\/:id$/, 'Deleted an inquiry'],
    ['POST', /^\/admins$/, 'Added an admin login'],
    ['PATCH', /^\/admins\/:id$/, 'Changed an admin login'],
    ['DELETE', /^\/admins\/:id$/, 'Deleted an admin login'],
];
/** Body fields that are safe and useful to keep. Never passwords, messages or settings values. */
const SAFE_FIELDS = ['name', 'role', 'adminRole', 'status', 'plan', 'isActive', 'type', 'paidMode'];

/**
 * Express middleware for the admin router: after a write succeeds, record it.
 * Chat messages are not recorded (they are their own record, and frequent).
 */
export function auditAdminWrites(req: AuthRequest, res: Response, next: NextFunction): void {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    res.on('finish', () => {
        if (res.statusCode >= 400 || !req.user) return;
        const path = req.originalUrl.split('?')[0].replace(/^\/api\/admin/, '');
        const shape = path.replace(/\/[0-9a-f]{24}(?=\/|$)/g, '/:id');
        if (/^\/support\/threads(\/:id\/messages)?$/.test(shape) && req.method === 'POST') return;
        const action = ACTIONS.find(([m, re]) => m === req.method && re.test(shape))?.[2] || `${req.method} ${shape}`;
        const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
        const detail = SAFE_FIELDS.filter((k) => ['string', 'number', 'boolean'].includes(typeof body[k])).map((k) => `${k}=${String(body[k]).slice(0, 60)}`).join(', ');
        void AdminAudit.create({ adminId: req.user._id, adminName: req.user.name, action, detail, method: req.method, path, ip: req.ip || '' }).catch(() => { /* the log must never break the request */ });
    });
    next();
}
