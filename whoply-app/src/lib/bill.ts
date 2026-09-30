import { inr2 } from './cn';
import { amountInWords, esc, gstBreakup } from './taxInvoice';

/** How a bill was paid: "cash", or for a split bill "cash ₹400 + upi ₹600". */
export const payModeLabel = (inv: { paymentMode?: string; payments?: { mode: string; amount: number }[] }) =>
    inv.payments && inv.payments.length > 1 ? inv.payments.map((p) => `${p.mode} ${inr2(p.amount)}`).join(' + ') : inv.paymentMode || '';

interface Biz {
    name?: string;
    ownerName?: string;
    mobile?: string;
    countryCode?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    upiId?: string;
    bank?: { name?: string; holder?: string; account?: string; ifsc?: string };
}

/** Payment reminder to a dealer/customer that includes how to pay (UPI + bank). */
export function buildDealerPaymentText(name: string, amount: number, biz?: Biz): string {
    const L: string[] = [];
    L.push(`Namaste ${name},`);
    L.push(`Payment reminder from *${biz?.name || 'us'}*.`);
    L.push(`Amount due: *${inr2(amount)}*`);
    if (biz?.upiId) {
        L.push('');
        L.push(`Pay by UPI: *${biz.upiId}*`);
        L.push(`upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent(biz.name || 'Shop')}&am=${(Number(amount) || 0).toFixed(2)}&cu=INR`);
    }
    if (biz?.bank?.account) {
        L.push('');
        L.push('Or bank transfer:');
        if (biz.bank.holder) L.push(`Name: ${biz.bank.holder}`);
        if (biz.bank.name) L.push(`Bank: ${biz.bank.name}`);
        L.push(`A/c: ${biz.bank.account}`);
        if (biz.bank.ifsc) L.push(`IFSC: ${biz.bank.ifsc}`);
    }
    L.push('');
    L.push('Thank you! 🙏');
    return L.join('\n');
}

/** Plain-text bill for WhatsApp / SMS, with shop details. */
export function buildBillText(inv: any, biz?: Biz): string {
    const L: string[] = [];
    L.push(`*${biz?.name || 'Whoply Store'}*`);
    if (biz?.address || biz?.city) L.push([biz?.address, biz?.city, biz?.state].filter(Boolean).join(', '));
    if (biz?.gstin) L.push(`GSTIN: ${biz.gstin}`);
    if (biz?.mobile) L.push(`Ph: ${biz.countryCode || ''} ${biz.mobile}`);
    L.push('--------------------------------');
    L.push(`Bill: ${inv.invoiceNo}`);
    L.push(`Date: ${new Date(inv.createdAt).toLocaleString('en-IN')}`);
    if (inv.customerName) L.push(`Customer: ${inv.customerName}${inv.customerMobile ? ` (${inv.customerMobile})` : ''}`);
    L.push('--------------------------------');
    inv.items.forEach((it: any) => {
        L.push(`${it.name} × ${it.quantity}   ${inr2(it.lineTotal)}`);
    });
    L.push('--------------------------------');
    L.push(`Subtotal: ${inr2(inv.subtotal)}`);
    if (inv.discount > 0) L.push(`Discount: -${inr2(inv.discount)}`);
    L.push(`GST: ${inr2(inv.totalGst)}`);
    L.push(`*Total: ${inr2(inv.grandTotal)}*`);
    L.push(`Paid (${payModeLabel(inv)}): ${inr2(inv.paidAmount)}`);
    if (inv.dueAmount > 0) L.push(`Due (udhar): ${inr2(inv.dueAmount)}`);
    L.push('--------------------------------');
    L.push('Thank you! 🙏 — powered by Whoply');
    return L.join('\n');
}

/** Plain-text order/invoice for WhatsApp to a dealer, with shop details. */
export function buildOrderText(o: any, biz?: Biz): string {
    const L: string[] = [];
    L.push(`*${biz?.name || 'Whoply'}*`);
    if (biz?.gstin) L.push(`GSTIN: ${biz.gstin}`);
    L.push('--------------------------------');
    L.push(`Order: ${o.orderNo}`);
    L.push(`Date: ${new Date(o.createdAt).toLocaleString('en-IN')}`);
    L.push(`Dealer: ${o.dealerName}`);
    L.push('--------------------------------');
    (o.items || []).forEach((it: any) => {
        L.push(`${it.name} × ${it.quantity}   ${inr2(it.lineTotal)}`);
    });
    L.push('--------------------------------');
    L.push(`*Total: ${inr2(o.total)}*`);
    L.push(`Paid: ${inr2(o.paidAmount)}`);
    if (o.dueAmount > 0) L.push(`Outstanding: ${inr2(o.dueAmount)}`);
    L.push('--------------------------------');
    L.push('Thank you! 🙏 — powered by Whoply');
    return L.join('\n');
}

