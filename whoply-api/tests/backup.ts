/**
 * Backup and restore (src/utils/backup.ts, npm run backup / restore):
 * a full demo database plus awkward values survives a round trip exactly,
 * restore refuses to overwrite data unless --drop, old backups are pruned.
 * Needs MongoDB (MONGODB_URI's server), not the API. Uses two throwaway
 * databases and a temp folder, and removes them afterwards.
 *
 *   npx tsx tests/backup.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import mongoose from 'mongoose';
import { backupDatabase, listBackups, pruneBackups, restoreDatabase, backupFolder } from '../src/utils/backup.js';

const { EJSON, ObjectId, Decimal128, Long, Int32, Binary } = mongoose.mongo.BSON;
const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: unknown, detail = '') => results.push({ name, pass: !!cond, detail: String(detail).slice(0, 300) });

const server = (process.env.MONGODB_URI || 'mongodb://localhost:27017/whoply').replace(/\/[^/]*$/, '').replace(/\/$/, '');
const SRC = `${server}/whoply_backup_src_test`;
const DST = `${server}/whoply_backup_dst_test`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whoply-backup-test-'));
const run = (script: string, args: string[], env: Record<string, string>) =>
    execFileSync(process.execPath, ['--import', 'tsx', script, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'pipe' });

/** Every record of every collection, as exact Extended JSON, sorted — for comparing two databases. */
async function snapshot(db: mongoose.mongo.Db) {
    const out: Record<string, { docs: string[]; indexes: string[] }> = {};
    for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
        if (name.startsWith('system.')) continue;
        const docs = (await db.collection(name).find({}).toArray()).map((d) => EJSON.stringify(d, { relaxed: false })).sort();
        const indexes = (await db.collection(name).listIndexes().toArray()).map((ix) => JSON.stringify({ n: ix.name, k: ix.key, u: !!ix.unique, s: !!ix.sparse, ttl: ix.expireAfterSeconds ?? null })).sort();
        out[name] = { docs, indexes };
    }
    return out;
}

