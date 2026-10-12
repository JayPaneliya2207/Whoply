'use client';
import { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2, Smartphone } from 'lucide-react';
import { apiErr } from '@/lib/api';
import { pushState, enablePush, disablePush, sendTestPush, type PushState } from '@/lib/push';
import { useT } from '@/i18n';

/**
 * The switch for phone notifications on this device, shown above the
 * notification list. Says plainly why when it can't be offered (blocked in
 * the browser, or not the installed app); shows nothing when the server has
 * no push keys.
 */
export function PushCard() {
    const t = useT();
    const [state, setState] = useState<PushState | null>(null);
    const [key, setKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');

    useEffect(() => {
        let alive = true;
        pushState().then((s) => { if (alive) { setState(s.state); setKey(s.publicKey); } }).catch(() => { if (alive) setState('off-server'); });
        return () => { alive = false; };
    }, []);

    const run = async (fn: () => Promise<void>) => {
        setBusy(true); setNote('');
        try { await fn(); } catch (e) { setNote(apiErr(e) || t('pushFailed')); } finally { setBusy(false); }
    };

    if (!state || state === 'off-server') return null;
    if (state === 'unsupported' || state === 'blocked') {
        return (
            <div className="rounded-2xl p-3.5 flex items-start gap-3 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                {state === 'blocked' ? <BellOff size={18} className="shrink-0 mt-0.5" /> : <Smartphone size={18} className="shrink-0 mt-0.5" />}
                <p>{t(state === 'blocked' ? 'pushBlocked' : 'pushUnsupported')}</p>
            </div>
        );
    }
    const on = state === 'on';
    return (
        <div className="wp-card p-4">
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-xl shrink-0" style={on ? { background: 'var(--success-tint)', color: 'var(--success)' } : { background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>
                    <BellRing size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{t(on ? 'pushOnTitle' : 'pushOffTitle')}</p>
                    {!on && <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('pushOffBody')}</p>}
                    <div className="flex flex-wrap gap-2 mt-3">
                        {on ? (
                            <>
                                <button className="wp-btn wp-btn-ghost !py-2 text-sm" disabled={busy} onClick={() => run(async () => { await sendTestPush(); setNote(t('pushTestSent')); })}>
                                    {busy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />} {t('pushTest')}
                                </button>
                                <button className="wp-btn wp-btn-ghost !py-2 text-sm" disabled={busy} onClick={() => run(async () => { await disablePush(); setState('off'); })}>{t('pushTurnOff')}</button>
                            </>
                        ) : (
                            <button className="wp-btn wp-btn-primary !py-2 text-sm" disabled={busy} onClick={() => run(async () => { setState(await enablePush(key)); })}>
                                {busy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />} {t('pushTurnOn')}
                            </button>
                        )}
                    </div>
                    {note && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }} role="status">{note}</p>}
                </div>
            </div>
        </div>
    );
}
