'use client';
import { useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7200';
const links = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
];

export function Nav() {
    const [open, setOpen] = useState(false);
    return (
        <header className="sticky top-0 z-40 backdrop-blur" style={{ background: 'rgba(248,250,252,0.8)', borderBottom: '1px solid var(--card-border)' }}>
            <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
                <Logo size={30} />
                <nav className="hidden md:flex items-center gap-8">
                    {links.map((l) => (
                        <a key={l.href} href={l.href} className="text-sm font-medium hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                            {l.label}
                        </a>
                    ))}
                </nav>
                <div className="hidden md:flex items-center gap-3">
                    <a href={`${APP_URL}/login`} className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Login</a>
                    <a href={`${APP_URL}/login`} className="wp-btn wp-btn-primary">Get started <ArrowRight size={16} /></a>
                </div>
                <button className="md:hidden" onClick={() => setOpen((v) => !v)}>{open ? <X /> : <Menu />}</button>
            </div>
            {open && (
                <div className="md:hidden px-5 pb-4 space-y-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                    {links.map((l) => (
                        <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{l.label}</a>
                    ))}
                    <a href={`${APP_URL}/login`} className="wp-btn wp-btn-primary w-full">Get started</a>
                </div>
            )}
        </header>
    );
}
