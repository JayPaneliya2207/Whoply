/**
 * Back up the database now (the API also does it by itself once a day).
 *
 *   npm run backup              (on a server, after `npm run build`: npm run backup:prod)
 *
 * Saves to BACKUP_DIR/<database>/whoply-YYYY-MM-DD_HHmm (default ../backups, i.e.
 * next to the API folder) and keeps the newest BACKUP_KEEP (default 7).
 * Copy that folder somewhere else too — a backup on the same disk as the
 * database doesn't survive the disk.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { backupDatabase, backupFolder, listBackups } from '../utils/backup.js';

async function main() {
    await mongoose.connect(env.MONGODB_URI);
    const db = mongoose.connection.db!;
    // BACKUP_DIR=off only stops the automatic backup; asking by hand still saves to the default folder.
    const dir = backupFolder(env.BACKUP_DIR === 'off' ? '../backups' : env.BACKUP_DIR, db.databaseName)!;
    const started = Date.now();
    const { path: saved, manifest } = await backupDatabase(db, dir, env.BACKUP_KEEP);
    const records = Object.values(manifest.collections).reduce((a, c) => a + c.count, 0);
    console.log(`✅ Backed up "${db.databaseName}": ${Object.keys(manifest.collections).length} collections, ${records} records in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    console.log(`   → ${saved}`);
    console.log(`   Backups kept here (newest ${env.BACKUP_KEEP}): ${listBackups(dir).map((b) => b.name).join(', ')}`);
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error('❌ Backup failed:', e?.message || e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
