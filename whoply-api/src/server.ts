import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { connectDB } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { initializeCronJobs } from './cron/index.js';
import { jsonBody, rejectOperators, rateLimit } from './middleware/security.middleware.js';

export const app: Express = express();

// Behind a proxy, req.ip must be the visitor's address (sign-in limits count per address).
const trust = env.TRUST_PROXY;
if (trust) app.set('trust proxy', /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust === 'false' ? false : trust);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginEmbedderPolicy: false }));
// In production, only the known Whoply front-ends may call the API. Extra
// origins can be added via CORS_ORIGINS (comma-separated). Dev stays open.
const corsAllowlist = [env.APP_URL, env.ADMIN_URL, env.FRONT_URL, ...(process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [])];
app.use(cors({ origin: env.NODE_ENV === 'production' ? corsAllowlist : '*' }));

// Health check — also says whether the database answers, so a monitor (or Docker) sees a dead database.
app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({
        success: db,
        message: db ? 'Whoply API is running' : 'The database is not connected',
        database: db ? 'connected' : 'down',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
    });
});

// Request guards (middleware/security.middleware.ts): per-address limits, small bodies, no operator keys.
app.use('/api', rateLimit({ max: env.RATE_LIMIT_PER_MIN }));
app.use('/api/public', rateLimit({ max: Math.min(120, env.RATE_LIMIT_PER_MIN) })); // no login needed, so a tighter limit
app.use('/api/auth', rateLimit({ max: Math.min(100, env.RATE_LIMIT_PER_MIN) })); // on top of the sign-in guesses guard (utils/loginGuard.ts)
app.use(jsonBody);
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(rejectOperators);

// Routes
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public/index.js';
import shopkeeperRoutes from './routes/shopkeeper/index.js';
import wholesalerRoutes from './routes/wholesaler/index.js';
import adminRoutes from './routes/admin/index.js';
import staffRoutes from './routes/staff.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import supportRoutes from './routes/support.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/shopkeeper', shopkeeperRoutes);
app.use('/api/wholesaler', wholesalerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/support', supportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

let server: Server | undefined;

/** Stop taking new requests, let open ones finish, close the database, exit. Forced after 10 s. */
function shutdown(reason: string, exitCode = 0): void {
    console.log(`[shutdown] ${reason}`);
    const finish = () => { void mongoose.connection.close().catch(() => {}).finally(() => process.exit(exitCode)); };
    if (server) server.close(finish); else finish();
    setTimeout(() => process.exit(exitCode || 1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM')); // docker stop / a deploy
process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
// A bug that escaped every handler: log it. A rejected promise doesn't stop the server;
// an uncaught exception leaves it in an unknown state, so it restarts (Docker brings it back).
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err); shutdown('uncaughtException', 1); });

const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        initializeCronJobs();
        if (env.NODE_ENV === 'production' && !env.TRUST_PROXY) console.warn('[security] TRUST_PROXY is not set: behind a proxy every visitor shares one address for the request limits. Set TRUST_PROXY=1.');
        server = app.listen(env.PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     Whoply API Server                     ║
╠═══════════════════════════════════════════════════════════╣
║  Status:       Running                                    ║
║  Environment:  ${env.NODE_ENV.padEnd(43)}║
║  Port:         ${String(env.PORT).padEnd(43)}║
║  App URL:      ${env.APP_URL.padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
      `);
        });
        // A slow or stuck client can't hold a connection open for ever.
        server.requestTimeout = 60_000;
        server.headersTimeout = 65_000;
        server.keepAliveTimeout = 65_000; // longer than the proxy's, so the proxy closes idle connections first
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
