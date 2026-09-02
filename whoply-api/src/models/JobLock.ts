/**
 * JobLock — a lease so a scheduled job runs on exactly ONE API instance.
 *
 * The cron used to run in-process on every instance, so scaling the API to 2+
 * pods meant every business got its notifications (and, once WhatsApp is live,
 * its customer messages) duplicated per instance. Acquiring this lease makes the
 * job single-runner; the TTL means a crashed holder can't block it forever.
 */
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IJobLock {
    key: string;
    lockedAt: Date;
    expiresAt: Date;
}
export interface IJobLockDocument extends IJobLock, Document {}

const jobLockSchema = new Schema<IJobLockDocument>(
    {
        key: { type: String, required: true, unique: true },
        lockedAt: { type: Date, required: true },
        // TTL sweeper: rows self-delete an hour after the lease ends.
        expiresAt: { type: Date, required: true, index: { expires: 3600 } },
    },
    { collection: 'job_locks' }
);

const JobLock: Model<IJobLockDocument> =
    mongoose.models.JobLock || mongoose.model<IJobLockDocument>('JobLock', jobLockSchema);
export default JobLock;

/**
 * Run `fn` only if this instance wins the lease for `key`.
 * Returns the fn's result, or null when another instance already holds it.
 */
export async function withJobLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    try {
        // Matches only when no live lease exists. If one does, the filter misses and
        // the upsert attempts an insert, which the unique index rejects (E11000).
        await JobLock.findOneAndUpdate(
            { key, expiresAt: { $lte: now } },
            { $set: { key, lockedAt: now, expiresAt } },
            { upsert: true, new: true }
        );
    } catch (err: any) {
        if (err?.code === 11000) return null; // another instance is running it
        throw err;
    }
    try {
        return await fn();
    } finally {
        // Release early so the next scheduled run isn't blocked by the TTL.
        await JobLock.updateOne({ key }, { $set: { expiresAt: new Date(0) } }).catch(() => {});
    }
}
