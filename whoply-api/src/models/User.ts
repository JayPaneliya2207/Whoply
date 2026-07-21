/**
 * User — a person who logs into Whoply. Belongs to a Business and carries a role.
 * Auth supports both OTP and password login (like 1socio).
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { roles } from '../interfaces/index.js';

export interface IUser {
    name: string;
    mobile: string;
    email?: string;
    password?: string;
    role: roles;
    businessId?: Types.ObjectId;
    language: string;
    otp?: string;
    otpExpiry?: Date;
    avatar?: string;
    isActive: boolean;
    lastLogin?: Date;
    // staff fields
    salary?: number;
    kyc?: {
        docType?: 'aadhaar' | 'pan' | 'voterid' | 'driving' | 'other';
        docNumber?: string;
        verified?: boolean;
    };
}

export interface IUserDocument extends IUser, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
    {
        name: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, unique: true, index: true },
        email: { type: String, lowercase: true, trim: true, sparse: true },
        password: { type: String, select: false },
        role: {
            type: String,
            enum: ['owner', 'manager', 'cashier', 'warehouse', 'salesStaff', 'accountant', 'admin'],
            required: true,
            index: true,
        },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
        language: { type: String, default: 'en' },
        otp: { type: String, select: false },
        otpExpiry: { type: Date, select: false },
        avatar: String,
        isActive: { type: Boolean, default: true, index: true },
        lastLogin: Date,
        salary: { type: Number, default: 0 },
        kyc: {
            docType: { type: String, enum: ['aadhaar', 'pan', 'voterid', 'driving', 'other'] },
            docNumber: String,
            verified: { type: Boolean, default: false },
        },
    },
    { timestamps: true, collection: 'users' }
);

userSchema.pre('save', async function () {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidate, this.password);
};

const User: Model<IUserDocument> = mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);

export default User;
