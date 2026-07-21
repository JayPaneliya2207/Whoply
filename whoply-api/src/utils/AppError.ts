/**
 * Custom Application Error Class
 */

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message = 'Bad request'): AppError {
        return new AppError(message, 400, 'BAD_REQUEST');
    }
    static unauthorized(message = 'Unauthorized'): AppError {
        return new AppError(message, 401, 'UNAUTHORIZED');
    }
    static forbidden(message = 'Forbidden'): AppError {
        return new AppError(message, 403, 'FORBIDDEN');
    }
    static notFound(message = 'Not found'): AppError {
        return new AppError(message, 404, 'NOT_FOUND');
    }
    static conflict(message = 'Conflict'): AppError {
        return new AppError(message, 409, 'CONFLICT');
    }
    static unprocessable(message = 'Unprocessable entity'): AppError {
        return new AppError(message, 422, 'UNPROCESSABLE_ENTITY');
    }
    static tooManyRequests(message = 'Too many requests'): AppError {
        return new AppError(message, 429, 'TOO_MANY_REQUESTS');
    }
    static internal(message = 'Internal server error'): AppError {
        return new AppError(message, 500, 'INTERNAL_ERROR');
    }
    static validation(error: unknown): AppError {
        const zodErr = error as { issues: Array<{ path: (string | number)[]; message: string }> };
        const issues = zodErr.issues
            .map((i) => {
                const path = i.path && i.path.length ? i.path.join('.') : 'body';
                return `${path}: ${i.message}`;
            })
            .join('; ');
        return new AppError(issues, 400, 'VALIDATION_ERROR');
    }
}
