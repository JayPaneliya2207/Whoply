'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { qrMatrix, qrPath } from '@/lib/qr';
import { Modal, Field } from '@/components/Modal';

interface Status { on: boolean; since: string | null; recoveryLeft: number }
type Stage = 'home' | 'scan' | 'codes' | 'off';

/** Is two-step sign-in on for the signed-in admin? Shared by the menu, the reminder and the window below. */
export const useTwoStep = () =>
    useQuery({ queryKey: ['two-step'], queryFn: async () => (await api.get('/auth/two-step')).data.data as Status, staleTime: 60_000 });

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function saveAsFile(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The 6-digit box, big enough to read back against the phone. */
function CodeInput({ value, onChange, onEnter, autoFocus }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
    return (
        <input className="wp-input text-center text-xl font-bold tabular tracking-[0.4em]" value={value} onChange={(e) => onChange(onlyDigits(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} autoFocus={autoFocus} aria-label="6-digit code" />
    );
}

/**
 * Two-step sign-in for the signed-in admin: turn it on (password → scan the QR
 * code → type the code → save the recovery codes) or off (password + code).
 */
export function TwoStepDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const qc = useQueryClient();
    const { data: status } = useTwoStep();
    const [stage, setStage] = useState<Stage>('home');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
    const [recovery, setRecovery] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [note, setNote] = useState('');

    const qr = useMemo(() => {
        if (!setup) return null;
        try { return qrPath(qrMatrix(setup.url)); } catch { return null; } // no picture: the key below still works
    }, [setup]);

    const reset = () => { setStage('home'); setPassword(''); setCode(''); setSetup(null); setRecovery([]); setSaved(false); setErr(''); setNote(''); };
    // The recovery codes are shown once — the window stays until the admin says they are saved.
    const close = () => { if (busy || (stage === 'codes' && !saved)) return; reset(); onClose(); };
    const run = async (work: () => Promise<void>) => {
        setErr(''); setBusy(true);
        try { await work(); } catch (e) { setErr(apiErr(e)); } finally { setBusy(false); }
    };
    const copy = async (text: string, said: string) => {
        try { await navigator.clipboard.writeText(text); setNote(said); setTimeout(() => setNote(''), 3000); } catch { /* no clipboard here: the text is on screen */ }
    };

    const start = () => run(async () => {
        const { data } = await api.post('/auth/two-step/start', { password });
        setSetup(data.data); setPassword(''); setCode(''); setStage('scan');
    });
    const confirm = () => run(async () => {
        const { data } = await api.post('/auth/two-step/confirm', { code });
        setRecovery(data.data.recoveryCodes); setCode(''); setSetup(null); setStage('codes');
        qc.invalidateQueries({ queryKey: ['two-step'] });
        qc.invalidateQueries({ queryKey: ['admin-admins'] });
    });
    const turnOff = () => run(async () => {
        await api.post('/auth/two-step/off', { password, code: code.trim() });
        reset();
        setNote('Two-step sign-in is off. Your password alone signs you in.');
        qc.invalidateQueries({ queryKey: ['two-step'] });
        qc.invalidateQueries({ queryKey: ['admin-admins'] });
    });

    const codesText = `Whoply Admin — recovery codes\nEach code signs you in once if you do not have your phone.\n\n${recovery.join('\n')}\n`;
    const footer =
        stage === 'home' && status && !status.on ? <button className="wp-btn wp-btn-primary w-full" disabled={busy || !password} onClick={start}>{busy ? <Loader2 size={17} className="animate-spin" /> : 'Continue'}</button>
            : stage === 'scan' ? <button className="wp-btn wp-btn-primary w-full" disabled={busy || code.length !== 6} onClick={confirm}>{busy ? <Loader2 size={17} className="animate-spin" /> : <><ShieldCheck size={17} /> Turn on</>}</button>
                : stage === 'codes' ? <button className="wp-btn wp-btn-primary w-full" disabled={!saved} onClick={close}>Done</button>
                    : stage === 'off' ? <button className="wp-btn w-full" disabled={busy || !password || !code.trim()} onClick={turnOff} style={{ background: 'var(--danger-fill)', color: '#fff' }}>{busy ? <Loader2 size={17} className="animate-spin" /> : 'Turn off two-step sign-in'}</button>
                        : undefined;

    return (
        <Modal open={open} onClose={close} title="Two-step sign-in" footer={footer}>
            {!status && <div className="py-10 grid place-items-center"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>}

            {status && stage === 'home' && !status.on && (
                <>
                    <span className="wp-chip" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}><ShieldOff size={12} /> Off</span>
                    <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
                        With this on, signing in needs your password <b>and</b> a 6-digit code from an app on your phone. Someone who learns your password still can not get in.
                    </p>
                    <ol className="text-sm mt-3 space-y-1.5 list-decimal pl-5" style={{ color: 'var(--text-secondary)' }}>
                        <li>Install an authenticator app on your phone — Google Authenticator or Microsoft Authenticator (free).</li>
                        <li>Scan the QR code shown in the next step.</li>
                        <li>Type the code the app shows, and save your recovery codes.</li>
                    </ol>
                    <div className="mt-4">
                        <Field label="The password you log in with">
                            <div className="relative">
                                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input className="wp-input pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && password && start()} autoComplete="current-password" />
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>The same password you typed on the admin login page — not a new one. It is asked again to be sure it is you.</p>
                        </Field>
                    </div>
                </>
            )}

            {status && stage === 'home' && status.on && (
                <>
                    <span className="wp-chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}><ShieldCheck size={12} /> On{status.since ? ` since ${day(status.since)}` : ''}</span>
                    <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>Signing in to this console asks for your password and a code from your authenticator app.</p>
                    <div className="rounded-xl p-3 mt-3 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        <b style={{ color: status.recoveryLeft <= 2 ? 'var(--danger)' : 'var(--text-primary)' }}>{status.recoveryLeft} recovery {status.recoveryLeft === 1 ? 'code' : 'codes'} left.</b>{' '}
                        {status.recoveryLeft <= 2 ? 'Turn two-step sign-in off and on again to get 8 new ones.' : 'Each one signs you in once if you do not have your phone.'}
                    </div>
                    <button className="wp-btn wp-btn-ghost text-sm mt-4" style={{ color: 'var(--danger)' }} onClick={() => { setErr(''); setNote(''); setPassword(''); setCode(''); setStage('off'); }}><ShieldOff size={15} /> Turn off…</button>
                </>
            )}

            {stage === 'scan' && setup && (
                <>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}><b>1.</b> In your authenticator app, tap <b>+</b> and scan this QR code.</p>
                    {qr && (
                        <div className="mt-3 mx-auto w-fit rounded-2xl p-2" style={{ background: '#fff', border: '1px solid var(--card-border)' }}>
                            <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width={208} height={208} shapeRendering="crispEdges" role="img" aria-label="QR code for your authenticator app">
                                <rect width={qr.size} height={qr.size} fill="#fff" />
                                <path d={qr.path} fill="#000" />
                            </svg>
                        </div>
                    )}
                    <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Can’t scan? Choose “Enter a setup key” in the app and type this key (time based):</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <code className="text-sm font-semibold tabular break-all flex-1" style={{ color: 'var(--text-primary)' }}>{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
                            <button className="wp-btn wp-btn-ghost !p-2 shrink-0" title="Copy the key" aria-label="Copy the key" onClick={() => copy(setup.secret, 'Key copied')}><Copy size={14} /></button>
                        </div>
                    </div>
                    <p className="text-sm mt-4 mb-1.5" style={{ color: 'var(--text-secondary)' }}><b>2.</b> Type the 6-digit code the app now shows.</p>
                    <CodeInput value={code} onChange={setCode} onEnter={() => code.length === 6 && confirm()} autoFocus />
                </>
            )}

            {stage === 'codes' && (
                <>
                    <p className="flex items-center gap-2 text-base font-bold" style={{ color: 'var(--success)' }}><CheckCircle2 size={20} /> Two-step sign-in is on</p>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                        <b>Save these recovery codes now</b> — on paper or in a password manager, not only on your phone. Each one signs you in once if your phone is lost. They are not shown again.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {recovery.map((c) => <code key={c} className="rounded-lg px-3 py-2 text-sm font-semibold tabular text-center" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>{c}</code>)}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button className="wp-btn wp-btn-ghost text-sm" onClick={() => copy(recovery.join('\n'), 'Codes copied')}><Copy size={15} /> Copy</button>
                        <button className="wp-btn wp-btn-ghost text-sm" onClick={() => saveAsFile('whoply-admin-recovery-codes.txt', codesText)}><Download size={15} /> Download</button>
                    </div>
                    <label className="flex items-start gap-2 text-sm mt-4" style={{ color: 'var(--text-primary)' }}>
                        <input type="checkbox" className="mt-1" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved these codes somewhere safe
                    </label>
                </>
            )}

            {stage === 'off' && (
                <>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>After this, your password alone signs you in. You can turn it on again at any time.</p>
                    <Field label="The password you log in with">
                        <input className="wp-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
                    </Field>
                    <Field label="Code from your authenticator app (or a recovery code)">
                        <div className="relative">
                            <Smartphone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input className="wp-input pl-10 tabular" value={code} onChange={(e) => setCode(e.target.value.slice(0, 20))} onKeyDown={(e) => e.key === 'Enter' && password && code.trim() && turnOff()} autoComplete="one-time-code" placeholder="6-digit code" />
                        </div>
                    </Field>
                    <button className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }} onClick={() => { setErr(''); setStage('home'); }}>← Keep it on</button>
                </>
            )}

            {note && <p className="flex items-center gap-2 text-sm mt-3" style={{ color: 'var(--success)' }} role="status"><CheckCircle2 size={16} className="shrink-0" /> {note}</p>}
            {err && <p className="flex items-start gap-2 text-sm mt-3" style={{ color: 'var(--danger)' }} role="alert"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {err}</p>}
        </Modal>
    );
}
