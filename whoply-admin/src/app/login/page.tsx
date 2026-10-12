'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Smartphone, Lock, ArrowRight, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { api, apiErr } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';

const IS_PROD = process.env.NODE_ENV === 'production';

export default function AdminLogin() {
    const router = useRouter();
    const setSession = useAuth((s) => s.setSession);
    const [mobile, setMobile] = useState(IS_PROD ? '' : '9000000099');
    const [password, setPassword] = useState('');
    // The second step, for a login with two-step sign-in on: a code from the authenticator app, or a recovery code.
    const [step, setStep] = useState<'password' | 'code'>('password');
    const [code, setCode] = useState('');
    const [useRecovery, setUseRecovery] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const login = async () => {
        setError(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/password-login', { mobile, password, ...(step === 'code' && { code: code.trim() }) });
            if (data.data.user.role !== 'admin') {
                // Don't leave a live session behind for a shop login used here by mistake.
                await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${data.data.token}` } }).catch(() => {});
                setError('This console is for platform admins only.');
                return;
            }
            setSession(data.data.token, data.data.user);
            router.replace('/dashboard');
        } catch (e: any) {
            // The password was right and this login has two-step sign-in on: ask for the code.
            if (e?.response?.data?.error?.code === 'CODE_NEEDED' && step === 'password') { setStep('code'); setCode(''); setUseRecovery(false); }
            else setError(apiErr(e));
        } finally { setLoading(false); }
    };
    const back = () => { setStep('password'); setCode(''); setError(''); };

    return (
        <div className="min-h-screen wp-gradient grid place-items-center p-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="wp-card p-8 w-full max-w-sm">
                <Logo size={32} />
                <div className="mt-6 flex items-center gap-2 wp-chip w-fit" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>
                    <ShieldCheck size={13} /> Platform Console
                </div>
                <h1 className="text-2xl font-bold mt-3" style={{ color: 'var(--text-primary)' }}>{step === 'code' ? 'Enter your code' : 'Admin login'}</h1>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{step === 'code' ? (useRecovery ? 'Type one of the recovery codes you saved. Each works once.' : 'Open the authenticator app on your phone and type the 6-digit code for Whoply Admin.') : 'Manage all Whoply businesses'}</p>

                {step === 'code' ? (
                    <>
                        <label className="text-sm font-medium" htmlFor="admin-code" style={{ color: 'var(--text-secondary)' }}>{useRecovery ? 'Recovery code' : '6-digit code'}</label>
                        <input id="admin-code" key={useRecovery ? 'recovery' : 'code'} autoFocus
                            className={useRecovery ? 'wp-input mt-1.5 mb-4 tabular' : 'wp-input mt-1.5 mb-4 text-center text-xl font-bold tabular tracking-[0.4em]'}
                            value={code} onChange={(e) => setCode(useRecovery ? e.target.value.slice(0, 20) : e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={(e) => e.key === 'Enter' && code.trim() && login()} inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code"
                            placeholder={useRecovery ? 'abcde-fghjk' : '000000'} style={{ fontSize: useRecovery ? 16 : undefined }} />
                        {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
                        <button className="wp-btn wp-btn-primary w-full" disabled={loading || !code.trim() || (!useRecovery && code.length !== 6)} onClick={login}>
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Sign in <ArrowRight size={17} /></>}
                        </button>
                        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
                            <button className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-secondary)' }} onClick={back}><ArrowLeft size={15} /> Back</button>
                            <button className="font-medium" style={{ color: 'var(--brand-text)' }} onClick={() => { setUseRecovery((v) => !v); setCode(''); setError(''); }}>{useRecovery ? 'Use the app code' : 'Use a recovery code'}</button>
                        </div>
                        <p className="text-xs mt-5" style={{ color: 'var(--text-muted)' }}>No phone and no recovery code? A super admin can switch two-step sign-in off for your login.</p>
                    </>
                ) : (<>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Mobile</label>
                <div className="relative mt-1.5 mb-3">
                    <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    <input className="wp-input pl-11" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Admin mobile" style={{ fontSize: 16 }} />
                </div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <div className="relative mt-1.5 mb-4">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    <input type="password" className="wp-input pl-11" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} placeholder="Password" style={{ fontSize: 16 }} />
                </div>
                {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
                <button className="wp-btn wp-btn-primary w-full" disabled={loading} onClick={login}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <>Login <ArrowRight size={17} /></>}
                </button>
                {!IS_PROD && <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>Demo: <b>9000000099</b> · <b>whoply123</b></p>}
                </>)}
            </motion.div>
        </div>
    );
}
