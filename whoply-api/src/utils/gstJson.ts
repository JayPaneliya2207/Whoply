/**
 * GST e-invoice (IRP/NIC schema v1.1) and e-way bill JSON builders.
 * These produce the offline JSON payloads a business uploads to the government
 * portal (or hands to a GSP) — Whoply does not submit to the IRP directly, so the
 * IRN/signed-QR come back from the portal. CGST/SGST assume intra-state supply.
 *
 * Works for BOTH retail invoices and wholesale orders via a normalized `GstDoc`.
 */
import type { IBusinessDocument } from '../models/Business.js';

export interface GstDocItem {
    name: string;
    hsn?: string;
    unit?: string;
    quantity: number;
    price: number; // per unit, pre-tax
    gstRate: number;
    gstAmount: number;
}
export interface GstDoc {
    docNo: string;
    date: Date;
    buyerName?: string;
    buyerGstin?: string;
    items: GstDocItem[];
    subtotal: number;
    totalGst: number;
    discount?: number;
    grandTotal: number;
}

/** Normalize a retail Invoice into a GstDoc. */
export function invoiceToGstDoc(inv: any): GstDoc {
    return {
        docNo: inv.invoiceNo, date: inv.createdAt, buyerName: inv.customerName, buyerGstin: inv.customerGstin,
        items: inv.items, subtotal: inv.subtotal, totalGst: inv.totalGst, discount: inv.discount, grandTotal: inv.grandTotal,
    };
}
/** Normalize a wholesale Order into a GstDoc. */
export function orderToGstDoc(o: any): GstDoc {
    const subtotal = o.subtotal ?? o.items.reduce((s: number, it: any) => s + it.price * it.quantity, 0);
    return {
        docNo: o.orderNo, date: o.createdAt, buyerName: o.dealerName, buyerGstin: o.dealerGstin,
        items: o.items.map((it: any) => ({ name: it.name, hsn: it.hsn, unit: it.unit, quantity: it.quantity, price: it.price, gstRate: it.gstRate || 0, gstAmount: it.gstAmount || 0 })),
        subtotal, totalGst: o.totalGst ?? 0, discount: 0, grandTotal: o.total,
    };
}

const ddmmyyyy = (d: Date) => {
    const x = new Date(d);
    return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};
const stateCode = (gstin?: string) => (gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '');
const r2 = (n: number) => +(+n || 0).toFixed(2);

export function buildEInvoiceJson(biz: IBusinessDocument, doc: GstDoc) {
    const b2b = !!doc.buyerGstin;
    const sellerSt = stateCode(biz.gstin);
    const buyerSt = b2b ? stateCode(doc.buyerGstin) : sellerSt;
    const intra = sellerSt === buyerSt;

    const items = doc.items.map((it, i) => {
        const assAmt = r2(it.price * it.quantity);
        const gst = r2(it.gstAmount);
        return {
            SlNo: String(i + 1), PrdDesc: it.name, IsServc: 'N', HsnCd: it.hsn || '', Qty: it.quantity,
            Unit: (it.unit || 'PCS').toUpperCase().slice(0, 3), UnitPrice: r2(it.price), TotAmt: assAmt, AssAmt: assAmt,
            GstRt: it.gstRate, IgstAmt: intra ? 0 : gst, CgstAmt: intra ? r2(gst / 2) : 0, SgstAmt: intra ? r2(gst / 2) : 0, TotItemVal: r2(assAmt + gst),
        };
    });

    const assVal = r2(doc.subtotal);
    const totGst = r2(doc.totalGst);
    return {
        Version: '1.1',
        TranDtls: { TaxSch: 'GST', SupTyp: b2b ? 'B2B' : 'B2C', RegRev: 'N', IgstOnIntra: 'N' },
        DocDtls: { Typ: 'INV', No: doc.docNo, Dt: ddmmyyyy(doc.date) },
        SellerDtls: { Gstin: biz.gstin || '', LglNm: biz.name, Addr1: biz.address || biz.city || '-', Loc: biz.city || '-', Pin: Number(biz.pincode) || undefined, Stcd: sellerSt },
        BuyerDtls: { Gstin: b2b ? doc.buyerGstin : 'URP', LglNm: doc.buyerName || 'Walk-in customer', Pos: buyerSt || sellerSt, Addr1: '-', Loc: biz.city || '-', Pin: Number(biz.pincode) || undefined, Stcd: buyerSt || sellerSt },
        ItemList: items,
        ValDtls: { AssVal: assVal, CgstVal: intra ? r2(totGst / 2) : 0, SgstVal: intra ? r2(totGst / 2) : 0, IgstVal: intra ? 0 : totGst, Discount: r2(doc.discount || 0), TotInvVal: r2(doc.grandTotal) },
    };
}

export interface Transport {
    transMode?: string; vehicleNo?: string; transporterName?: string; transporterId?: string; distance?: number;
}

export function buildEWayBillJson(biz: IBusinessDocument, doc: GstDoc, tr: Transport) {
    const b2b = !!doc.buyerGstin;
    const sellerSt = stateCode(biz.gstin);
    const buyerSt = b2b ? stateCode(doc.buyerGstin) : sellerSt;
    const intra = sellerSt === buyerSt;

    const itemList = doc.items.map((it) => ({
        productName: it.name, hsnCode: it.hsn || '', quantity: it.quantity, qtyUnit: (it.unit || 'PCS').toUpperCase().slice(0, 3),
        taxableAmount: r2(it.price * it.quantity), cgstRate: intra ? it.gstRate / 2 : 0, sgstRate: intra ? it.gstRate / 2 : 0, igstRate: intra ? 0 : it.gstRate,
    }));

    return {
        supplyType: 'O', subSupplyType: '1', docType: 'INV', docNo: doc.docNo, docDate: ddmmyyyy(doc.date),
        fromGstin: biz.gstin || '', fromTrdName: biz.name, fromAddr1: biz.address || '-', fromPlace: biz.city || '-', fromPincode: Number(biz.pincode) || 0, fromStateCode: Number(sellerSt) || 0,
        toGstin: b2b ? doc.buyerGstin : 'URP', toTrdName: doc.buyerName || 'Walk-in customer', toAddr1: '-', toPlace: biz.city || '-', toPincode: Number(biz.pincode) || 0, toStateCode: Number(buyerSt || sellerSt) || 0,
        totalValue: r2(doc.subtotal), cgstValue: intra ? r2(doc.totalGst / 2) : 0, sgstValue: intra ? r2(doc.totalGst / 2) : 0, igstValue: intra ? 0 : r2(doc.totalGst), totInvValue: r2(doc.grandTotal),
        transporterId: tr.transporterId || '', transporterName: tr.transporterName || '', transMode: tr.transMode || '1',
        transDistance: String(tr.distance || 0), vehicleNo: (tr.vehicleNo || '').toUpperCase().replace(/\s/g, ''), vehicleType: 'R',
        itemList,
    };
}