/** Friendly udhar (credit) reminder to a customer for their outstanding balance. */
export function buildUdharReminderText(customerName: string, amount: number, biz?: Biz): string {
    return [
        `Namaste ${customerName},`,
        `A gentle reminder from *${biz?.name || 'our shop'}*.`,
        `Your pending balance (udhar) is *${inr2(amount)}*.`,
        `Please clear it at your convenience. Thank you! 🙏`,
    ].join('\n');
}

/** Short payment-pending note to a supplier for the amount still owed. */
export function buildPayableReminderText(supplierName: string, amount: number, biz?: Biz): string {
    return [
        `Namaste ${supplierName},`,
        `This is a payment update from *${biz?.name || 'our shop'}*.`,
        `Pending amount: *${inr2(amount)}*.`,
        `We will clear it shortly. Thank you for your patience. 🙏`,
    ].join('\n');
}

/** wa.me link that opens WhatsApp with the bill pre-filled to the customer. */
export function whatsappLink(mobile: string, text: string, countryCode = '+91'): string {
    const cc = countryCode.replace(/\D/g, '');
    const num = String(mobile).replace(/\D/g, '');
    return `https://wa.me/${cc}${num}?text=${encodeURIComponent(text)}`;
}

export function smsLink(mobile: string, text: string): string {
    return `sms:${mobile}?body=${encodeURIComponent(text)}`;
}

export type PrintFormat = 'a4' | '80mm' | '58mm';
export type Template = 'classic' | 'modern' | 'compact';

