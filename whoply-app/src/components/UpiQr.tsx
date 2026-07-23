'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { inr2 } from '@/lib/cn';

/**
 * UPI collect at billing.
 *  - If the shop uploaded a QR image, show that (their real static QR).
 *  - Else if a UPI ID is set, generate a scannable dynamic QR (amount pre-filled).
 *  - Else prompt to set it up in Settings.
 * The UPI ID is always shown alongside the code. Configure in Settings → Shop details.
 */
export function UpiQr({ amount, upiId, qrImage, shopName, onClose }: { amount: number; note?: string; upiId?: string; qrImage?: string; shopName?: string; onClose: () => void }) {
    const [gen, setGen] = useState('');
    useEffect(() => {
        // Only generate from the UPI ID when there's no uploaded image.
        if (qrImage || !upiId) { setGen(''); return; }
        const intent = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName || 'Shop')}${amount > 0 ? `&am=${amount.toFixed(2)}` : ''}&cu=INR`;
        QRCode.toDataURL(intent, { width: 260, margin: 1, errorCorrectionLevel: 'M' }).then(setGen).catch(() => setGen(''));
    }, [upiId, qrImage, shopName, amount]);

    const qrSrc = qrImage || gen;
    const has = !!(qrSrc || upiId);

    return (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-[90] p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="wp-card p-6 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{has ? 'Scan to pay' : 'UPI not set up'}</p>
                    <button onClick={onClose}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
                </div>

                {qrSrc ? (
                    <div className="grid place-items-center py-1">
                        <img src={qrSrc} alt="UPI QR" className="w-52 h-52 rounded-xl object-contain" style={{ border: '1px solid var(--card-border)', background: '#fff' }} />
                    </div>
                ) : upiId ? (
                    <div className="w-52 h-52 mx-auto grid place-items-center rounded-xl" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Generating QR…</div>
                ) : (
                    <p className="text-sm py-6" style={{ color: 'var(--text-secondary)' }}>Add your UPI ID or upload your QR in <b>Settings → Shop details</b> to collect payments here.</p>
                )}

                {has && <p className="text-2xl font-extrabold tabular mt-3" style={{ color: 'var(--text-primary)' }}>{inr2(amount)}</p>}
                {upiId && <p className="text-sm break-all mt-0.5" style={{ color: 'var(--text-secondary)' }}>{upiId}</p>}
                {shopName && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{shopName}</p>}
                {has && (
                    <p className="text-xs mt-3 flex items-center justify-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Smartphone size={12} /> Scan with any UPI app (PhonePe / GPay / Paytm)
                    </p>
                )}
            </motion.div>
        </div>
    );
}
