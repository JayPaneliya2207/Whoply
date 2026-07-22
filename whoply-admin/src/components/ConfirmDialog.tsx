'use client';
import { Modal } from '@/components/Modal';
import { AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Delete',
    danger = true,
    loading = false,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
}) {
    return (
        <Modal open={open} onClose={onClose} title={title}
            footer={
                <div className="flex gap-2">
                    <button className="wp-btn wp-btn-ghost flex-1" onClick={onClose}>Cancel</button>
                    <button className={`wp-btn flex-1 ${danger ? '' : 'wp-btn-primary'}`} disabled={loading} onClick={onConfirm}
                        style={danger ? { background: 'var(--danger-500)', color: '#fff' } : {}}>
                        {loading ? 'Please wait…' : confirmLabel}
                    </button>
                </div>
            }>
            <div className="flex items-start gap-3">
                {danger && <div className="h-10 w-10 grid place-items-center rounded-full shrink-0" style={{ background: '#fee2e2', color: 'var(--danger-500)' }}><AlertTriangle size={20} /></div>}
                <p className="text-sm pt-1" style={{ color: 'var(--text-secondary)' }}>{message}</p>
            </div>
        </Modal>
    );
}