const TPL: Record<Template, { font: string; hfs: string; tfs: string; pad: string; band: boolean; accent: string }> = {
    classic: { font: 'Arial,Helvetica,sans-serif', hfs: '20px', tfs: '13px', pad: '6px 4px', band: false, accent: '#111' },
    modern: { font: "'Segoe UI',Arial,sans-serif", hfs: '22px', tfs: '13px', pad: '8px 6px', band: true, accent: '#0F2B46' },
    compact: { font: 'Arial,sans-serif', hfs: '16px', tfs: '11px', pad: '3px 3px', band: false, accent: '#111' },
};
/** The user's saved invoice template (device preference, set in Settings). */
export function getTemplate(): Template {
    if (typeof window === 'undefined') return 'classic';
    const t = localStorage.getItem('whoply_invoice_template');
    return t === 'modern' || t === 'compact' ? t : 'classic';
}
/** Shared <style> + document header for the chosen A4 template. `wide` = a full A4 page (tax invoice). */
function tplBase(template: Template, biz: Biz | undefined, wide = false) {
    const T = TPL[template];
    const addr = esc([biz?.address, biz?.city, biz?.state, biz?.pincode].filter(Boolean).join(', '));
    const contact = esc(`${biz?.gstin ? 'GSTIN: ' + biz.gstin : ''}${biz?.gstin && biz?.mobile ? ' · ' : ''}${biz?.mobile ? 'Ph: ' + (biz.countryCode || '') + ' ' + biz.mobile : ''}`);
    const css = `*{font-family:${T.font};box-sizing:border-box}body{max-width:${wide ? 760 : 480}px;margin:24px auto;color:#111;padding:0 16px}h1{font-size:${T.hfs};margin:0}.muted{color:#666;font-size:12px}hr{border:none;border-top:1px dashed #bbb;margin:12px 0}table{width:100%;border-collapse:collapse;font-size:${T.tfs}}th,td{padding:${T.pad};text-align:left;border-bottom:1px solid #eee}.r{text-align:right}.tot{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}.grand{font-weight:800;font-size:18px;border-top:2px solid ${T.accent};padding-top:8px;margin-top:6px;color:${T.accent}}.chip{display:inline-block;background:#EEF2F6;color:#0F2B46;border-radius:6px;padding:2px 8px;font-size:12px}.tag{display:inline-block;background:#EEF2F6;color:#0F2B46;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700}.band{background:${T.accent};color:#fff;margin:-24px -16px 12px;padding:18px 16px}.band h1{color:#fff}.band .muted{color:#D9C8B0}@media print{button{display:none}.band{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    const header = T.band
        ? `<div class="band"><h1>${esc(biz?.name || 'Whoply')}</h1>${addr || contact ? `<p class="muted">${addr}${addr && contact ? '<br>' : ''}${contact}</p>` : ''}</div>`
        : `<h1>${esc(biz?.name || 'Whoply')}</h1>${addr || contact ? `<p class="muted">${addr}${addr && contact ? '<br>' : ''}${contact}</p>` : ''}<hr>`;
    return { css, header };
}

/** Thermal-printer receipt (58mm / 80mm rolls). Narrow, monospace, no borders. */
function printThermal(inv: any, biz: Biz | undefined, mm: 58 | 80) {
    const g = gstBreakup(inv, biz);
    const line = '--------------------------------';
    const items = g.lines
        .map((l) => `<div class="it"><span class="nm">${esc(l.name)}</span><span class="am">${inr2(l.total)}</span></div><div class="sub">${l.quantity} ${esc(l.unit)} × ${inr2(l.price)}${l.hsn ? ` · HSN ${esc(l.hsn)}` : ''}${l.rate ? ` · GST ${l.rate}%` : ''}</div>`)
        .join('');
    // One line pair per GST rate: taxable value, then how the tax splits.
    const taxRows = g.summary
        .filter((s) => s.rate > 0)
        .map((s) => `<div class="row"><span>GST ${s.rate}% on ${inr2(s.taxable)}</span></div><div class="row sub"><span>${g.inter ? `IGST ${inr2(s.igst)}` : `CGST ${s.rate / 2}% ${inr2(s.cgst)} · SGST ${s.rate / 2}% ${inr2(s.sgst)}`}</span></div>`)
        .join('');
    const addr = [biz?.address, biz?.city, biz?.state].filter(Boolean).join(', ');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.invoiceNo)}</title>
    <style>
      @page{size:${mm}mm auto;margin:2mm}
      *{font-family:'Courier New',monospace;box-sizing:border-box}
      body{width:${mm - 4}mm;margin:0 auto;color:#000;font-size:${mm === 58 ? 10 : 12}px;line-height:1.35}
      .c{text-align:center}.b{font-weight:700}.big{font-size:${mm === 58 ? 13 : 16}px}
      .row{display:flex;justify-content:space-between;gap:4px}
      .it{display:flex;justify-content:space-between;gap:4px;margin-top:3px}
      .nm{flex:1;min-width:0;word-break:break-word}.am{white-space:nowrap}
      .sub{color:#333;font-size:${mm === 58 ? 9 : 11}px;padding-left:2px}
      .sep{white-space:nowrap;overflow:hidden;margin:5px 0}
      .grand{font-size:${mm === 58 ? 13 : 16}px;font-weight:700;margin-top:4px}
      @media print{button{display:none}}
    </style></head><body>
      <div class="c b big">${esc(biz?.name || 'Whoply Store')}</div>
      ${addr ? `<div class="c">${esc(addr)}</div>` : ''}
      ${biz?.gstin ? `<div class="c">GSTIN: ${esc(biz.gstin)}</div>` : ''}
      ${biz?.mobile ? `<div class="c">Ph: ${esc(biz.countryCode || '')} ${esc(biz.mobile)}</div>` : ''}
      <div class="sep">${line}</div>
      <div class="c b">${g.title}</div>
      <div class="row"><span>${esc(inv.invoiceNo)}</span></div>
      <div class="row"><span>${new Date(inv.createdAt).toLocaleString('en-IN')}</span></div>
      ${inv.customerName ? `<div class="row"><span>To: ${esc(inv.customerName)}${inv.customerMobile ? ' · ' + esc(inv.customerMobile) : ''}</span></div>` : ''}
      ${inv.customerGstin ? `<div class="row"><span>GSTIN: ${esc(inv.customerGstin)}</span></div><div class="row"><span>Place of supply: ${esc(g.placeOfSupply)}</span></div>` : ''}
      <div class="sep">${line}</div>
      ${items}
      <div class="sep">${line}</div>
      ${inv.discount > 0 ? `<div class="row"><span>Subtotal</span><span>${inr2(inv.subtotal)}</span></div><div class="row"><span>Discount</span><span>- ${inr2(inv.discount)}</span></div>` : ''}
      <div class="row"><span>Taxable value</span><span>${inr2(g.taxable)}</span></div>
      ${taxRows}
      <div class="row"><span>Total GST</span><span>${inr2(inv.totalGst)}</span></div>
      <div class="row grand"><span>TOTAL</span><span>${inr2(inv.grandTotal)}</span></div>
      <div class="sub">${amountInWords(inv.grandTotal)}</div>
      <div class="row"><span>Paid (${esc(payModeLabel(inv))})</span><span>${inr2(inv.paidAmount)}</span></div>
      ${inv.dueAmount > 0 ? `<div class="row"><span>Due (udhar)</span><span>${inr2(inv.dueAmount)}</span></div>` : ''}
      ${biz?.upiId ? `<div class="sep">${line}</div><div class="c">Pay UPI: ${esc(biz.upiId)}</div>` : ''}
      <div class="sep">${line}</div>
      <div class="c">Thank you! 🙏</div>
      <div class="c">Powered by Whoply</div>
      <button onclick="window.print()" style="margin:12px auto;display:block;padding:8px 16px;background:#C25000;color:#fff;border:0;border-radius:6px;font-weight:600">Print</button>
      <script>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
    const win = window.open('', '_blank', `width=${mm === 58 ? 300 : 380},height=720`);
    if (win) { win.document.write(html); win.document.close(); }
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const when = (d: any) => new Date(d).toLocaleString('en-IN');

/** Buyer box: name, mobile, and GSTIN or "Unregistered". */
const partyHtml = (name: string, mobile?: string, gstin?: string) =>
    `${esc(name)}${mobile ? '<br>' + esc(mobile) : ''}<br>${gstin ? 'GSTIN: ' + esc(gstin) : '<span class="muted">Unregistered</span>'}`;

/** One A4 GST document — tax invoice, credit note or wholesale order. */
interface GstDoc {
    docNo: string;
    title: string;
    /** "Original for recipient"; empty for a document that isn't a tax document yet. */
    copyLabel?: string;
    docHeading: string;
    /** Number, date and references; place of supply is added under it. */
    docBox: string;
    partyHeading: string;
    party: string;
    g: ReturnType<typeof gstBreakup>;
    /** Rows above "Taxable value" (subtotal and discount). */
    pre?: string;
    totalLabel: string;
    total: number;
    /** Rows under the total (paid, due, refund…). */
    post?: string;
    /** Lines under the amount in words (UPI, reason, notes). */
    notes?: string;
}

/**
 * The shared A4 layout (CGST Rules 46 and 53): title, document number and
 * date, supplier and buyer GSTIN, HSN, taxable value per line, CGST + SGST or
 * IGST, an HSN-wise tax summary, place of supply, amount in words, signatory.
 */
function openGstDoc(d: GstDoc, biz: Biz | undefined, template: Template) {
    const { g } = d;
    const { css, header } = tplBase(template, biz, true);
    const rows = g.lines
        .map(
            (l, i) =>
                `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.hsn) || '—'}</td><td class="r">${l.quantity} ${esc(l.unit)}</td><td class="r">${inr2(l.price)}</td><td class="r">${inr2(l.taxable)}</td><td class="r">${l.rate}%</td><td class="r">${inr2(l.total)}</td></tr>`
        )
        .join('');
    const taxHead = g.inter ? '<th class="r">IGST</th>' : '<th class="r">CGST</th><th class="r">SGST</th>';
    const taxRows = g.summary
        .map((s) => `<tr><td>${esc(s.hsn) || '—'}</td><td class="r">${s.rate}%</td><td class="r">${inr2(s.taxable)}</td>${g.inter ? `<td class="r">${inr2(s.igst)}</td>` : `<td class="r">${inr2(s.cgst)}</td><td class="r">${inr2(s.sgst)}</td>`}<td class="r">${inr2(s.cgst + s.sgst + s.igst)}</td></tr>`)
        .join('');
    const copy = d.copyLabel ?? 'Original for recipient';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.docNo)}</title>
    <style>${css}.doc{display:flex;justify-content:space-between;align-items:baseline;margin:4px 0 10px}.doc h2{margin:0;font-size:16px;letter-spacing:.08em}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.box{border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;line-height:1.5}.box h4{margin:0 0 2px;font-size:11px;text-transform:uppercase;color:#666}.words{margin-top:8px;font-size:12px}.sign{margin-top:28px;text-align:right;font-size:13px}.sign .l{margin-top:34px;border-top:1px solid #999;display:inline-block;padding-top:4px;min-width:180px;text-align:center}</style></head><body>
      ${header}
      <div class="doc"><h2>${esc(d.title)}</h2>${copy ? `<span class="muted">${esc(copy)}</span>` : ''}</div>
      <div class="cols">
        <div class="box"><h4>${esc(d.docHeading)}</h4>${d.docBox}<br>Place of supply: ${esc(g.placeOfSupply) || '—'}</div>
        <div class="box"><h4>${esc(d.partyHeading)}</h4>${d.party}</div>
      </div>
      <hr>
      <table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      ${g.summary.some((s) => s.rate > 0) ? `<h4 style="margin:14px 0 4px;font-size:12px">Tax summary</h4><table><thead><tr><th>HSN</th><th class="r">Rate</th><th class="r">Taxable</th>${taxHead}<th class="r">Total tax</th></tr></thead><tbody>${taxRows}</tbody></table>` : ''}
      <div style="margin-top:12px;margin-left:auto;max-width:320px">
        ${d.pre || ''}
        <div class="tot"><span>Taxable value</span><span>${inr2(g.taxable)}</span></div>
        ${g.inter ? `<div class="tot"><span>IGST</span><span>${inr2(g.igst)}</span></div>` : `<div class="tot"><span>CGST</span><span>${inr2(g.cgst)}</span></div><div class="tot"><span>SGST</span><span>${inr2(g.sgst)}</span></div>`}
        <div class="tot grand"><span>${esc(d.totalLabel)}</span><span>${inr2(d.total)}</span></div>
        ${d.post || ''}
      </div>
      <p class="words"><b>Amount in words:</b> ${amountInWords(d.total)}</p>
      ${d.notes || ''}
      <div class="sign">For ${esc(biz?.name || 'Whoply')}<br><span class="l">Authorised signatory</span></div>
      <hr><p class="muted" style="text-align:center">Thank you! Powered by Whoply</p>
      <button onclick="window.print()" style="margin:16px auto;display:block;padding:10px 20px;background:#C25000;color:#fff;border:0;border-radius:8px;font-weight:600">Print / Save as PDF</button>
      <script>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
    const w = window.open('', '_blank', 'width=860,height=900');
    if (w) { w.document.write(html); w.document.close(); }
}

/**
 * Open a printable invoice and trigger the print / save-as-PDF dialog. A4 is a
 * GST tax invoice (rule 46, see openGstDoc); 58 / 80mm go to the thermal
 * receipt. Supports the 3 A4 templates.
 */
export function printBill(inv: any, biz?: Biz, format: PrintFormat = 'a4', template: Template = getTemplate()) {
    if (format === '58mm') return printThermal(inv, biz, 58);
    if (format === '80mm') return printThermal(inv, biz, 80);
    const g = gstBreakup(inv, biz);
    openGstDoc({
        docNo: inv.invoiceNo,
        title: g.title,
        docHeading: 'Invoice',
        docBox: `<b>${esc(inv.invoiceNo)}</b><br>${when(inv.createdAt)}`,
        partyHeading: 'Bill to',
        party: partyHtml(inv.customerName || 'Walk-in customer', inv.customerMobile, inv.customerGstin),
        g,
        pre: inv.discount > 0 ? `<div class="tot"><span>Subtotal</span><span>${inr2(inv.subtotal)}</span></div><div class="tot"><span>Discount</span><span>- ${inr2(inv.discount)}</span></div>` : '',
        totalLabel: 'Total',
        total: inv.grandTotal,
        post: `<div class="tot"><span>Paid <span class="chip">${esc(payModeLabel(inv))}</span></span><span>${inr2(inv.paidAmount)}</span></div>${inv.dueAmount > 0 ? `<div class="tot" style="color:#B54708"><span>Due (udhar)</span><span>${inr2(inv.dueAmount)}</span></div>` : ''}`,
        notes: biz?.upiId ? `<p class="muted">Pay by UPI: <b>${esc(biz.upiId)}</b></p>` : '',
    }, biz, template);
}

/** Build CSV from a list of invoices (client-side, includes customer mobile). */
export function billsToCsv(bills: any[]): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Invoice No', 'Date', 'Customer', 'Mobile', 'Payment', 'Subtotal', 'GST', 'Discount', 'Total', 'Paid', 'Due', 'Status'];
    const lines = bills.map((i) =>
        [i.invoiceNo, new Date(i.createdAt).toLocaleString('en-IN'), i.customerName || 'Walk-in', i.customerMobile || '', payModeLabel(i), i.subtotal, i.totalGst, i.discount, i.grandTotal, i.paidAmount, i.dueAmount, i.status].map(esc).join(',')
    );
    return [header.map(esc).join(','), ...lines].join('\n');
}

/**
 * Payment status of an order from its paid/due split. A cancelled order owes
 * nothing because it was cancelled, not because it was paid.
 */
export function orderPayStatus(o: any): 'Paid' | 'Partial' | 'Unpaid' | 'Cancelled' {
    if (o.status === 'cancelled') return 'Cancelled';
    if ((o.dueAmount || 0) <= 0) return 'Paid';
    if ((o.paidAmount || 0) > 0) return 'Partial';
    return 'Unpaid';
}

/**
 * CSV for wholesale orders (client-side). Pass a dealerId→mobile map to include
 * each dealer's mobile number in the export.
 */
export function ordersToCsv(orders: any[], mobileOf?: (o: any) => string): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Order No', 'Date', 'Dealer', 'Mobile', 'GSTIN', 'Source', 'Items', 'Taxable', 'GST', 'Total', 'Paid', 'Due', 'Payment Status', 'Order Status', 'Dispatched', 'Delivered'];
    const lines = orders.map((o) =>
        [o.orderNo, new Date(o.createdAt).toLocaleString('en-IN'), o.dealerName, mobileOf ? mobileOf(o) : '', o.dealerGstin || '', o.source, o.items?.length || 0, o.subtotal ?? o.total, o.totalGst ?? 0, o.total, o.paidAmount, o.dueAmount, orderPayStatus(o), o.status,
        o.dispatchedAt ? new Date(o.dispatchedAt).toLocaleDateString('en-IN') : '', o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString('en-IN') : ''].map(esc).join(',')
    );
    return [header.map(esc).join(','), ...lines].join('\n');
}

/** Printable quotation/estimate (A4, save as PDF). No paid/due — it's an estimate. */
export function printQuote(q: any, biz?: Biz, template: Template = getTemplate()) {
    const { css, header } = tplBase(template, biz);
    const rows = q.items.map((it: any) => `<tr><td>${it.name}</td><td class="r">${it.quantity}</td><td class="r">${inr2(it.price)}</td><td class="r">${it.gstRate}%</td><td class="r">${inr2(it.lineTotal)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${q.quoteNo}</title>
    <style>${css}</style></head><body>
      <div class="tag">QUOTATION</div>
      <div style="margin-top:6px">${header}</div>
      <div><b>Quote:</b> ${q.quoteNo}<br><span class="muted">${new Date(q.createdAt).toLocaleString('en-IN')}${q.validUntil ? ' · valid till ' + new Date(q.validUntil).toLocaleDateString('en-IN') : ''}</span></div>
      ${q.customerName ? `<div style="margin-top:6px"><b>For:</b> ${q.customerName}${q.customerMobile ? ' · ' + q.customerMobile : ''}${q.customerGstin ? '<br>GSTIN: ' + q.customerGstin : ''}</div>` : ''}<hr>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:12px"><div class="tot"><span>Subtotal</span><span>${inr2(q.subtotal)}</span></div>${q.discount > 0 ? `<div class="tot"><span>Discount</span><span>- ${inr2(q.discount)}</span></div>` : ''}<div class="tot"><span>GST</span><span>${inr2(q.totalGst)}</span></div><div class="tot grand"><span>Estimated total</span><span>${inr2(q.grandTotal)}</span></div></div>
      <hr><p class="muted" style="text-align:center">This is an estimate, not a tax invoice. Powered by Whoply</p>
      <button onclick="window.print()" style="margin:16px auto;display:block;padding:10px 20px;background:#C25000;color:#fff;border:0;border-radius:8px;font-weight:600">Print / Save as PDF</button>
      <script>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open('', '_blank', 'width=520,height=720');
    if (w) { w.document.write(html); w.document.close(); }
}

