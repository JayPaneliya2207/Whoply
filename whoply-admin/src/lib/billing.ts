import { inr2 } from '@/lib/cn';

export const day = (d?: string | Date) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
/** The stored period end is the next period's first day — show the last day instead. */
export const periodLabel = (b: { periodStart: string; periodEnd: string }) => `${day(b.periodStart)} – ${day(new Date(+new Date(b.periodEnd) - 864e5))}`;

/** wa.me link that opens WhatsApp with the message ready to send. */
export const waLink = (w: { mobile: string; countryCode?: string; text: string }) =>
    `https://wa.me/${(w.countryCode || '+91').replace(/\D/g, '')}${String(w.mobile).replace(/\D/g, '')}?text=${encodeURIComponent(w.text)}`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Print a subscription bill (a new window with a plain A4 page). */
export function printSubscriptionBill(bill: any, settings: any) {
    const c = settings?.company || {};
    const b = settings?.billing || {};
    const bank = b.bank || {};
    const paid = bill.status === 'paid';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(bill.billNo)}</title><style>
*{box-sizing:border-box}body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;margin:0;padding:32px;font-size:13px}
h1{font-size:20px;margin:0 0 2px}.muted{color:#667085}.row{display:flex;justify-content:space-between;gap:24px}
table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:9px 8px;border-bottom:1px solid #E5E7EB;text-align:left}
th{background:#F3F4F6;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085}.r{text-align:right}
.tot td{font-weight:700;font-size:15px;border-bottom:0}.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:700;font-size:11px;background:${paid ? '#ECFDF5' : '#FFFAEB'};color:${paid ? '#047857' : '#B54708'}}
.box{border:1px solid #E5E7EB;border-radius:10px;padding:12px;margin-top:18px}@media print{body{padding:16px}}
</style></head><body>
<div class="row"><div><h1>${esc(c.name || 'Whoply')}</h1><div class="muted">${esc(c.address)}</div>${c.gstin ? `<div class="muted">GSTIN ${esc(c.gstin)}</div>` : ''}<div class="muted">${[c.email, c.phone].filter(Boolean).map(esc).join(' · ')}</div></div>
<div class="r"><div style="font-size:16px;font-weight:700">${bill.gstRate > 0 ? 'TAX INVOICE' : 'SUBSCRIPTION BILL'}</div><div>${esc(bill.billNo)}</div><div class="muted">Date ${esc(day(bill.createdAt))}</div><div class="muted">Due ${esc(day(bill.dueDate))}</div><div style="margin-top:6px"><span class="tag">${paid ? 'PAID' : bill.status === 'cancelled' ? 'CANCELLED' : 'DUE'}</span></div></div></div>
<div class="box"><div class="muted" style="font-size:11px;text-transform:uppercase">Billed to</div><div style="font-weight:700;font-size:14px">${esc(bill.businessName)}</div><div class="muted">${esc(bill.ownerName)}${bill.ownerMobile ? ` · ${esc(bill.ownerCountryCode || '+91')} ${esc(bill.ownerMobile)}` : ''}</div></div>
<table><thead><tr><th>Description</th><th>Period</th><th class="r">Amount</th></tr></thead><tbody>
<tr><td>Whoply ${esc(bill.planName)} plan${bill.note ? `<div class="muted">${esc(bill.note)}</div>` : ''}</td><td>${esc(periodLabel(bill))}</td><td class="r">${esc(inr2(bill.amount))}</td></tr>
${bill.gstRate > 0 ? `<tr><td colspan="2" class="r muted">GST ${esc(bill.gstRate)}% (SAC 998314)</td><td class="r">${esc(inr2(bill.gstAmount))}</td></tr>` : ''}
<tr class="tot"><td colspan="2" class="r">Total</td><td class="r">${esc(inr2(bill.total))}</td></tr></tbody></table>
${paid ? `<div class="box">Paid on ${esc(day(bill.paidAt))} by ${esc(String(bill.paidMode || '').toUpperCase())}${bill.paidRef ? ` · Ref ${esc(bill.paidRef)}` : ''}. Thank you.</div>` : `<div class="box"><b>How to pay</b>${b.upiId ? `<div>UPI: ${esc(b.upiId)}</div>` : ''}${bank.account ? `<div>Bank: ${esc(bank.name)} · A/C ${esc(bank.account)} · IFSC ${esc(bank.ifsc)} · ${esc(bank.holder || c.name)}</div>` : ''}${!b.upiId && !bank.account ? '<div class="muted">Contact Whoply support.</div>' : ''}</div>`}
<p class="muted" style="margin-top:24px">This is a computer-generated bill.</p>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to print the bill.'); return; }
    w.document.write(html);
    w.document.close();
}
