/**
 * Response Helper Functions
 */

import type { Response } from 'express';
import type { IApiResponse, IPaginatedResponse, IPaginationMeta } from '../interfaces/index.js';

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode = 200): Response => {
    const response: IApiResponse<T> = { success: true, data, ...(message && { message }) };
    return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created successfully'): Response => {
    return sendSuccess(res, data, message, 201);
};

export const sendPaginated = <T>(res: Response, items: T[], meta: IPaginationMeta): Response => {
    const response: IPaginatedResponse<T> = { success: true, data: { items, meta } };
    return res.status(200).json(response);
};

export const sendNoContent = (res: Response): Response => res.status(204).send();

export const sendError = (res: Response, message: string, statusCode = 500, code?: string): Response => {
    return res.status(statusCode).json({ success: false, error: { message, ...(code && { code }) } });
};
