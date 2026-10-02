import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * No query may run for ever: past DB_QUERY_TIMEOUT_MS MongoDB stops it and the
 * request fails with "busy, try again" instead of piling up behind it. Applied
 * to every model (this file is imported before any model is defined).
 */
mongoose.plugin((schema) => {
    const QUERIES = ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments', 'distinct', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'] as const;
    schema.pre(QUERIES as any, function (this: mongoose.Query<unknown, unknown>) {
        if (this.getOptions().maxTimeMS == null) this.maxTimeMS(env.DB_QUERY_TIMEOUT_MS);
    });
    schema.pre('aggregate', function (this: mongoose.Aggregate<unknown>) {
        if ((this.options as any).maxTimeMS == null) this.option({ maxTimeMS: env.DB_QUERY_TIMEOUT_MS });
    });
});

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(env.MONGODB_URI, {
            maxPoolSize: env.DB_POOL_SIZE, // requests beyond this wait for a free connection instead of opening more
            minPoolSize: Math.min(2, env.DB_POOL_SIZE),
            serverSelectionTimeoutMS: 10_000, // database unreachable → fail the request in 10 s, not 30
            socketTimeoutMS: 45_000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
});
