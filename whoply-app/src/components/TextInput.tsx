'use client';
import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * Standard text input with a properly-centered optional left icon.
 * Keeps icon alignment consistent everywhere (search, password, etc.).
 */
export function TextInput({
    icon,
    right,
    ...props
}: { icon?: ReactNode; right?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="relative w-full">
            {icon && (
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none grid place-items-center" style={{ color: 'var(--text-muted)' }}>
                    {icon}
                </span>
            )}
            <input {...props} className={`wp-input ${icon ? 'pl-11' : ''} ${right ? 'pr-10' : ''} ${props.className || ''}`} style={{ fontSize: 16, ...props.style }} />
            {right && <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>}
        </div>
    );
}
