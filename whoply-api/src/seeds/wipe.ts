/**
 * Empty every collection in the database — also ones added later (credit notes,
 * estimates, payments, batches, sign-in sessions …). Indexes stay.
 * Used by `seed` and `seed:reset` / `db:clear`.
 *
 * Backs up first (same folder as `npm run backup`; undo with `npm run restore`)
 * unless the database is already empty or RESET_BACKUP=off (the tests set that).
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { backupDatabase, backupFolder } from '../utils/backup.js';

export async function wipeDatabase(): Promise<void> {
    const db = mongoose.connection.db!;
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((c) => c.name)
        .filter((n) => !n.startsWith('system.'));

    let records = 0;
    for (const n of collections) records += await db.collection(n).estimatedDocumentCount();
    if (records && process.env.RESET_BACKUP !== 'off') {
        const dir = backupFolder(env.BACKUP_DIR === 'off' ? '../backups' : env.BACKUP_DIR, db.databaseName)!;
        const { path: saved } = await backupDatabase(db, dir, env.BACKUP_KEEP);
        console.log(`Backed up ${records} records first → ${saved}`);
    }

    for (const n of collections) await db.collection(n).deleteMany({});
    console.log(`Cleared all ${collections.length} collections`);
}
