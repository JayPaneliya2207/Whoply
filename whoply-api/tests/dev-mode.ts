/**
 * Test conveniences (fixed OTP 123456, the OTP in API replies, demo-password
 * logins) are only for a developer's machine. A live server started with the
 * wrong NODE_ENV must not get them — it talks to a remote database.
 *
 *   npx tsx tests/dev-mode.ts                (no server or database needed)
 */
import { isLocalDb, isDevMode } from '../src/utils/devMode.js';
import { generateOtp } from '../src/utils/otp.js';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: unknown, detail = '') => results.push({ name, pass: !!cond, detail });

const LOCAL = ['mongodb://localhost:27017/whoply', 'mongodb://127.0.0.1/whoply', 'mongodb://user:pass@localhost:27017/whoply?authSource=admin', 'mongodb://[::1]:27017/whoply', 'mongodb://localhost'];
const REMOTE = [
    'mongodb+srv://user:pw@cluster0.abcde.mongodb.net/whoply',
    'mongodb://10.0.0.5:27017/whoply',
    'mongodb://db.example.com/whoply',
    'mongodb://localhost.evil.example/whoply', // starts like localhost
    'mongodb://evil.example/whoply?x=localhost', // localhost only in the options
    'mongodb://user:localhost@evil.example/whoply', // localhost only as a password
    'mongodb://localhost:27017,db.example.com:27017/whoply', // a replica set that leaves this machine
    'mongodb://mongo:27017/whoply',
];
check('a database on this machine is local', LOCAL.every((u) => isLocalDb(u)), LOCAL.filter((u) => !isLocalDb(u)).join(' | '));
check('a database anywhere else is not', REMOTE.every((u) => !isLocalDb(u)), REMOTE.filter((u) => isLocalDb(u)).join(' | '));

const withEnv = <T>(nodeEnv: string | undefined, uri: string, fn: () => T): T => {
    const before = { e: process.env.NODE_ENV, u: process.env.MONGODB_URI };
    if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
    process.env.MONGODB_URI = uri;
    try { return fn(); } finally {
        if (before.e === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before.e;
        if (before.u === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = before.u;
    }
};
const ATLAS = REMOTE[0];
check('development + local database = dev mode', withEnv('development', LOCAL[0], isDevMode));
check('test + local database = dev mode', withEnv('test', LOCAL[0], isDevMode));
check('production is never dev mode, even on a local database', !withEnv('production', LOCAL[0], isDevMode));
check('a live database with NODE_ENV=development is NOT dev mode', !withEnv('development', ATLAS, isDevMode));
check('a live database with NODE_ENV missing is NOT dev mode', !withEnv(undefined, ATLAS, isDevMode));

check('dev mode uses the fixed test OTP', withEnv('development', LOCAL[0], generateOtp) === '123456');
const live = withEnv(undefined, ATLAS, () => Array.from({ length: 6 }, generateOtp));
check('a live database gets random 6-digit OTPs whatever NODE_ENV says', live.every((o) => /^\d{6}$/.test(o)) && new Set(live).size > 1 && !live.every((o) => o === '123456'), live.join(','));
const prod = withEnv('production', LOCAL[0], () => Array.from({ length: 6 }, generateOtp));
check('production gets random OTPs', prod.every((o) => /^\d{6}$/.test(o)) && new Set(prod).size > 1, prod.join(','));

const fails = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ' — got ' + r.detail}`);
console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