(async () => {
    try {
        // ── A realistic database: the full demo seed, plus awkward values ──
        run('src/seeds/seed.ts', [], { MONGODB_URI: SRC });
        const src = mongoose.createConnection(SRC);
        await src.asPromise();
        const odd = src.db!.collection('backup_types');
        await odd.insertMany([
            { _id: new ObjectId(), when: new Date('2026-03-31T18:30:00.000Z'), money: Decimal128.fromString('12345.67'), big: Long.fromString('9007199254740993'), small: new Int32(7), float: 0.1 + 0.2, neg: -0, text: 'ગુજરાતી हिंदी ₹ "quotes" \\ back\nslash', nested: { a: [1, [2, { b: null }]], empty: {} }, bin: new Binary(Buffer.from([0, 1, 2, 255])) },
            { _id: 'string-id', missing: undefined, arr: [], nul: null },
            { _id: 42, huge: 'x'.repeat(200_000) },
        ]);
        await odd.createIndex({ when: 1 }, { name: 'when_ttl', expireAfterSeconds: 10 * 365 * 86400 });
        await odd.createIndex({ small: 1, text: 1 }, { unique: true, sparse: true, name: 'small_text_unique' });

        // ── Back up ──
        const dir = backupFolder(tmp, src.db!.databaseName)!;
        const t0 = Date.now();
        const { path: saved, manifest } = await backupDatabase(src.db!, dir, 7);
        const before = await snapshot(src.db!);
        check('backup folder is named whoply-YYYY-MM-DD_HHmm, inside a folder per database', /whoply_backup_src_test[\\/]whoply-\d{4}-\d{2}-\d{2}_\d{4}$/.test(saved), saved);
        check('no half-finished (.partial) folder left', !fs.readdirSync(dir).some((n) => n.endsWith('.partial')), fs.readdirSync(dir).join(','));
        check('manifest counts match the database', Object.entries(before).every(([n, s]) => manifest.collections[n]?.count === s.docs.length), JSON.stringify(Object.fromEntries(Object.entries(manifest.collections).map(([n, c]) => [n, c.count]))));
        const total = Object.values(manifest.collections).reduce((a, c) => a + c.count, 0);
        check(`full demo database backed up (${Object.keys(manifest.collections).length} collections, ${total} records, ${((Date.now() - t0) / 1000).toFixed(1)} s)`, Object.keys(manifest.collections).length >= 15 && total > 300, `${total}`);

        // ── Restore into an empty database and compare everything ──
        const dst = mongoose.createConnection(DST);
        await dst.asPromise();
        await dst.db!.dropDatabase();
        await restoreDatabase(dst.db!, saved);
        const after = await snapshot(dst.db!);
        const diff = Object.keys(before).filter((n) => JSON.stringify(before[n].docs) !== JSON.stringify(after[n]?.docs));
        check('every record comes back exactly (types, decimals, dates, text)', !diff.length && Object.keys(after).length === Object.keys(before).length, diff.join(', '));
        const ixDiff = Object.keys(before).filter((n) => JSON.stringify(before[n].indexes) !== JSON.stringify(after[n]?.indexes));
        check('every index comes back (unique, sparse, TTL)', !ixDiff.length, ixDiff.map((n) => `${n}: ${before[n].indexes} vs ${after[n]?.indexes}`).join(' | '));
        const back = await dst.db!.collection('backup_types').findOne({ _id: 42 as any });
        check('a 200 KB record survives', back?.huge?.length === 200_000);

        // ── Safety ──
        let refused = '';
        try { await restoreDatabase(dst.db!, saved); } catch (e: any) { refused = e.message; }
        check('restoring over existing data is refused without --drop', /already has data/.test(refused), refused);
        await dst.db!.collection('products').deleteMany({});
        await dst.db!.collection('extra_after_backup').insertOne({ keep: 'me' });
        await restoreDatabase(dst.db!, saved, { drop: true });
        const again = await snapshot(dst.db!);
        check('--drop replaces the data with the backup', JSON.stringify(again.products.docs) === JSON.stringify(before.products.docs));
        check('…and leaves collections the backup does not have alone', again.extra_after_backup?.docs.length === 1);

        // ── Keeping the newest N ──
        fs.writeFileSync(path.join(dir, 'README-not-a-backup.txt'), 'hello');
        fs.mkdirSync(path.join(dir, 'whoply-2000-01-01_0000.partial'));
        for (let i = 0; i < 3; i++) await backupDatabase(src.db!, dir, 2);
        const kept = listBackups(dir);
        check('only the newest 2 kept (keep=2)', kept.length === 2, kept.map((b) => b.name).join(', '));
        check('same-minute backups get -2, -3… instead of overwriting', kept.some((b) => /-\d+$/.test(b.name)), kept.map((b) => b.name).join(', '));
        check('other files in the folder are never deleted', fs.existsSync(path.join(dir, 'README-not-a-backup.txt')));
        check('a .partial folder is not treated as a backup', !kept.some((b) => b.name.includes('2000-01-01')));
        check('pruning again removes nothing more', pruneBackups(dir, 2).length === 0);

        // ── The npm scripts ──
        const out = run('src/seeds/backup.ts', [], { MONGODB_URI: SRC, BACKUP_DIR: tmp, BACKUP_KEEP: '3' });
        check('npm run backup works and reports the counts', /Backed up "whoply_backup_src_test": \d+ collections, \d+ records/.test(out) && listBackups(dir).length === 3, out.split('\n')[0]);
        const list = run('src/seeds/restore.ts', [], { MONGODB_URI: SRC, BACKUP_DIR: tmp });
        check('npm run restore (no name) lists the backups', /Backups of "whoply_backup_src_test"/.test(list) && (list.match(/whoply-\d{4}/g) || []).length === 3, list.split('\n').slice(0, 2).join(' / '));
        const newest = listBackups(dir).at(-1)!.name;
        const res = run('src/seeds/restore.ts', [newest, '--drop', '--into', DST], { MONGODB_URI: SRC, BACKUP_DIR: tmp });
        check('npm run restore -- <name> --drop --into <db> works', /Restored \d+ collections, \d+ records — counts match/.test(res), res.trim().split('\n').at(-1));
        check('…after saving the data it replaced', /First saved the current data/.test(res) && listBackups(backupFolder(tmp, 'whoply_backup_dst_test')!).length === 1, res.split('\n')[1]);

        await src.db!.dropDatabase();
        await dst.db!.dropDatabase();
        await src.close();
        await dst.close();
    } catch (e: any) {
        check('ran without crashing', false, e?.stack || e);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    const fails = results.filter((r) => !r.pass);
    for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ' — got ' + r.detail}`);
    console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})();
