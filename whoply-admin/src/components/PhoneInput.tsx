'use client';
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, PLACEHOLDERS } from '@/lib/forms';

/**
 * Mobile-number field with a country-code picker (defaults to India +91 🇮🇳).
 * `value` is the national number (digits only); `country` is the dial code.
 */
export function PhoneInput({
    value,
    onChange,
    country = DEFAULT_COUNTRY.code,
    onCountryChange,
    disabled,
    autoFocus,
}: {
    value: string;
    onChange: (v: string) => void;
    country?: string;
    onCountryChange?: (code: string) => void;
    disabled?: boolean;
    autoFocus?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const current = COUNTRIES.find((c) => c.code === country) || DEFAULT_COUNTRY;

    return (
        <div className="flex gap-2">
            <div className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onCountryChange && setOpen((v) => !v)}
                    className="h-full flex items-center gap-1.5 px-3 rounded-xl text-sm font-medium whitespace-nowrap disabled:opacity-60"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
                >
                    <span className="text-base">{current.flag}</span> {current.code}
                    {onCountryChange && <ChevronDown size={14} />}
                </button>
                {open && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                        <div className="absolute left-0 top-full mt-1 w-56 wp-card p-1.5 z-50 max-h-64 overflow-y-auto wp-scroll" style={{ boxShadow: 'var(--shadow-lg)' }}>
                            {COUNTRIES.map((c) => (
                                <button key={c.iso} type="button" onClick={() => { onCountryChange?.(c.code); setOpen(false); }}
                                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm"
                                    style={c.code === country ? { background: 'var(--surface-2)', color: 'var(--brand-700)' } : { color: 'var(--text-secondary)' }}>
                                    <span className="text-base">{c.flag}</span>
                                    <span className="flex-1 text-left truncate">{c.name}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{c.code}</span>
                                    {c.code === country && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <input
                type="tel"
                inputMode="numeric"
                placeholder={PLACEHOLDERS.mobile}
                value={value}
                disabled={disabled}
                autoFocus={autoFocus}
                maxLength={current.maxLen}
                onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, current.maxLen))}
                className="wp-input flex-1 min-w-0"
                style={{ fontSize: 16 }}
            />
        </div>
    );
}
