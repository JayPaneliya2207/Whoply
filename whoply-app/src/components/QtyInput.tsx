'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { cleanQty, isLooseUnit } from '@/lib/qty';

/**
 * Quantity you can type — 48 pcs, or 2.5 kg for loose goods — for carts that
 * also have − / + buttons. What's being typed is kept as text, so "2." or
 * "0.25" can be entered; only a valid amount above 0 is passed on (capped at
 * `max`, e.g. stock). Leaving the box with nothing valid puts the old value back.
 */
export function QtyInput({
    value,
    unit,
    max,
    onChange,
    label,
    className,
}: {
    value: number;
    unit?: string;
    max?: number;
    onChange: (qty: number) => void;
    label: string;
    className?: string;
}) {
    const [draft, setDraft] = useState(String(value));
    const [focused, setFocused] = useState(false);
    // Follow changes from the − / + buttons, but not while the user is typing.
    useEffect(() => { if (!focused) setDraft(String(value)); }, [value, focused]);

    const loose = isLooseUnit(unit);
    const commit = (text: string) => {
        const n = cleanQty(Number(text), unit);
        if (!Number.isFinite(n) || n <= 0) return;
        onChange(max != null ? Math.min(n, max) : n);
    };

    return (
        <input
            aria-label={label}
            className={cn('wp-input !px-1 !py-1 text-center text-sm font-bold tabular', className)}
            inputMode={loose ? 'decimal' : 'numeric'}
            value={draft}
            onFocus={(e) => { setFocused(true); e.target.select(); }}
            onChange={(e) => {
                // Digits only (plus one decimal point for loose goods).
                const text = e.target.value.replace(loose ? /[^\d.]/g : /\D/g, '').replace(/(\..*)\./g, '$1');
                setDraft(text);
                commit(text);
            }}
            onBlur={() => { setFocused(false); setDraft(String(value)); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
    );
}
