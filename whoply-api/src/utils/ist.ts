/**
 * Dates in India time (IST, UTC+5:30, no daylight saving).
 *
 * Shops close their day, month and GST period by the Indian clock. The server
 * may run in UTC (most hosts do), where "today" would start at 5:30 AM IST and
 * a sale at 1 AM on the 1st would land in last month. Every day / month
 * boundary, report grouping and document-number month goes through here.
 */
export const IST_TZ = 'Asia/Kolkata';
const OFFSET_MS = 330 * 60 * 1000;

/** The IST calendar parts of an instant. */
export function istParts(d: Date = new Date()) {
    const x = new Date(d.getTime() + OFFSET_MS);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

/** The instant IST midnight begins on a calendar date (month may overflow, like Date.UTC). */
export const istMidnight = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day) - OFFSET_MS);

/** [start, end) of the IST day containing `d`. */
export function istDayRange(d: Date = new Date()) {
    const { y, m, day } = istParts(d);
    return { start: istMidnight(y, m, day), end: istMidnight(y, m, day + 1) };
}

/** [start, end) of an IST calendar day given as YYYY-MM-DD, or null if it isn't one. */
export function istDateRange(ymd: string) {
    const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!r) return null;
    const [y, m, day] = [+r[1], +r[2], +r[3]];
    if (m < 1 || m > 12 || day < 1 || day > 31) return null;
    return { start: istMidnight(y, m, day), end: istMidnight(y, m, day + 1) };
}

/** [start, end) of an IST calendar month (m = 1–12). */
export const istMonthRange = (y: number, m: number) => ({ start: istMidnight(y, m, 1), end: istMidnight(y, m + 1, 1) });

/** Start of the current IST month. */
export const istMonthStart = (d: Date = new Date()) => { const { y, m } = istParts(d); return istMidnight(y, m, 1); };

/** IST midnight `days` days before today (0 = today's midnight). */
export const istDaysAgo = (days: number, d: Date = new Date()) => { const { y, m, day } = istParts(d); return istMidnight(y, m, day - days); };

/** IST midnight `months` calendar months before today. */
export const istMonthsAgo = (months: number, d: Date = new Date()) => { const { y, m, day } = istParts(d); return istMidnight(y, m - months, day); };

/**
 * Start of a report window, at IST midnight (the window runs to now):
 *   week    — today and the 6 days before (7 days)
 *   month   — this calendar month, from the 1st (matches the dashboard)
 *   quarter — the last 3 months, starting the day after today's date 3 months ago
 *   year    — the last 12 months, likewise
 * No calendar date is ever counted twice (a rent paid on the 30th, say).
 */
export function istPeriodStart(period: string, d: Date = new Date()): Date {
    const { y, m, day } = istParts(d);
    if (period === 'week') return istDaysAgo(6, d);
    if (period === 'quarter') return istMidnight(y, m - 3, day + 1);
    if (period === 'year') return istMidnight(y - 1, m, day + 1);
    return istMonthStart(d); // month (default)
}

/**
 * The GST return month from ?month=YYYY-MM (default: this IST month):
 * [from, to) plus its YYYY-MM label.
 */
export function gstMonth(q: unknown, d: Date = new Date()) {
    const r = /^(\d{4})-(\d{2})$/.exec(String(q ?? ''));
    const { y, m } = r && +r[2] >= 1 && +r[2] <= 12 ? { y: +r[1], m: +r[2] } : istParts(d);
    const { start, end } = istMonthRange(y, m);
    return { from: start, to: end, label: `${y}-${String(m).padStart(2, '0')}` };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYYMM in IST — the month part of bill, order and note numbers. */
export const istYm = (d: Date = new Date()) => { const { y, m } = istParts(d); return `${y}${pad(m)}`; };

/** YYYY-MM-DD in IST. */
export const istYmd = (d: Date = new Date()) => { const { y, m, day } = istParts(d); return `${y}-${pad(m)}-${pad(day)}`; };

/** YYYY-MM in IST. */
export const istYmLabel = (d: Date = new Date()) => { const { y, m } = istParts(d); return `${y}-${pad(m)}`; };

/** DD/MM/YYYY in IST (the government portals' date format). */
export const istDmy = (d: Date = new Date()) => { const { y, m, day } = istParts(d); return `${pad(day)}/${pad(m)}/${y}`; };