/**
 * Printable credit note for a return (A4, CGST Rule 53): references the
 * original bill or order, and shows the GST it takes back — CGST + SGST or
 * IGST, HSN-wise — plus how the value was settled.
 */
export function printCreditNote(cn: any, biz?: Biz, template: Template = getTemplate()) {
    const g = gstBreakup(cn, biz);
    const ref = cn.invoiceNo ? `Against bill <b>${esc(cn.invoiceNo)}</b>` : cn.orderNo ? `Against order <b>${esc(cn.orderNo)}</b>` : '';
    // How the value went back: dues cleared first, the rest in cash (cashRefund).
    // Notes made before cashRefund was stored only know the refund mode.
    const cash = Number(cn.cashRefund) || 0;
    const adjusted = r2(cn.total - cash);
    const settled = cn.cashRefund === undefined
        ? `<div class="tot"><span>${cn.refundMode === 'udhar_adjust' ? 'Adjusted against dues' : 'Cash refund'}</span><span>${inr2(cn.total)}</span></div>`
        : `${adjusted > 0 ? `<div class="tot"><span>Adjusted against dues</span><span>${inr2(adjusted)}</span></div>` : ''}${cash > 0 ? `<div class="tot"><span>Cash refund</span><span>${inr2(cash)}</span></div>` : ''}`;
    openGstDoc({
        docNo: cn.creditNoteNo,
        title: 'CREDIT NOTE',
        docHeading: 'Credit note',
        docBox: `<b>${esc(cn.creditNoteNo)}</b><br>${when(cn.createdAt)}${ref ? `<br>${ref}` : ''}`,
        partyHeading: 'Issued to',
        party: partyHtml(cn.customerName || 'Walk-in customer', cn.customerMobile, cn.customerGstin),
        g,
        totalLabel: 'Credit note value',
        total: cn.total,
        post: settled,
        notes: cn.reason ? `<p class="muted">Reason for return: ${esc(cn.reason)}</p>` : '',
    }, biz, template);
}

