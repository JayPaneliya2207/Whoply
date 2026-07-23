import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { initializeCronJobs } from './cron/index.js';

export const app: Express = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginEmbedderPolicy: false }));
// In production, only the known Whoply front-ends may call the API. Extra
// origins can be added via CORS_ORIGINS (comma-separated). Dev stays open.
const corsAllowlist = [env.APP_URL, env.ADMIN_URL, env.FRONT_URL, ...(process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [])];
app.use(cors({ origin: env.NODE_ENV === 'production' ? corsAllowlist : '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        message: 'Whoply API is running',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
    });
});

// Routes
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public/index.js';
import shopkeeperRoutes from './routes/shopkeeper/index.js';
import wholesalerRoutes from './routes/wholesaler/index.js';
import adminRoutes from './routes/admin/index.js';
import staffRoutes from './routes/staff.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/shopkeeper', shopkeeperRoutes);
app.use('/api/wholesaler', wholesalerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        initializeCronJobs();
        app.listen(env.PORT, () => {
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
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
