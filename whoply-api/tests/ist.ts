/**
 * India-time helpers (src/utils/ist.ts) at the moments UTC gets wrong.
 *
 *   npx tsx tests/ist.ts        (no server or database needed)
 */
import { istDayRange, istDateRange, istMonthStart, istPeriodStart, istYm, istYmd, istDmy, gstMonth, istDaysAgo } from '../src/utils/ist.js';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: unknown, detail = '') => results.push({ name, pass: !!cond, detail });
const iso = (d: Date) => d.toISOString();

// 1 Oct 2026, 00:30 IST = 30 Sep 2026, 19:00 UTC — a UTC server calls this September.
const early = new Date('2026-09-30T19:00:00Z');
check('00:30 IST on the 1st is in the new month (document number)', istYm(early) === '202610', istYm(early));
check('…and on the new day', istYmd(early) === '2026-10-01', istYmd(early));
check('portal date DD/MM/YYYY', istDmy(early) === '01/10/2026', istDmy(early));
const day = istDayRange(early);
check('its day starts at IST midnight (18:30 UTC the day before)', iso(day.start) === '2026-09-30T18:30:00.000Z', iso(day.start));
check('…and ends 24 h later', iso(day.end) === '2026-10-01T18:30:00.000Z', iso(day.end));
check('month start is 1 Oct IST', iso(istMonthStart(early)) === '2026-09-30T18:30:00.000Z', iso(istMonthStart(early)));

// 23:59 IST on 31 Dec = 18:29 UTC — still the old day, month and year.
const late = new Date('2026-12-31T18:29:00Z');
check('23:59 IST on 31 Dec is still December', istYm(late) === '202612' && istYmd(late) === '2026-12-31', `${istYm(late)} ${istYmd(late)}`);
const ny = new Date('2026-12-31T18:30:00Z');
check('00:00 IST on 1 Jan is the new year', istYm(ny) === '202701', istYm(ny));

// A picked day (day-close ?date=)
const picked = istDateRange('2020-01-01');
check('picked day 2020-01-01 → IST midnight to midnight', !!picked && iso(picked.start) === '2019-12-31T18:30:00.000Z' && iso(picked.end) === '2020-01-01T18:30:00.000Z', picked ? `${iso(picked.start)} ${iso(picked.end)}` : 'null');
check('picked day keeps its own date label', !!picked && istYmd(picked.start) === '2020-01-01', picked ? istYmd(picked.start) : '');
check('bad date → null', istDateRange('2020-13-01') === null && istDateRange('yesterday') === null);

// GST month
const g = gstMonth('2026-02');
check('GST month Feb 2026 = [1 Feb, 1 Mar) IST', iso(g.from) === '2026-01-31T18:30:00.000Z' && iso(g.to) === '2026-02-28T18:30:00.000Z' && g.label === '2026-02', `${iso(g.from)} ${iso(g.to)}`);
const gNow = gstMonth(undefined, early);
check('GST month defaults to the IST month', gNow.label === '2026-10', gNow.label);
check('GST month ignores junk', gstMonth('2026-13', early).label === '2026-10');

// Rolling periods start at IST midnight
const at = new Date('2026-03-31T20:00:00Z'); // 1 Apr 01:30 IST
check('week = 7 IST days back', iso(istPeriodStart('week', at)) === '2026-03-24T18:30:00.000Z', iso(istPeriodStart('week', at)));
check('month = same IST date last month', iso(istPeriodStart('month', at)) === '2026-02-28T18:30:00.000Z', iso(istPeriodStart('month', at)));
check('year = same IST date last year', iso(istPeriodStart('year', at)) === '2025-03-31T18:30:00.000Z', iso(istPeriodStart('year', at)));
check('0 days ago = today IST midnight', iso(istDaysAgo(0, at)) === '2026-03-31T18:30:00.000Z', iso(istDaysAgo(0, at)));

const fails = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ' — got ' + r.detail}`);
console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
