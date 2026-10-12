/**
 * AdminUser — a login of the platform's admin panel. Kept in its own
 * collection (`adminusers`), apart from the `users` of shops and wholesalers:
 * it holds only what an admin signs in with, an admin can never sign in to a
 * shop's app, and a shop login can never become an admin.
 *
 * Signs in with mobile + password (POST /auth/admin-login), and — when the
 * admin has turned it on — a code from an authenticator app
 * (services/twoStep.service.ts). No OTP sign-in.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ADMIN_ROLE_KEYS, type AdminRole } from '../utils/adminAccess.js';

export interface IAdminUser {
    name: string;
    mobile: string;
    countryCode: string;
    email?: string;
    password?: string;
    adminRole: AdminRole; // what this admin may do (utils/adminAccess.ts)
    isActive: boolean;
    lastLogin?: Date;
    // sign-in guessing limits (utils/loginGuard.ts)
    loginFails?: number;
    loginFailAt?: Date;
    lockedUntil?: Date;
    // two-step sign-in (services/twoStep.service.ts)
    twoFactor?: {
        on?: boolean;
        secret?: string; // sealed (utils/totp.ts)
        pending?: string; // a setup that was started and not confirmed yet, sealed
        lastStep?: number; // the time step of the last code used — a code works once
        recovery?: string[]; // hashes of the one-time recovery codes not used yet
        since?: Date;
    };
}

export interface IAdminUserDocument extends IAdminUser, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}

const adminUserSchema = new Schema<IAdminUserDocument>(
    {
        name: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, unique: true, index: true },
        countryCode: { type: String, default: '+91' },
        email: { type: String, lowercase: true, trim: true },
        password: { type: String, select: false },
        adminRole: { type: String, enum: ADMIN_ROLE_KEYS, default: 'super' },
        isActive: { type: Boolean, default: true, index: true },
        lastLogin: Date,
        loginFails: { type: Number, select: false },
        loginFailAt: { type: Date, select: false },
        lockedUntil: { type: Date, select: false },
        twoFactor: {
            on: Boolean,
            secret: { type: String, select: false },
            pending: { type: String, select: false },
            lastStep: { type: Number, select: false },
            recovery: { type: [String], select: false, default: undefined },
            since: Date,
        },
    },
    { timestamps: true, collection: 'adminusers' }
);

adminUserSchema.pre('save', async function () {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

adminUserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidate, this.password);
};

const AdminUser: Model<IAdminUserDocument> = mongoose.models.AdminUser || mongoose.model<IAdminUserDocument>('AdminUser', adminUserSchema);

export default AdminUser;

/**
 * Admin logins used to be rows of `users` with role "admin". This moves each
 * one to `adminusers`, keeping its id — so its sessions, its two-step setup and
 * its lines in the activity log stay valid — and removes it from `users`.
 *
 * Safe to run again and again, and from several API processes at once: it
 * runs at every start of the API and in `npm run migrate`. A password is
 * copied as the hash it already is (never hashed twice).
 */
export async function moveAdminsToOwnCollection(): Promise<number> {
    const users = mongoose.connection.collection('users');
    const admins = mongoose.connection.collection('adminusers');
    let moved = 0;
    for await (const u of users.find({ role: 'admin' })) {
        const row: Record<string, unknown> = {
            name: u.name || 'Admin',
            mobile: u.mobile,
            countryCode: u.countryCode || '+91',
            adminRole: (ADMIN_ROLE_KEYS as readonly string[]).includes(u.adminRole) ? u.adminRole : 'super',
            isActive: u.isActive !== false,
            createdAt: u.createdAt || new Date(),
            updatedAt: u.updatedAt || new Date(),
        };
        for (const key of ['email', 'password', 'lastLogin', 'loginFails', 'loginFailAt', 'lockedUntil', 'twoFactor']) if (u[key] !== undefined && u[key] !== null) row[key] = u[key];
        try {
            await admins.updateOne({ _id: u._id }, { $setOnInsert: row }, { upsert: true });
        } catch (e: any) {
            // 11000: another process moved it this very moment, or an admin with this mobile was already made in the new collection.
            if (e?.code !== 11000) throw e;
        }
        // Out of `users` either way: a shop's app must never sign an admin in.
        await users.deleteOne({ _id: u._id, role: 'admin' });
        moved++;
    }
    return moved;
}
