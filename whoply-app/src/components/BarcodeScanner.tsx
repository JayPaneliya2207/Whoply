'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ScanLine, X, Keyboard, Camera } from 'lucide-react';

/**
 * Barcode scanning that works two ways with zero extra dependencies:
 *  1. Camera — uses the browser's native BarcodeDetector (Chrome / Android WebView / Edge).
 *  2. USB / bluetooth laser scanners — behave as keyboards; the useWedgeScanner hook
 *     buffers their rapid keystrokes and fires on Enter, so a counter scan "just works".
 * A manual type-in field is always offered as a fallback.
 */

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar', 'itf'];

/** Global keyboard-wedge listener: hardware scanners type fast + press Enter. */
export function useWedgeScanner(onScan: (code: string) => void, enabled = true) {
    const buf = useRef('');
    const last = useRef(0);
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null;
            const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
            const now = Date.now();
            if (now - last.current > 80) buf.current = ''; // gap too long → human typing, reset
            last.current = now;
            if (e.key === 'Enter') {
                const code = buf.current.trim();
                buf.current = '';
                if (code.length >= 4 && !typing) { e.preventDefault(); onScan(code); }
                return;
            }
            if (e.key.length === 1) buf.current += e.key;
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onScan, enabled]);
}

export function ScanButton({ onScan, className = 'wp-btn wp-btn-ghost shrink-0', label }: { onScan: (code: string) => void; className?: string; label?: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" className={className} onClick={() => setOpen(true)} title="Scan barcode">
                <ScanLine size={16} /> {label}
            </button>
            {open && <ScannerModal onClose={() => setOpen(false)} onScan={(c) => { onScan(c); setOpen(false); }} />}
        </>
    );
}

function ScannerModal({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [manual, setManual] = useState('');
    const [err, setErr] = useState('');
    const [scanning, setScanning] = useState(false);
    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    // keyboard-wedge works even while the modal is open
    useWedgeScanner((c) => onScan(c));

    const stopRef = useRef<() => void>(() => {});
    const start = useCallback(async () => {
        if (!supported) { setErr('This device has no built-in scanner. Use a USB scanner or type the code below.'); return; }
        try {
            setErr(''); setScanning(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = videoRef.current!;
            video.srcObject = stream;
            await video.play();
            // @ts-expect-error — BarcodeDetector is not yet in TS lib.dom
            const detector = new window.BarcodeDetector({ formats: FORMATS });
            let active = true;
            stopRef.current = () => { active = false; stream.getTracks().forEach((t) => t.stop()); };
            const loop = async () => {
                if (!active) return;
                try {
                    const codes = await detector.detect(video);
                    if (codes[0]?.rawValue) { onScan(codes[0].rawValue); return; }
                } catch { /* frame not ready */ }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        } catch {
            setScanning(false);
            setErr('Camera unavailable. Use a USB scanner or type the code below.');
        }
    }, [supported, onScan]);

    useEffect(() => { start(); return () => stopRef.current(); }, [start]);

    return (
        <div className="fixed inset-0 z-[95] bg-black/60 grid place-items-center p-4" onClick={onClose}>
            <div className="wp-card w-full max-w-sm p-5" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Camera size={18} /> Scan barcode</h3>
                    <button onClick={onClose}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
                </div>

                <div className="relative rounded-xl overflow-hidden mb-3" style={{ background: '#000', aspectRatio: '4/3' }}>
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    {scanning && (
                        <div className="absolute inset-0 pointer-events-none grid place-items-center">
                            <div className="w-3/4 h-20 rounded-lg" style={{ border: '2px solid rgba(255,255,255,.85)', boxShadow: '0 0 0 100vmax rgba(0,0,0,.25) inset' }} />
                        </div>
                    )}
                    {!scanning && !err && <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">Starting camera…</div>}
                </div>

                {err && <p className="text-xs mb-3 flex items-start gap-1.5" style={{ color: 'var(--accent-600)' }}><ScanLine size={14} className="mt-0.5 shrink-0" /> {err}</p>}

                <p className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><Keyboard size={13} /> Or enter the code manually</p>
                <form onSubmit={(e) => { e.preventDefault(); if (manual.trim().length >= 4) onScan(manual.trim()); }} className="flex gap-2">
                    <input autoFocus className="wp-input text-sm" placeholder="Barcode number" value={manual} onChange={(e) => setManual(e.target.value.replace(/\s/g, ''))} inputMode="numeric" />
                    <button type="submit" className="wp-btn wp-btn-primary shrink-0" disabled={manual.trim().length < 4}>Add</button>
                </form>
            </div>
        </div>
    );
}
