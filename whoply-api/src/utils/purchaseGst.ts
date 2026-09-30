/**
 * Input tax credit (ITC) from purchase orders, for the GST report of a month.
 *
 * A purchase counts in the month its goods were RECEIVED (GST allows credit once
 * both the goods and the supplier's bill are in hand). Only registered suppliers
 * (with a GSTIN) give credit; GST paid to others is listed as "no credit".
 * Orders made before GST on purchases (no totalGst) carry no credit.
 * Tax is IGST when the supplier is in another state, else CGST + SGST.
 */
import type { Types } from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { splitTax } from './gstSplit.js';

const r2 = (n: number) => +(+n || 0).toFixed(2);

export async function purchaseCredit(businessId: Types.ObjectId, from: Date, to: Date) {
    const pos = await PurchaseOrder.find({ businessId, status: 'received', receivedAt: { $gte: from, $lt: to } })
        .select('poNo supplierName supplierGstin supplierInvoiceNo supplierInvoiceDate subtotal totalGst interState total receivedAt items.gstRate items.taxableValue items.gstAmount')
        .sort({ receivedAt: 1 })
        .lean();

    const bills: any[] = [];
    const byRate = new Map<number, { taxable: number; gst: number; igst: number }>();
    let noCreditBills = 0;
    let noCreditGst = 0;
    for (const po of pos) {
        const gst = po.totalGst ?? 0;
        if (!po.supplierGstin || po.totalGst == null) {
            noCreditBills++;
            noCreditGst += gst;
            continue;
        }
        const igst = po.interState ? gst : 0;
        bills.push({
            poNo: po.poNo,
            supplierGstin: po.supplierGstin,
            supplierName: po.supplierName,
            supplierInvoiceNo: po.supplierInvoiceNo || '',
            supplierInvoiceDate: po.supplierInvoiceDate || null,
            receivedAt: po.receivedAt,
            taxable: r2(po.subtotal ?? 0),
            ...splitTax(gst, igst),
            gst: r2(gst),
            total: r2(po.total),
        });
        for (const it of po.items || []) {
            const rate = it.gstRate || 0;
            const row = byRate.get(rate) || { taxable: 0, gst: 0, igst: 0 };
            row.taxable += it.taxableValue || 0;
            row.gst += it.gstAmount || 0;
            if (po.interState) row.igst += it.gstAmount || 0;
            byRate.set(rate, row);
        }
    }
    const sum = (k: string) => r2(bills.reduce((a, b) => a + (b[k] || 0), 0));
    return {
        bills: bills.length,
        taxable: sum('taxable'),
        igst: sum('igst'),
        cgst: sum('cgst'),
        sgst: sum('sgst'),
        total: sum('gst'),
        missingBillNo: bills.filter((b) => !b.supplierInvoiceNo).length,
        rateWise: [...byRate].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, taxable: r2(v.taxable), ...splitTax(v.gst, v.igst), gst: r2(v.gst) })),
        list: bills,
        noCredit: { bills: noCreditBills, gst: r2(noCreditGst) },
    };
}
