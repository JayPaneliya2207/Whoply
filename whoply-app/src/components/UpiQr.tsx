'use client';
import { motion } from 'framer-motion';
import { X, Smartphone } from 'lucide-react';
import { inr2 } from '@/lib/cn';

/**
 * UPI collect (stub). Renders a decorative QR built from the UPI intent string.
 * Real Razorpay/UPI intent + a proper QR lib drop in here later.
 */
function FauxQR({ seed }: { seed: string }) {
    // deterministic 21x21 pattern from the seed — looks like a QR, clearly a demo
    const size = 21;
    const cells: boolean[] = [];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    for (let i = 0; i < size * size; i++) {
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        cells.push((h >> 5) % 100 < 48);
    }
    const finder = (x: number, y: number) =>
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-48 h-48" shapeRendering="crispEdges">
            <rect width={size} height={size} fill="#fff" />
            {cells.map((on, i) => {
                const x = i % size, y = Math.floor(i / size);
                if (finder(x, y)) return null;
                return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#0f172a" /> : null;
            })}
            {[[0, 0], [size - 7, 0], [0, size - 7]].map(([fx, fy], k) => (
                <g key={k}>
                    <rect x={fx} y={fy} width={7} height={7} fill="#0f172a" />
                    <rect x={fx + 1} y={fy + 1} width={5} height={5} fill="#fff" />
                    <rect x={fx + 2} y={fy + 2} width={3} height={3} fill="#4338CA" />
                </g>
            ))}
        </svg>
    );
}

export function UpiQr({ amount, note, onClose }: { amount: number; note: string; onClose: () => void }) {
    const vpa = 'sharma.store@whoply';
    const intent = `upi://pay?pa=${vpa}&pn=Sharma%20General%20Store&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    return (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-[60] p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="wp-card p-6 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Scan to pay</p>
                    <button onClick={onClose}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
                </div>
                <div className="grid place-items-center py-2"><FauxQR seed={intent} /></div>
                <p className="text-2xl font-extrabold tabular mt-2" style={{ color: 'var(--text-primary)' }}>{inr2(amount)}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{vpa}</p>
                <p className="text-xs mt-3 flex items-center justify-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Smartphone size={12} /> UPI collect (demo) · auto-reconciles on payment
                </p>
            </motion.div>
        </div>
    );
}