const GST_DOC_CSS = `*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{max-width:640px;margin:20px auto;color:#111;padding:0 16px;font-size:13px}h1{font-size:18px;margin:0 0 2px}.tag{display:inline-block;background:#EEF2F6;color:#0F2B46;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;margin-bottom:8px}.muted{color:#666;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}.box{border:1px solid #e5e7eb;border-radius:8px;padding:10px}.box h4{margin:0 0 4px;font-size:12px;color:#0F2B46;text-transform:uppercase}hr{border:none;border-top:1px dashed #bbb;margin:12px 0}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #eee}.r{text-align:right}.tot{display:flex;justify-content:space-between;padding:2px 0}.grand{font-weight:800;font-size:15px;border-top:2px solid #111;padding-top:6px;margin-top:4px}.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:8px 10px;font-size:11px;margin-top:10px}.btns{margin:16px 0;display:flex;gap:8px;justify-content:center}.btns button{padding:9px 16px;border:0;border-radius:8px;font-weight:600;cursor:pointer}.pbtn{background:#C25000;color:#fff}.jbtn{background:#EEF2F6;color:#0F2B46}@media print{.btns,.warn{display:none}}`;
/** Injects a "Download portal JSON" button + script into a printable GST doc window. */
function jsonBtn(data: any, filename: string): string {
    const safe = JSON.stringify(data).replace(/</g, '\\u003c');
    return `<div class="btns"><button class="pbtn" onclick="window.print()">Print / Save as PDF</button><button class="jbtn" onclick="dlJson()">Download portal JSON</button></div>
    <script>var _D=${safe};function dlJson(){var b=new Blob([JSON.stringify(_D,null,2)],{type:'application/json'});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='${filename}.json';a.click();URL.revokeObjectURL(u);}setTimeout(function(){},100);</script>`;
}

