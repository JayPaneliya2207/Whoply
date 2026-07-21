/**
 * Error Handling Middleware
 */
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

function parseDuplicateKeyError(err: any): string {
    const keyPattern = err.keyPattern || {};
    const keyValue = err.keyValue || {};
    const keyNames = Object.keys(keyPattern);

    const fieldMessages: Record<string, string> = {
        mobile: 'A user with this mobile number already exists',
        email: 'A user with this email already exists',
        gstin: 'A business with this GSTIN already exists',
        sku: 'A product with this SKU already exists',
    };

    if (keyNames.length === 1) {
        const field = keyNames[0];
        return fieldMessages[field] || `A record with this ${field} already exists`;
    }
    if (keyNames.length > 1) {
        const fields = keyNames.join(', ');
        const values = keyNames.map((f) => `${f}: ${keyValue[f] ?? '(empty)'}`).join(', ');
        return `Duplicate entry: a record with ${fields} (${values}) already exists`;
    }
    return 'Duplicate entry detected';
}

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
    next(new AppError(`Cannot ${req.method} ${req.path}`, 404, 'NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (
    err: Error | AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let code = 'INTERNAL_ERROR';

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        code = err.code;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
        code = 'VALIDATION_ERROR';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
        code = 'INVALID_ID';
    } else if ((err as any).code === 11000) {
        statusCode = 409;
        message = parseDuplicateKeyError(err as any);
        code = 'DUPLICATE_ENTRY';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
    }

    if (env.NODE_ENV === 'development') {
        console.error('Error:', { message: err.message, statusCode, code });
    }

    res.status(statusCode).json({
        success: false,
        error: { message, code, ...(env.NODE_ENV === 'development' && { stack: err.stack }) },
    });
};
