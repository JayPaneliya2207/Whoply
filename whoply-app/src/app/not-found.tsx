import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

/** Any address the app has no screen for. */
export default function NotFound() {
    return (
        <main className="min-h-dvh grid place-items-center px-5 py-10" style={{ background: 'var(--background)' }}>
            <div className="wp-card w-full max-w-sm p-7 text-center">
                <div className="mx-auto h-14 w-14 grid place-items-center rounded-2xl" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>
                    <SearchX size={26} />
                </div>
                <p className="mt-5 text-5xl font-extrabold tabular leading-none" style={{ color: 'var(--text-primary)' }}>404</p>
                <h1 className="mt-3 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>This screen does not exist</h1>
                <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>The link may be old, or the address was typed wrong.</p>
                <Link href="/dashboard" className="wp-btn wp-btn-primary w-full mt-6"><Home size={16} /> Go to home</Link>
            </div>
        </main>
    );
}
