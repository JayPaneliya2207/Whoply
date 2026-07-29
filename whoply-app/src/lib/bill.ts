import { inr2 } from './cn';

interface Biz {
    name?: string;
    ownerName?: string;
    mobile?: string;
    countryCode?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
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
    L.push(`GST: ${inr2(inv.totalGst)}`);
    if (inv.discount > 0) L.push(`Discount: -${inr2(inv.discount)}`);
    L.push(`*Total: ${inr2(inv.grandTotal)}*`);
    L.push(`Paid (${inv.paymentMode}): ${inr2(inv.paidAmount)}`);
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
    modern: { font: "'Segoe UI',Arial,sans-serif", hfs: '22px', tfs: '13px', pad: '8px 6px', band: true, accent: '#4338CA' },
    compact: { font: 'Arial,sans-serif', hfs: '16px', tfs: '11px', pad: '3px 3px', band: false, accent: '#111' },
};
/** The user's saved invoice template (device preference, set in Settings). */
export function getTemplate(): Template {
    if (typeof window === 'undefined') return 'classic';
    const t = localStorage.getItem('whoply_invoice_template');
    return t === 'modern' || t === 'compact' ? t : 'classic';
}
/** Shared <style> + document header for the chosen A4 template. */
function tplBase(template: Template, biz: Biz | undefined) {
    const T = TPL[template];
    const addr = [biz?.address, biz?.city, biz?.state].filter(Boolean).join(', ');
    const contact = `${biz?.gstin ? 'GSTIN: ' + biz.gstin : ''}${biz?.gstin && biz?.mobile ? ' · ' : ''}${biz?.mobile ? 'Ph: ' + (biz.countryCode || '') + ' ' + biz.mobile : ''}`;
    const css = `*{font-family:${T.font};box-sizing:border-box}body{max-width:480px;margin:24px auto;color:#111;padding:0 16px}h1{font-size:${T.hfs};margin:0}.muted{color:#666;font-size:12px}hr{border:none;border-top:1px dashed #bbb;margin:12px 0}table{width:100%;border-collapse:collapse;font-size:${T.tfs}}th,td{padding:${T.pad};text-align:left;border-bottom:1px solid #eee}.r{text-align:right}.tot{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}.grand{font-weight:800;font-size:18px;border-top:2px solid ${T.accent};padding-top:8px;margin-top:6px;color:${T.accent}}.chip{display:inline-block;background:#eef;color:#334;border-radius:6px;padding:2px 8px;font-size:12px}.tag{display:inline-block;background:#eef2ff;color:#4338CA;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700}.band{background:${T.accent};color:#fff;margin:-24px -16px 12px;padding:18px 16px}.band h1{color:#fff}.band .muted{color:#dfe3ff}@media print{button{display:none}.band{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    const header = T.band
        ? `<div class="band"><h1>${biz?.name || 'Whoply'}</h1>${addr || contact ? `<p class="muted">${addr}${addr && contact ? '<br>' : ''}${contact}</p>` : ''}</div>`
        : `<h1>${biz?.name || 'Whoply'}</h1>${addr || contact ? `<p class="muted">${addr}${addr && contact ? '<br>' : ''}${contact}</p>` : ''}<hr>`;
    return { css, header };
}

/** Thermal-printer receipt (58mm / 80mm rolls). Narrow, monospace, no borders. */
function printThermal(inv: any, biz: Biz | undefined, mm: 58 | 80) {
    const w = mm; // paper width in mm
    const line = '--------------------------------';
    const items = inv.items
        .map((it: any) => `<div class="it"><span class="nm">${it.name}</span><span class="am">${inr2(it.lineTotal)}</span></div><div class="sub">${it.quantity} × ${inr2(it.price)}${it.gstRate ? ` · GST ${it.gstRate}%` : ''}</div>`)
        .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoiceNo}</title>
    <style>
      @page{size:${w}mm auto;margin:2mm}
      *{font-family:'Courier New',monospace;box-sizing:border-box}
      body{width:${w}mm;margin:0 auto;color:#000;font-size:${mm === 58 ? 11 : 12}px;line-height:1.35}
      .c{text-align:center}.b{font-weight:700}.big{font-size:${mm === 58 ? 14 : 16}px}
      .row{display:flex;justify-content:space-between;gap:6px}
      .it{display:flex;justify-content:space-between;gap:6px;margin-top:3px}
      .nm{flex:1;word-break:break-word}.am{white-space:nowrap}
      .sub{color:#333;font-size:${mm === 58 ? 10 : 11}px;padding-left:2px}
      .sep{white-space:nowrap;overflow:hidden;margin:5px 0}
      .grand{font-size:${mm === 58 ? 14 : 16}px;font-weight:700;margin-top:4px}
      @media print{button{display:none}}
    </style></head><body>
      <div class="c b big">${biz?.name || 'Whoply Store'}</div>
      ${[biz?.address, biz?.city, biz?.state].filter(Boolean).length ? `<div class="c">${[biz?.address, biz?.city, biz?.state].filter(Boolean).join(', ')}</div>` : ''}
      ${biz?.gstin ? `<div class="c">GSTIN: ${biz.gstin}</div>` : ''}
      ${biz?.mobile ? `<div class="c">Ph: ${(biz.countryCode || '')} ${biz.mobile}</div>` : ''}
      <div class="sep">${line}</div>
      <div class="row"><span>${inv.invoiceNo}</span></div>
      <div class="row"><span>${new Date(inv.createdAt).toLocaleString('en-IN')}</span></div>
      ${inv.customerName ? `<div class="row"><span>To: ${inv.customerName}${inv.customerMobile ? ' · ' + inv.customerMobile : ''}</span></div>` : ''}
      <div class="sep">${line}</div>
      ${items}
      <div class="sep">${line}</div>
      <div class="row"><span>Subtotal</span><span>${inr2(inv.subtotal)}</span></div>
      <div class="row"><span>GST</span><span>${inr2(inv.totalGst)}</span></div>
      ${inv.discount > 0 ? `<div class="row"><span>Discount</span><span>- ${inr2(inv.discount)}</span></div>` : ''}
      <div class="row grand"><span>TOTAL</span><span>${inr2(inv.grandTotal)}</span></div>
      <div class="row"><span>Paid (${inv.paymentMode})</span><span>${inr2(inv.paidAmount)}</span></div>
      ${inv.dueAmount > 0 ? `<div class="row"><span>Due (udhar)</span><span>${inr2(inv.dueAmount)}</span></div>` : ''}
      ${biz?.upiId ? `<div class="sep">${line}</div><div class="c">Pay UPI: ${biz.upiId}</div>` : ''}
      <div class="sep">${line}</div>
      <div class="c">Thank you! 🙏</div>
      <div class="c">Powered by Whoply</div>
      <button onclick="window.print()" style="margin:12px auto;display:block;padding:8px 16px;background:#4338CA;color:#fff;border:0;border-radius:6px;font-weight:600">Print</button>
      <script>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
    const win = window.open('', '_blank', `width=${mm === 58 ? 300 : 380},height=720`);
    if (win) { win.document.write(html); win.document.close(); }
}

/** Open a clean printable invoice and trigger the print/save-as-PDF dialog. Supports A4 + thermal 58/80mm and 3 templates. */
export function printBill(inv: any, biz?: Biz, format: PrintFormat = 'a4', template: Template = getTemplate()) {
    if (format === '58mm') return printThermal(inv, biz, 58);
    if (format === '80mm') return printThermal(inv, biz, 80);
    const { css, header } = tplBase(template, biz);
    const rows = inv.items
        .map(
            (it: any) =>
                `<tr><td>${it.name}</td><td class="r">${it.quantity}</td><td class="r">${inr2(it.price)}</td><td class="r">${it.gstRate}%</td><td class="r">${inr2(it.lineTotal)}</td></tr>`
        )
        .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoiceNo}</title>
    <style>${css}</style></head><body>
      ${header}
      <div><b>Invoice:</b> ${inv.invoiceNo}<br><span class="muted">${new Date(inv.createdAt).toLocaleString('en-IN')}</span></div>
      ${inv.customerName ? `<div style="margin-top:6px"><b>Bill to:</b> ${inv.customerName}${inv.customerMobile ? ' · ' + inv.customerMobile : ''}${inv.customerGstin ? '<br>GSTIN: ' + inv.customerGstin : ''}</div>` : ''}
      <hr>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:12px">
        <div class="tot"><span>Subtotal</span><span>${inr2(inv.subtotal)}</span></div>
        <div class="tot"><span>GST</span><span>${inr2(inv.totalGst)}</span></div>
        ${inv.discount > 0 ? `<div class="tot"><span>Discount</span><span>- ${inr2(inv.discount)}</span></div>` : ''}
        <div class="tot grand"><span>Total</span><span>${inr2(inv.grandTotal)}</span></div>
        <div class="tot"><span>Paid <span class="chip">${inv.paymentMode}</span></span><span>${inr2(inv.paidAmount)}</span></div>
        ${inv.dueAmount > 0 ? `<div class="tot" style="color:#b45309"><span>Due (udhar)</span><span>${inr2(inv.dueAmount)}</span></div>` : ''}
      </div>
      <hr><p class="muted" style="text-align:center">Thank you! Powered by Whoply</p>
      <button onclick="window.print()" style="margin:16px auto;display:block;padding:10px 20px;background:#4338CA;color:#fff;border:0;border-radius:8px;font-weight:600">Print / Save as PDF</button>
      <script>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
    const w = window.open('', '_blank', 'width=520,height=720');
    if (w) { w.document.write(html); w.document.close(); }
}

/** Build CSV from a list of invoices (client-side, includes customer mobile). */
export function billsToCsv(bills: any[]): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Invoice No', 'Date', 'Customer', 'Mobile', 'Payment', 'Subtotal', 'GST', 'Discount', 'Total', 'Paid', 'Due', 'Status'];
    const lines = bills.map((i) =>
        [i.invoiceNo, new Date(i.createdAt).toLocaleString('en-IN'), i.customerName || 'Walk-in', i.customerMobile || '', i.paymentMode, i.subtotal, i.totalGst, i.discount, i.grandTotal, i.paidAmount, i.dueAmount, i.status].map(esc).join(',')
    );
    return [header.map(esc).join(','), ...lines].join('\n');
}

/** Payment status of an order from its paid/due split. */
export function orderPayStatus(o: any): 'Paid' | 'Partial' | 'Unpaid' {
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
      <div style="margin-top:12px"><div class="tot"><span>Subtotal</span><span>${inr2(q.subtotal)}</span></div><div class="tot"><span>GST</span><span>${inr2(q.totalGst)}</span></div>${q.discount > 0 ? `<div class="tot"><span>Discount</span><span>- ${inr2(q.discount)}</span></div>` : ''}<div class="tot grand"><span>Estimated total</span><span>${inr2(q.grandTotal)}</span></div></div>
      <hr><p class="muted" style="text-align:center">This is an estimate, not a tax invoice. Powered by Whoply</p>
      <button onclick="window.print()" style="margin:16px auto;display:block;padding:10px 20px;background:#4338CA;color:#fff;border:0;border-radius:8px;font-weight:600">Print / Save as PDF</button>
      <script>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open('', '_blank', 'width=520,height=720');
    if (w) { w.document.write(html); w.document.close(); }
}

/** Printable credit note / sales return (A4). */
export function printCreditNote(cn: any, biz?: Biz, template: Template = getTemplate()) {
    const { css, header } = tplBase(template, biz);
    const rows = cn.items.map((it: any) => `<tr><td>${it.name}</td><td class="r">${it.quantity}</td><td class="r">${inr2(it.price)}</td><td class="r">${it.gstRate}%</td><td class="r">${inr2(it.lineTotal)}</td></tr>`).join('');
    const refundLabel = cn.refundMode === 'udhar_adjust' ? 'Adjusted against udhar' : 'Cash refund';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${cn.creditNoteNo}</title>
    <style>${css}</style></head><body>
      <div class="tag">CREDIT NOTE · RETURN</div>
      <div style="margin-top:6px">${header}</div>
      <div><b>Credit Note:</b> ${cn.creditNoteNo}<br><span class="muted">${new Date(cn.createdAt).toLocaleString('en-IN')}${(cn.invoiceNo || cn.orderNo) ? ' · against ' + (cn.invoiceNo || cn.orderNo) : ''}</span></div>
      ${cn.customerName ? `<div style="margin-top:6px"><b>Customer:</b> ${cn.customerName}${cn.customerMobile ? ' · ' + cn.customerMobile : ''}</div>` : ''}
      ${cn.reason ? `<div style="margin-top:4px" class="muted">Reason: ${cn.reason}</div>` : ''}<hr>
      <table><thead><tr><th>Item returned</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:12px"><div class="tot"><span>Subtotal</span><span>${inr2(cn.subtotal)}</span></div><div class="tot"><span>GST</span><span>${inr2(cn.totalGst)}</span></div><div class="tot grand"><span>Refund total</span><span>${inr2(cn.total)}</span></div><div class="tot"><span>${refundLabel}</span><span></span></div></div>
      <hr><p class="muted" style="text-align:center">Powered by Whoply</p>
      <button onclick="window.print()" style="margin:16px auto;display:block;padding:10px 20px;background:#4338CA;color:#fff;border:0;border-radius:8px;font-weight:600">Print / Save as PDF</button>
      <script>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open('', '_blank', 'width=520,height=720');
    if (w) { w.document.write(html); w.document.close(); }
}

const GST_DOC_CSS = `*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{max-width:640px;margin:20px auto;color:#111;padding:0 16px;font-size:13px}h1{font-size:18px;margin:0 0 2px}.tag{display:inline-block;background:#eef2ff;color:#4338CA;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;margin-bottom:8px}.muted{color:#666;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}.box{border:1px solid #e5e7eb;border-radius:8px;padding:10px}.box h4{margin:0 0 4px;font-size:12px;color:#4338CA;text-transform:uppercase}hr{border:none;border-top:1px dashed #bbb;margin:12px 0}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #eee}.r{text-align:right}.tot{display:flex;justify-content:space-between;padding:2px 0}.grand{font-weight:800;font-size:15px;border-top:2px solid #111;padding-top:6px;margin-top:4px}.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:8px 10px;font-size:11px;margin-top:10px}.btns{margin:16px 0;display:flex;gap:8px;justify-content:center}.btns button{padding:9px 16px;border:0;border-radius:8px;font-weight:600;cursor:pointer}.pbtn{background:#4338CA;color:#fff}.jbtn{background:#eef2ff;color:#4338CA}@media print{.btns,.warn{display:none}}`;
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

/** Printable purchase/dispatch order (save as PDF). 3 templates. */
export function printOrder(o: any, biz?: Biz, template: Template = getTemplate()) {
    const { css, header } = tplBase(template, biz);
    const rows = o.items.map((it: any) => `<tr><td>${it.name}</td><td class="r">${it.quantity}</td><td class="r">${inr2(it.price)}</td><td class="r">${inr2(it.lineTotal)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${o.orderNo}</title>
    <style>${css}</style></head><body>
      ${header}
      <div><b>Order:</b> ${o.orderNo} <span class="muted">(${o.status})</span><br><span class="muted">${new Date(o.createdAt).toLocaleString('en-IN')}</span></div>
      <div style="margin-top:6px"><b>Dealer:</b> ${o.dealerName}${o.dealerGstin ? ' · GSTIN: ' + o.dealerGstin : ''} · via ${o.source}</div><hr>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:12px">
      ${o.totalGst != null ? `<div class="tot"><span>Subtotal</span><span>${inr2(o.subtotal)}</span></div><div class="tot"><span>GST</span><span>${inr2(o.totalGst)}</span></div>` : ''}
      <div class="tot grand"><span>Total</span><span>${inr2(o.total)}</span></div>
      <div class="tot"><span>Paid</span><span>${inr2(o.paidAmount)}</span></div>${o.dueAmount > 0 ? `<div class="tot" style="color:#b45309"><span>Outstanding</span><span>${inr2(o.dueAmount)}</span></div>` : ''}</div>
      <hr><p class="muted" style="text-align:center">Powered by Whoply</p>
      <button onclick="window.print()" style="margin:16px auto;display:block;padding:10px 20px;background:#4338CA;color:#fff;border:0;border-radius:8px;font-weight:600">Print / Save as PDF</button>
      <script>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open('', '_blank', 'width=560,height=720');
    if (w) { w.document.write(html); w.document.close(); }
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
