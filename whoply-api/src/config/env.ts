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
