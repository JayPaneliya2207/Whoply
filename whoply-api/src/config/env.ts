import { z } from 'zod';

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(7000),

    // Database
    MONGODB_URI: z.string().default('mongodb://localhost:27017/whoply'),

    // JWT
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // App
    APP_NAME: z.string().default('Whoply'),
    ADMIN_URL: z.string().url().default('http://localhost:7300'),
    APP_URL: z.string().url().default('http://localhost:7200'),
    FRONT_URL: z.string().url().default('http://localhost:7100'),
    // Extra CORS origins (comma-separated) allowed in production, on top of the URLs above
    CORS_ORIGINS: z.string().optional(),
    // Behind a reverse proxy (nginx, a load balancer…): how many proxies to trust for the
    // visitor's address — usually 1. Unset = use the direct connection's address.
    TRUST_PROXY: z.string().optional(),
    // Most requests one network address may make in a minute (0 = no limit). Public and
    // sign-in routes have their own, lower limits on top (server.ts).
    RATE_LIMIT_PER_MIN: z.coerce.number().int().min(0).default(1500),

    // Database: connections kept open to MongoDB, and the longest one query may run.
    DB_POOL_SIZE: z.coerce.number().int().min(1).max(500).default(20),
    DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),

    // Backups (utils/backup.ts): folder for the automatic daily backup, relative to the API
    // folder ("off" = no automatic backup), and how many to keep per database.
    BACKUP_DIR: z.string().default('../backups'),
    BACKUP_KEEP: z.coerce.number().int().min(1).default(7),

    // Cloudinary (optional)
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
});

const parseEnv = () => {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.flatten().fieldErrors);
        process.exit(1);
    }

    return result.data;
};

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
