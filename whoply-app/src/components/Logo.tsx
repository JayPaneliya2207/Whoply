import { cn } from '@/lib/cn';

/** Whoply wordmark + mark. The mark is a stylized "W" shopfront in brand indigo/amber. */
export function Logo({ className, showText = true, size = 32 }: { className?: string; showText?: boolean; size?: number }) {
    return (
        <div className={cn('flex items-center gap-2.5', className)}>
            <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="11" fill="var(--brand-700)" />
                <path d="M9 13.5L14 27L20 16L26 27L31 13.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="10.5" r="2.4" fill="var(--accent-500)" />
            </svg>
            {showText && (
                <span className="font-extrabold tracking-tight text-[1.25rem]" style={{ color: 'var(--text-primary)' }}>
                    Whoply
                </span>
            )}
        </div>
    );
}
