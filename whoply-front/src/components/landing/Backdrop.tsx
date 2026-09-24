export type BackdropVariant = 'glow' | 'grid' | 'tint' | 'navy' | 'pricing' | 'faq' | 'retail';

/**
 * What sits behind a section: drifting colour blobs and a faint pattern, so
 * flat backgrounds have some depth. Pure CSS, decorative, never in the way of
 * content — the section's content wrapper stacks above it.
 */
export function Backdrop({ variant }: { variant: BackdropVariant }) {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {variant === 'glow' && (
                <>
                    <div className="blob drift-a -top-[12%] -left-[8%] h-[60vw] w-[60vw] max-h-[560px] max-w-[560px] bg-sand/50" />
                    <div className="blob drift-b -right-[10%] -bottom-[18%] h-[55vw] w-[55vw] max-h-[520px] max-w-[520px] bg-accent-tint" />
                    <div className="hidden md:block blob drift-a top-[40%] left-[55%] h-[36vw] w-[36vw] max-h-[340px] max-w-[340px] bg-navy-tint" />
                </>
            )}
            {variant === 'grid' && (
                <>
                    <div className="bg-grid absolute inset-0" />
                    <div className="blob drift-b -top-[10%] right-[5%] h-[50vw] w-[50vw] max-h-[480px] max-w-[480px] bg-sand/40" />
                </>
            )}
            {variant === 'tint' && (
                <>
                    <div className="blob drift-a -top-[14%] left-[10%] h-[55vw] w-[55vw] max-h-[520px] max-w-[520px] bg-white" />
                    <div className="blob drift-b right-[-8%] bottom-[-10%] h-[45vw] w-[45vw] max-h-[440px] max-w-[440px] bg-sand/45" />
                </>
            )}
            {variant === 'pricing' && (
                <>
                    {/* Warm peach and orange pooled behind the plans, slate at the edges, all breathing slowly. */}
                    <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_58%,rgb(255_237_213/0.9)_0%,transparent_70%)]" />
                    <div className="mesh-blob mesh-a top-[28%] left-[16%] h-[42vw] w-[42vw] max-h-[460px] max-w-[460px] bg-[#fdba74]/45" />
                    <div className="mesh-blob mesh-b top-[38%] right-[14%] h-[40vw] w-[40vw] max-h-[440px] max-w-[440px] bg-[#fed7aa]/40" />
                    <div className="mesh-blob mesh-c -top-[10%] -left-[12%] h-[38vw] w-[38vw] max-h-[420px] max-w-[420px] bg-slate-300/45" />
                    <div className="mesh-blob mesh-a -right-[10%] -bottom-[12%] h-[38vw] w-[38vw] max-h-[420px] max-w-[420px] bg-slate-400/25" />
                </>
            )}
            {variant === 'faq' && (
                <>
                    {/* Faint dot grid, and a soft spotlight where the questions sit. */}
                    <div className="faq-dots absolute inset-0" />
                    <div className="absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_50%,rgb(255_247_237/0.95)_0%,rgb(255_237_213/0.55)_40%,transparent_75%)]" />
                    <div className="mesh-blob mesh-a top-[30%] left-[30%] h-[40vw] w-[40vw] max-h-[420px] max-w-[420px] bg-[#fed7aa]/40" />
                </>
            )}
            {variant === 'retail' && (
                <>
                    {/* A slowly shifting cream → peach → navy-tint wash, glows on top, and the line grid. */}
                    <div className="retail-aurora absolute inset-0" />
                    <div className="mesh-blob mesh-a -top-[10%] -left-[8%] h-[46vw] w-[46vw] max-h-[520px] max-w-[520px] bg-[#fdba74]/40" />
                    <div className="mesh-blob mesh-b top-[35%] -right-[10%] h-[44vw] w-[44vw] max-h-[500px] max-w-[500px] bg-navy/10" />
                    <div className="mesh-blob mesh-c -bottom-[12%] left-[30%] h-[40vw] w-[40vw] max-h-[460px] max-w-[460px] bg-[#fed7aa]/35" />
                    <div className="bg-grid absolute inset-0 opacity-70" />
                </>
            )}
            {variant === 'navy' && (
                <>
                    <div className="bg-dots-navy absolute inset-0" />
                    <div className="blob drift-a -top-[20%] left-[20%] h-[60vw] w-[60vw] max-h-[600px] max-w-[600px] bg-navy-light/70" />
                    <div className="blob drift-b -right-[12%] bottom-[-15%] h-[45vw] w-[45vw] max-h-[460px] max-w-[460px] bg-accent/20" />
                    <div className="hidden md:block blob drift-a bottom-[10%] left-[-8%] h-[35vw] w-[35vw] max-h-[340px] max-w-[340px] bg-sand/15" />
                </>
            )}
        </div>
    );
}
