/**
 * Request guards that sit in front of every route:
 *
 * - `jsonBody`     small request bodies by default; only the few routes that
 *                  carry photos may send more.
 * - `rejectOperators`  a request whose JSON has MongoDB operator keys ("$ne",
 *                  "$gt"…) or prototype keys is refused outright — no route
 *                  expects them, and they are how NoSQL injection is attempted.
 * - `rateLimit`    at most N requests a minute from one network address.
 */
import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

/* ───────────── body size ───────────── */

/** Routes that carry photos as data URLs: staff ID photos, the shop's UPI QR, a profile or product picture, an admin's popup poster. */
const PHOTO_ROUTES = /^\/api\/(staff(\/|$)|auth\/profile$|admin\/announcements(\/|$)|(shopkeeper|wholesaler)\/(business$|products(\/|$)))/;
const smallJson = express.json({ limit: '1mb' });
const photoJson = express.json({ limit: '12mb' });

/** A token we signed ourselves (a cheap check, no database): only a signed-in caller may send a big body. */
const signedIn = (req: Request): boolean => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return false;
    try { verifyToken(header.slice(7)); return true; } catch { return false; }
};

// The body is read before any route runs, so without the token check a stranger could make
// the API buffer and parse 12 MB again and again just by naming a photo route.
export const jsonBody: RequestHandler = (req, res, next) => (PHOTO_ROUTES.test(req.path) && signedIn(req) ? photoJson : smallJson)(req, res, next);

/** A request without a JSON body leaves `req.body` undefined; routes read fields from it, so give them an empty one. */
export const ensureBody: RequestHandler = (req, _res, next) => {
    if (req.body === undefined || req.body === null) req.body = {};
    next();
};

/* ───────────── operator / prototype keys ───────────── */

const BAD_KEY = /^\$|^__proto__$|^constructor$|^prototype$/;
const MAX_DEPTH = 12;

function hasBadKey(value: unknown, depth = 0): boolean {
    if (!value || typeof value !== 'object') return false;
    if (depth > MAX_DEPTH) return true; // nothing real nests this deep
    if (Array.isArray(value)) return value.some((v) => hasBadKey(v, depth + 1));
    for (const key of Object.keys(value)) {
        if (BAD_KEY.test(key) || key.includes('\0')) return true;
        if (hasBadKey((value as Record<string, unknown>)[key], depth + 1)) return true;
    }
    return false;
}

export const rejectOperators = (req: Request, _res: Response, next: NextFunction): void => {
    if (hasBadKey(req.body) || hasBadKey(req.query)) return next(new AppError('Invalid request', 400, 'INVALID_REQUEST'));
    next();
};

/* ───────────── rate limit ───────────── */

const isLoopback = (ip?: string) => !ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');
/** Past this many addresses in one window something is wrong — forget them rather than grow without end. */
const MAX_TRACKED = 50_000;

/**
 * Fixed-window limit per network address, kept in memory (one API process;
 * with several, each keeps its own count). Behind a proxy the API must run
 * with TRUST_PROXY so `req.ip` is the visitor's address, not the proxy's.
 * Requests from the server itself (loopback) are not counted.
 */
export function rateLimit({ max, windowMs = 60_000 }: { max: number; windowMs?: number }): RequestHandler {
    const hits = new Map<string, { count: number; resetAt: number }>();
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
    }, windowMs);
    sweep.unref();

    return (req, res, next) => {
        if (max <= 0 || isLoopback(req.ip)) return next();
        const ip = req.ip as string;
        const now = Date.now();
        let h = hits.get(ip);
        if (!h || h.resetAt <= now) {
            if (hits.size >= MAX_TRACKED) hits.clear();
            h = { count: 0, resetAt: now + windowMs };
            hits.set(ip, h);
        }
        h.count++;
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - h.count)));
        if (h.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
            return next(AppError.tooManyRequests('Too many requests — please wait a minute and try again'));
        }
        next();
    };
}
