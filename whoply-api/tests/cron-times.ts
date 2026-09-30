/**
 * Scheduled jobs fire at India time whatever the server clock is set to.
 *
 *   npx tsx tests/cron-times.ts                (no server or database needed)
 *   TZ=UTC npx tsx tests/cron-times.ts         (how most hosting runs)
 */
import 'dotenv/config';
import cron from 'node-cron';
import { TIMED_JOBS, CRON_TIMEZONE } from '../src/cron/index.js';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: unknown, detail = '') => results.push({ name, pass: !!cond, detail });
const ist = (s: string) => new Date(`${s}+05:30`);
const job = (key: string) => {
    const j = TIMED_JOBS.find((x) => x.key === key)!;
    return cron.createTask(j.at, () => {}, { timezone: CRON_TIMEZONE });
};

const summary = job('daily-summaries');
check('evening summary fires at 9:00 PM India time', summary.match(ist('2026-10-01T21:00:00')));
check('…not at 9:00 PM UTC (2:30 AM in India)', !summary.match(new Date('2026-10-01T21:00:00Z')));

const udhar = job('udhar-reminders');
check('payment reminders fire at 10:00 AM India time', udhar.match(ist('2026-10-01T10:00:00')));
check('…not at 10:00 AM UTC (3:30 PM in India)', !udhar.match(new Date('2026-10-01T10:00:00Z')));

const payables = job('payable-reminders');
check('supplier reminder fires Monday 9:00 AM India time', payables.match(ist('2026-10-05T09:00:00')));
check('…not on Sunday', !payables.match(ist('2026-10-04T09:00:00')));
// Monday 9:00 AM UTC is still Monday in India but 2:30 PM — must not fire.
check('…not Monday 9:00 AM UTC', !payables.match(new Date('2026-10-05T09:00:00Z')));

check('every timed job has the India time zone', CRON_TIMEZONE === 'Asia/Kolkata' && TIMED_JOBS.length === 3);

const fails = results.filter((r) => !r.pass);
console.log(`(server clock: ${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone})`);
for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ' — got ' + r.detail}`);
console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
