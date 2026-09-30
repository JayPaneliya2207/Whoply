/**
 * Restore a backup made by `npm run backup` (or the API's daily backup).
 *
 *   npm run restore                                   list the backups of this database
 *   npm run restore -- whoply-2026-09-30_0215         restore into MONGODB_URI (must be empty)
 *   npm run restore -- whoply-2026-09-30_0215 --drop  replace the data in MONGODB_URI
 *   npm run restore -- <folder> --into mongodb://localhost:27017/whoply_check
 *
 * The backup can be named (looked up in BACKUP_DIR/<database>) or given as a
 * folder path. With --drop on the live database, the current data is backed up
 * first, so a wrong restore can itself be undone.
 * On a server, after `npm run build`: npm run restore:prod -- …
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { backupDatabase, backupFolder, listBackups, restoreDatabase, type Manifest } from '../utils/backup.js';

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const valueOf = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const which = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--into');

async function main() {
    const root = env.BACKUP_DIR === 'off' ? '../backups' : env.BACKUP_DIR;
    const liveName = new mongoose.mongo.MongoClient(env.MONGODB_URI).db().databaseName; // parses only, no connection
    const ownDir = backupFolder(root, liveName)!;

    if (!which) {
        const list = listBackups(ownDir);
        console.log(list.length ? `Backups of "${liveName}" in ${ownDir}:` : `No backups of "${liveName}" in ${ownDir} yet.`);
        for (const b of list.reverse()) {
            const m: Manifest = JSON.parse(fs.readFileSync(path.join(b.path, 'manifest.json'), 'utf8'));
            const records = Object.values(m.collections).reduce((a, c) => a + c.count, 0);
            console.log(`  ${b.name}   ${records} records`);
        }
        if (list.length) console.log('\nRestore one:  npm run restore -- <name> [--drop] [--into <mongodb uri>]');
        return;
    }

    const folder = fs.existsSync(which) ? path.resolve(which) : path.join(ownDir, which);
    if (!fs.existsSync(path.join(folder, 'manifest.json'))) throw new Error(`No finished backup at ${folder}`);
    const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
    const target = valueOf('--into') || env.MONGODB_URI;
    const drop = flag('--drop');

    await mongoose.connect(target);
    const db = mongoose.connection.db!;
    const records = Object.values(manifest.collections).reduce((a, c) => a + c.count, 0);
    console.log(`Restoring ${path.basename(folder)} (from "${manifest.database}", ${records} records) into "${db.databaseName}"${drop ? ' — REPLACING its data' : ''}…`);

    if (drop && (await db.listCollections().toArray()).length) {
        const safety = await backupDatabase(db, backupFolder(root, db.databaseName)!, env.BACKUP_KEEP + 1);
        console.log(`   First saved the current data: ${safety.path}`);
    }
    const restored = await restoreDatabase(db, folder, { drop });
    console.log(`✅ Restored ${Object.keys(restored).length} collections, ${Object.values(restored).reduce((a, b) => a + b, 0)} records — counts match the backup.`);
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error('❌ Restore failed:', e?.message || e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
