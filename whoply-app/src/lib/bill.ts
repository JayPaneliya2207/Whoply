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

/** Open a clean printable invoice in a new window and trigger the print/save-as-PDF dialog. */
export function printBill(inv: any, biz?: Biz) {
    const rows = inv.items
        .map(
            (it: any) =>
                `<tr><td>${it.name}</td><td class="r">${it.quantity}</td><td class="r">${inr2(it.price)}</td><td class="r">${it.gstRate}%</td><td class="r">${inr2(it.lineTotal)}</td></tr>`
        )
        .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoiceNo}</title>
    <style>
      *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
      body{max-width:480px;margin:24px auto;color:#111;padding:0 16px}
      h1{font-size:20px;margin:0}
      .muted{color:#666;font-size:12px}
      hr{border:none;border-top:1px dashed #bbb;margin:12px 0}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #eee}
      .r{text-align:right}
      .tot{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
      .grand{font-weight:800;font-size:18px;border-top:2px solid #111;padding-top:8px;margin-top:6px}
      .chip{display:inline-block;background:#eef;color:#334;border-radius:6px;padding:2px 8px;font-size:12px}
      @media print{button{display:none}}
    </style></head><body>
      <h1>${biz?.name || 'Whoply Store'}</h1>
      <p class="muted">${[biz?.address, biz?.city, biz?.state].filter(Boolean).join(', ') || ''}<br>
      ${biz?.gstin ? 'GSTIN: ' + biz.gstin + '<br>' : ''}${biz?.mobile ? 'Ph: ' + (biz.countryCode || '') + ' ' + biz.mobile : ''}</p>
      <hr>
      <div><b>Invoice:</b> ${inv.invoiceNo}<br><span class="muted">${new Date(inv.createdAt).toLocaleString('en-IN')}</span></div>
      ${inv.customerName ? `<div style="margin-top:6px"><b>Bill to:</b> ${inv.customerName}${inv.customerMobile ? ' · ' + inv.customerMobile : ''}</div>` : ''}
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

/** CSV for wholesale orders (client-side). */
export function ordersToCsv(orders: any[]): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Order No', 'Date', 'Dealer', 'Source', 'Items', 'Total', 'Paid', 'Due', 'Status', 'Dispatched', 'Delivered'];
    const lines = orders.map((o) =>
        [o.orderNo, new Date(o.createdAt).toLocaleString('en-IN'), o.dealerName, o.source, o.items?.length || 0, o.total, o.paidAmount, o.dueAmount, o.status,
        o.dispatchedAt ? new Date(o.dispatchedAt).toLocaleDateString('en-IN') : '', o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString('en-IN') : ''].map(esc).join(',')
    );
    return [header.map(esc).join(','), ...lines].join('\n');
}

/** Printable purchase/dispatch order (save as PDF). */
export function printOrder(o: any, biz?: Biz) {
    const rows = o.items.map((it: any) => `<tr><td>${it.name}</td><td class="r">${it.quantity}</td><td class="r">${inr2(it.price)}</td><td class="r">${inr2(it.lineTotal)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${o.orderNo}</title>
    <style>*{font-family:Arial,sans-serif;box-sizing:border-box}body{max-width:520px;margin:24px auto;color:#111;padding:0 16px}h1{font-size:20px;margin:0}.muted{color:#666;font-size:12px}hr{border:none;border-top:1px dashed #bbb;margin:12px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #eee}.r{text-align:right}.tot{display:flex;justify-content:space-between;padding:3px 0}.grand{font-weight:800;font-size:18px;border-top:2px solid #111;padding-top:8px;margin-top:6px}@media print{button{display:none}}</style></head><body>
      <h1>${biz?.name || 'Whoply'}</h1>
      <p class="muted">${[biz?.address, biz?.city, biz?.state].filter(Boolean).join(', ') || ''}${biz?.gstin ? '<br>GSTIN: ' + biz.gstin : ''}</p><hr>
      <div><b>Order:</b> ${o.orderNo} <span class="muted">(${o.status})</span><br><span class="muted">${new Date(o.createdAt).toLocaleString('en-IN')}</span></div>
      <div style="margin-top:6px"><b>Dealer:</b> ${o.dealerName} · via ${o.source}</div><hr>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:12px"><div class="tot grand"><span>Total</span><span>${inr2(o.total)}</span></div>
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