/** Human-readable e-way bill (A4/PDF) built from the portal JSON, with a Download-JSON button. */
export function printEwayBill(d: any, biz?: Biz) {
    const modes: Record<string, string> = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' };
    const rows = (d.itemList || []).map((it: any) => `<tr><td>${it.productName}</td><td class="r">${it.hsnCode || '—'}</td><td class="r">${it.quantity} ${it.qtyUnit || ''}</td><td class="r">${inr2(it.taxableAmount)}</td><td class="r">${(it.cgstRate || 0) + (it.sgstRate || 0) + (it.igstRate || 0)}%</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>e-Way ${d.docNo}</title><style>${GST_DOC_CSS}</style></head><body>
      <div class="tag">e-WAY BILL · DRAFT</div>
      <h1>${biz?.name || 'Whoply'}</h1><p class="muted">${biz?.gstin ? 'GSTIN: ' + biz.gstin : ''}</p>
      <div><b>Document:</b> ${d.docType || 'INV'} ${d.docNo} · <span class="muted">${d.docDate}</span> · Value <b>${inr2(d.totInvValue)}</b></div>
      <div class="grid">
        <div class="box"><h4>From (Consignor)</h4>${d.fromTrdName || ''}<br><span class="muted">GSTIN: ${d.fromGstin} · ${d.fromPlace || ''} (${d.fromStateCode || '-'})</span></div>
        <div class="box"><h4>To (Consignee)</h4>${d.toTrdName || ''}<br><span class="muted">GSTIN: ${d.toGstin} · ${d.toPlace || ''} (${d.toStateCode || '-'})</span></div>
      </div>
      <div class="box"><h4>Transport</h4>Mode: ${modes[d.transMode] || 'Road'} · Vehicle: <b>${d.vehicleNo || '—'}</b> · Distance: ${d.transDistance || 0} km${d.transporterName ? ' · Transporter: ' + d.transporterName : ''}</div>
      <hr>
      <table><thead><tr><th>Item</th><th class="r">HSN</th><th class="r">Qty</th><th class="r">Taxable</th><th class="r">GST</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:10px"><div class="tot"><span>Taxable value</span><span>${inr2(d.totalValue)}</span></div><div class="tot"><span>CGST</span><span>${inr2(d.cgstValue)}</span></div><div class="tot"><span>SGST</span><span>${inr2(d.sgstValue)}</span></div><div class="tot"><span>IGST</span><span>${inr2(d.igstValue)}</span></div><div class="tot grand"><span>Total value</span><span>${inr2(d.totInvValue)}</span></div></div>
      <div class="warn">⚠ This is a draft for your records. The official e-Way Bill number (EBN) is issued only after you submit this on <b>ewaybillgst.gov.in</b> — use "Download portal JSON" to bulk-upload, or enter the details there.</div>
      ${jsonBtn(d, `ewaybill-${String(d.docNo).replace(/\//g, '-')}`)}
    </body></html>`;
    const w = window.open('', '_blank', 'width=680,height=760');
    if (w) { w.document.write(html); w.document.close(); }
}

/** Human-readable e-invoice (A4/PDF) built from the IRP JSON, with a Download-JSON button. */
export function printEInvoice(d: any, biz?: Biz) {
    const rows = (d.ItemList || []).map((it: any) => `<tr><td>${it.SlNo}</td><td>${it.PrdDesc}</td><td class="r">${it.HsnCd || '—'}</td><td class="r">${it.Qty}</td><td class="r">${inr2(it.UnitPrice)}</td><td class="r">${it.GstRt}%</td><td class="r">${inr2(it.TotItemVal)}</td></tr>`).join('');
    const v = d.ValDtls || {};
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>e-Invoice ${d.DocDtls?.No}</title><style>${GST_DOC_CSS}</style></head><body>
      <div class="tag">e-INVOICE · ${d.TranDtls?.SupTyp || ''}</div>
      <h1>${biz?.name || 'Whoply'}</h1><p class="muted">${biz?.gstin ? 'GSTIN: ' + biz.gstin : ''}</p>
      <div><b>Invoice:</b> ${d.DocDtls?.No} · <span class="muted">${d.DocDtls?.Dt}</span></div>
      <div class="grid">
        <div class="box"><h4>Seller</h4>${d.SellerDtls?.LglNm || ''}<br><span class="muted">GSTIN: ${d.SellerDtls?.Gstin} · ${d.SellerDtls?.Loc || ''} (${d.SellerDtls?.Stcd || '-'})</span></div>
        <div class="box"><h4>Buyer</h4>${d.BuyerDtls?.LglNm || ''}<br><span class="muted">GSTIN: ${d.BuyerDtls?.Gstin} · ${d.BuyerDtls?.Loc || ''} (${d.BuyerDtls?.Stcd || '-'})</span></div>
      </div>
      <table><thead><tr><th>#</th><th>Item</th><th class="r">HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:10px"><div class="tot"><span>Taxable value</span><span>${inr2(v.AssVal)}</span></div><div class="tot"><span>CGST</span><span>${inr2(v.CgstVal)}</span></div><div class="tot"><span>SGST</span><span>${inr2(v.SgstVal)}</span></div><div class="tot"><span>IGST</span><span>${inr2(v.IgstVal)}</span></div><div class="tot grand"><span>Total</span><span>${inr2(v.TotInvVal)}</span></div></div>
      <div class="warn">⚠ This is a draft for your records. The IRN & signed QR are issued only after you submit this on the <b>e-invoice portal (IRP)</b> — use "Download portal JSON" to upload it.</div>
      ${jsonBtn(d, `einvoice-${String(d.DocDtls?.No).replace(/\//g, '-')}`)}
    </body></html>`;
    const w = window.open('', '_blank', 'width=680,height=760');
    if (w) { w.document.write(html); w.document.close(); }
}

/** Plain-text quotation for WhatsApp. */
export function buildQuoteText(q: any, biz?: Biz): string {
    const L: string[] = [`*${biz?.name || 'Whoply'}* — Quotation`, `Quote: ${q.quoteNo}`];
    if (q.customerName) L.push(`For: ${q.customerName}`);
    L.push('--------------------------------');
    (q.items || []).forEach((it: any) => L.push(`${it.name} × ${it.quantity}   ${inr2(it.lineTotal)}`));
    L.push('--------------------------------');
    L.push(`*Estimated total: ${inr2(q.grandTotal)}*`);
    if (q.validUntil) L.push(`Valid till: ${new Date(q.validUntil).toLocaleDateString('en-IN')}`);
    L.push('This is an estimate, not a tax invoice. 🙏');
    return L.join('\n');
}

/** CSV for the wholesaler money-in (payments) ledger. */
export function paymentsToCsv(payments: any[]): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Date', 'Dealer', 'Order No', 'Amount', 'Mode', 'Note'];
    const lines = payments.map((p) =>
        [new Date(p.createdAt).toLocaleString('en-IN'), p.dealerName || '', p.orderNo || 'On account', p.amount, p.mode, p.note || ''].map(esc).join(',')
    );
    return [header.map(esc).join(','), ...lines].join('\n');
}

/**
 * Printable wholesale order (A4, same GST layout as a bill). GST wants the tax
 * invoice issued when the goods leave, so a dispatched or delivered order
 * prints as a Tax Invoice, and before that as a Proforma Invoice.
 */
export function printOrder(o: any, biz?: Biz, template: Template = getTemplate()) {
    const g = gstBreakup(o, biz);
    const supplied = o.status === 'dispatched' || o.status === 'delivered';
    const title = o.status === 'cancelled' ? 'CANCELLED ORDER' : supplied ? g.title : 'PROFORMA INVOICE';
    // A return lowers the order's total but leaves its lines as sold — show the
    // invoice as sold, then what the credit notes took off.
    const asSold = r2(g.taxable + g.cgst + g.sgst + g.igst);
    const returned = r2(asSold - (o.total || 0));
    const hasReturns = returned > 0.05;
    const notes = [
        !supplied && o.status !== 'cancelled' ? '<p class="muted">Proforma — not a tax invoice. The tax invoice is issued when the goods are dispatched.</p>' : '',
        biz?.upiId && o.dueAmount > 0 ? `<p class="muted">Pay by UPI: <b>${esc(biz.upiId)}</b></p>` : '',
    ].join('');
    openGstDoc({
        docNo: o.orderNo,
        title,
        copyLabel: supplied ? 'Original for recipient' : '',
        docHeading: 'Order',
        docBox: `<b>${esc(o.orderNo)}</b><br>${when(o.createdAt)}<br>Status: ${esc(o.status)}${o.dispatchedAt ? ` · dispatched ${new Date(o.dispatchedAt).toLocaleDateString('en-IN')}` : ''}`,
        partyHeading: 'Bill to',
        party: partyHtml(o.dealerName || 'Dealer', o.dealerMobile, o.dealerGstin),
        g,
        totalLabel: 'Total',
        total: hasReturns ? asSold : o.total,
        post: `${hasReturns ? `<div class="tot"><span>Less returns (credit notes)</span><span>- ${inr2(returned)}</span></div><div class="tot"><span><b>Net amount</b></span><span><b>${inr2(o.total)}</b></span></div>` : ''}<div class="tot"><span>Paid</span><span>${inr2(o.paidAmount)}</span></div>${o.dueAmount > 0 ? `<div class="tot" style="color:#B54708"><span>Outstanding</span><span>${inr2(o.dueAmount)}</span></div>` : ''}`,
        notes,
    }, biz, template);
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
