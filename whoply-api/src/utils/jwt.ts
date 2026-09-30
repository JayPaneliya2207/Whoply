/**
 * JWT Utility Functions
 */
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import type { roles } from '../interfaces/index.js';

export interface ITokenPayload {
    _id: string;
    role: roles;
    mobile: string;
    businessId?: string;
}

export const generateToken = ({
    _id,
    role,
    mobile,
    businessId,
}: {
    _id: Types.ObjectId;
    role: roles;
    mobile: string;
    businessId?: Types.ObjectId | string;
}): string => {
    const payload: ITokenPayload = {
        _id: _id.toString(),
        role,
        mobile,
        ...(businessId && { businessId: businessId.toString() }),
    };
    // jwtid: two sign-ins in the same second (double tap, two phones) would
    // otherwise get the same token, and the second session couldn't be saved.
    return jwt.sign(payload, env.JWT_SECRET, {
        jwtid: randomUUID(),
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
};

export const verifyToken = (token: string): ITokenPayload => {
    return jwt.verify(token, env.JWT_SECRET) as ITokenPayload;
};
