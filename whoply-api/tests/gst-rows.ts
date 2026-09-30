/**
 * GST report rate-wise / HSN netting (src/utils/gstSplit.ts netRows).
 *
 *   npx tsx tests/gst-rows.ts        (no server or database needed)
 */
import { netRows, rateKey, hsnKey, rateTable, hsnTable } from '../src/utils/gstSplit.js';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: unknown, detail = '') => results.push({ name, pass: !!cond, detail });

const sales = [
    { _id: 5, taxable: 1000, gst: 50, igst: 0 },
    { _id: 18, taxable: 2000, gst: 360, igst: 360 },
];
const returns = [
    { _id: 18, taxable: 500, gst: 90, igst: 90 },
    { _id: 12, taxable: 100, gst: 12, igst: 0 }, // sold last month, returned this month
];
const rates = rateTable(netRows(sales, returns, rateKey));
const at = (rate: number) => rates.find((r) => r.rate === rate);
check('18% row is net of its return', at(18)?.taxable === 1500 && at(18)?.gst === 270 && at(18)?.igst === 270, JSON.stringify(at(18)));
check('5% row with no return is unchanged', at(5)?.taxable === 1000 && at(5)?.cgst === 25 && at(5)?.sgst === 25, JSON.stringify(at(5)));
check('a return with no sale at its rate still shows, negative', at(12)?.taxable === -100 && at(12)?.gst === -12, JSON.stringify(at(12)));
check('rows sorted by rate', rates.map((r) => r.rate).join() === '5,12,18', rates.map((r) => r.rate).join());
check('input rows are not changed', sales[1].taxable === 2000);

check('a missing rate and 0% are the same row', netRows([{ _id: null, taxable: 10, gst: 0, igst: 0 }], [{ _id: 0, taxable: 4, gst: 0, igst: 0 }], rateKey).length === 1);

const hsn = hsnTable(netRows(
    [{ _id: { hsn: '1006', rate: 5 }, name: 'Rice', qty: 10.5, taxable: 525, gst: 26.25, igst: 0 }],
    [
        { _id: { hsn: '1006', rate: 5 }, name: 'Rice', qty: 0.2, taxable: 10, gst: 0.5, igst: 0 },
        { _id: { hsn: '1006', rate: 18 }, name: 'Rice bag', qty: 1, taxable: 50, gst: 9, igst: 0 },
    ],
    hsnKey
));
const rice = hsn.find((h) => h.rate === 5);
check('HSN row: qty and value net of the return', rice?.qty === 10.3 && rice?.taxable === 515, JSON.stringify(rice));
check('same HSN at another rate is its own row', hsn.length === 2 && hsn.some((h) => h.rate === 18 && h.qty === -1), JSON.stringify(hsn));

const fails = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ' — got ' + r.detail}`);
console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
