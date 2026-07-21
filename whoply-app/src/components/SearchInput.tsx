'use client';
import { Search, X } from 'lucide-react';

/** Consistent search field with a properly-centered icon and clear button. */
export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="relative w-full">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
                className="wp-input pl-11 pr-9"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ fontSize: 16 }}
            />
            {value && (
                <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear">
                    <X size={16} style={{ color: 'var(--text-muted)' }} />
                </button>
            )}
        </div>
    );
}
