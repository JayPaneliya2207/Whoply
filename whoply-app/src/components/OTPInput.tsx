'use client';
import React, { useRef, useCallback } from 'react';

/** 6-box OTP input with auto-advance, paste, and auto-submit on completion. */
export function OTPInput({
    value,
    onChange,
    onComplete,
    disabled,
}: {
    value: string[];
    onChange: (otp: string[]) => void;
    onComplete: (otp: string) => void;
    disabled?: boolean;
}) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    const submitted = useRef(false);

    const maybeComplete = useCallback((arr: string[]) => {
        const s = arr.join('');
        if (s.length === 6 && !submitted.current) {
            submitted.current = true;
            setTimeout(() => onComplete(s), 80);
        }
        if (s.length < 6) submitted.current = false;
    }, [onComplete]);

    const setDigit = (i: number, raw: string) => {
        if (raw.length > 1) {
            const digits = raw.replace(/\D/g, '').slice(0, 6);
            if (digits.length > 1) {
                const next = ['', '', '', '', '', ''];
                digits.split('').forEach((d, k) => (next[k] = d));
                onChange(next);
                maybeComplete(next);
                refs.current[Math.min(digits.length, 5)]?.focus();
                return;
            }
        }
        const digit = raw.replace(/\D/g, '').slice(-1);
        const next = [...value];
        next[i] = digit;
        onChange(next);
        if (digit && i < 5) refs.current[i + 1]?.focus();
        if (digit && i === 5) maybeComplete(next);
    };

    const onKey = (i: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !value[i] && i > 0) {
            refs.current[i - 1]?.focus();
            const next = [...value];
            next[i - 1] = '';
            onChange(next);
        }
    };

    const onPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!p) return;
        const next = ['', '', '', '', '', ''];
        p.split('').forEach((d, k) => (next[k] = d));
        onChange(next);
        maybeComplete(next);
        refs.current[Math.min(p.length, 5)]?.focus();
    };

    return (
        <div className="flex justify-center gap-2">
            {value.map((digit, i) => (
                <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    disabled={disabled}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKey(i, e)}
                    onPaste={onPaste}
                    onFocus={(e) => e.target.select()}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    className="w-11 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all"
                    style={{ background: 'var(--card-bg)', border: '2px solid var(--card-border)', color: 'var(--text-primary)' }}
                    onFocusCapture={(e) => (e.currentTarget.style.borderColor = 'var(--brand-600)')}
                    onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                />
            ))}
        </div>
    );
}
