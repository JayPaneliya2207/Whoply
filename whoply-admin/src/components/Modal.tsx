'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Gesture-dismissable modal. On mobile it's a bottom sheet you can swipe down to
 * close; on desktop a centered card. Backdrop tap + Esc also close it.
 */
export function Modal({
    open,
    onClose,
    title,
    children,
    footer,
}: {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        if (open) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
                    <motion.div
                        className="absolute inset-0 bg-black/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="relative w-full sm:max-w-lg wp-card !rounded-b-none sm:!rounded-3xl max-h-[92vh] flex flex-col"
                        style={{ boxShadow: 'var(--shadow-lg)' }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 130 || info.velocity.y > 600) onClose();
                        }}
                    >
                        {/* drag handle */}
                        <div className="pt-3 pb-1 grid place-items-center sm:hidden cursor-grab active:cursor-grabbing shrink-0">
                            <div className="h-1.5 w-11 rounded-full" style={{ background: 'var(--card-border)' }} />
                        </div>
                        <div className="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 shrink-0">
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                            <button onClick={onClose} aria-label="Close"><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
                        </div>
                        <div className="px-5 pb-5 overflow-y-auto wp-scroll flex-1">{children}</div>
                        {footer && <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--card-border)' }}>{footer}</div>}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

/** Small labelled field wrapper for forms inside modals. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block mb-3">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <div className="mt-1.5">{children}</div>
        </label>
    );
}
