/**
 * Database backup and restore without extra tools (no mongodump needed).
 *
 * A backup is one folder, `whoply-YYYY-MM-DD_HHmm` (India time), holding a
 * gzipped Extended-JSON file per collection — ObjectIds, dates and decimals
 * survive exactly — plus manifest.json with the record counts and indexes.
 * It is written as `…​.partial` and renamed only when complete, so a crash never
 * leaves a half backup that looks finished. The newest `keep` backups are kept.
 *
 * Restore refuses to write into a database that already has data unless told
 * to drop it, and checks every collection's count afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';

type Db = mongoose.mongo.Db;
const { EJSON } = mongoose.mongo.BSON;

const NAME = /^whoply-\d{4}-\d{2}-\d{2}_\d{4}(-\d+)?$/;
const BATCH = 1000;

export interface Manifest {
    app: 'whoply';
    createdAt: string;
    database: string;
    collections: Record<string, { count: number; indexes: any[] }>;
}

/**
 * Where one database's backups live: <root>/<database name>. Each database has
 * its own folder, so a test database's backups never push out the real ones.
 * `root` is relative to the API folder; "off" (or empty) means none.
 */
export function backupFolder(root: string, database: string): string | null {
    if (!root || root.toLowerCase() === 'off') return null;
    return path.join(path.resolve(root), database);
}

/** Folder name for a moment, in India time: whoply-2026-09-30_0215. */
export function backupName(d = new Date()): string {
    const ist = new Date(d.getTime() + 330 * 60_000).toISOString(); // YYYY-MM-DDTHH:MM…
    return `whoply-${ist.slice(0, 10)}_${ist.slice(11, 13)}${ist.slice(14, 16)}`;
}

/** Finished backups in `dir`, oldest first. */
export function listBackups(dir: string): { name: string; path: string; createdAt: Date }[] {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && NAME.test(e.name) && fs.existsSync(path.join(dir, e.name, 'manifest.json')))
        .map((e) => {
            const p = path.join(dir, e.name);
            const m: Manifest = JSON.parse(fs.readFileSync(path.join(p, 'manifest.json'), 'utf8'));
            return { name: e.name, path: p, createdAt: new Date(m.createdAt) };
        })
        .sort((a, b) => +a.createdAt - +b.createdAt);
}

const userCollections = async (db: Db) =>
    (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((c) => c.name)
        .filter((n) => !n.startsWith('system.'))
        .sort();

/** Back up every collection of `db` into a new folder under `dir`; keeps the newest `keep`. */
export async function backupDatabase(db: Db, dir: string, keep = 7): Promise<{ path: string; manifest: Manifest }> {
    fs.mkdirSync(dir, { recursive: true });
    // A second backup in the same minute gets -2, -3… rather than overwriting.
    const base = backupName();
    let name = base;
    for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base}-${i}`;
    const partial = path.join(dir, `${name}.partial`);
    fs.rmSync(partial, { recursive: true, force: true });
    fs.mkdirSync(partial);

    const manifest: Manifest = { app: 'whoply', createdAt: new Date().toISOString(), database: db.databaseName, collections: {} };
    try {
        for (const coll of await userCollections(db)) {
            const c = db.collection(coll);
            const indexes = (await c.listIndexes().toArray()).filter((ix) => ix.name !== '_id_');
            let count = 0;
            const lines = Readable.from(
                (async function* () {
                    for await (const doc of c.find({}, { sort: { _id: 1 } })) {
                        count++;
                        yield EJSON.stringify(doc, { relaxed: false }) + '\n';
                    }
                })()
            );
            await pipeline(lines, zlib.createGzip(), fs.createWriteStream(path.join(partial, `${coll}.jsonl.gz`)));
            manifest.collections[coll] = { count, indexes };
        }
        fs.writeFileSync(path.join(partial, 'manifest.json'), JSON.stringify(manifest, null, 2));
        fs.renameSync(partial, path.join(dir, name));
    } catch (e) {
        fs.rmSync(partial, { recursive: true, force: true });
        throw e;
    }
    pruneBackups(dir, keep);
    return { path: path.join(dir, name), manifest };
}

/** Delete all but the newest `keep` finished backups (never anything else in the folder). */
export function pruneBackups(dir: string, keep: number): string[] {
    const all = listBackups(dir);
    const old = all.slice(0, Math.max(0, all.length - keep));
    for (const b of old) fs.rmSync(b.path, { recursive: true, force: true });
    return old.map((b) => b.name);
}

/**
 * Restore a backup folder into `db`. Refuses when any collection it would
 * write already has records, unless `drop` is set (then those collections are
 * emptied first). Rebuilds indexes and checks the counts match the manifest.
 */
export async function restoreDatabase(db: Db, folder: string, { drop = false } = {}): Promise<Record<string, number>> {
    const mf = path.join(folder, 'manifest.json');
    if (!fs.existsSync(mf)) throw new Error(`Not a finished Whoply backup (no manifest.json): ${folder}`);
    const manifest: Manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const names = Object.keys(manifest.collections);

    if (!drop) {
        const busy: string[] = [];
        for (const n of names) if (await db.collection(n).estimatedDocumentCount()) busy.push(n);
        if (busy.length) throw new Error(`Database "${db.databaseName}" already has data (${busy.slice(0, 5).join(', ')}${busy.length > 5 ? '…' : ''}). Restore into an empty database, or pass --drop to replace it.`);
    }

    const restored: Record<string, number> = {};
    for (const n of names) {
        const c = db.collection(n);
        if (drop) await c.drop().catch((e) => { if (e?.codeName !== 'NamespaceNotFound') throw e; });
        await db.createCollection(n).catch((e) => { if (e?.codeName !== 'NamespaceExists') throw e; });

        let batch: any[] = [];
        let count = 0;
        const flush = async () => { if (batch.length) { await c.insertMany(batch, { ordered: true }); count += batch.length; batch = []; } };
        const file = path.join(folder, `${n}.jsonl.gz`);
        const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
        for await (const line of rl) {
            if (!line) continue;
            batch.push(EJSON.parse(line, { relaxed: false }));
            if (batch.length >= BATCH) await flush();
        }
        await flush();

        for (const ix of manifest.collections[n].indexes) {
            const { key, v: _v, ns: _ns, ...options } = ix;
            await c.createIndex(key, options);
        }
        const expected = manifest.collections[n].count;
        if (count !== expected) throw new Error(`${n}: restored ${count} records, backup has ${expected}`);
        restored[n] = count;
    }
    return restored;
}
