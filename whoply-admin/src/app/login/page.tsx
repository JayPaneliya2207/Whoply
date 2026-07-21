'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Smartphone, Lock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { api, apiErr } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';

export default function AdminLogin() {
    const router = useRouter();
    const setSession = useAuth((s) => s.setSession);
    const [mobile, setMobile] = useState('9000000099');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const login = async () => {
        setError(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/password-login', { mobile, password });
            if (data.data.user.role !== 'admin') {
                setError('This console is for platform admins only.');
                return;
            }
            setSession(data.data.token, data.data.user);
            router.replace('/dashboard');
        } catch (e) { setError(apiErr(e)); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen wp-gradient grid place-items-center p-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="wp-card p-8 w-full max-w-sm">
                <Logo size={32} />
                <div className="mt-6 flex items-center gap-2 wp-chip w-fit" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>
                    <ShieldCheck size={13} /> Platform Console
                </div>
                <h1 className="text-2xl font-bold mt-3" style={{ color: 'var(--text-primary)' }}>Admin login</h1>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>Manage all Whoply businesses</p>

                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Mobile</label>
                <div className="relative mt-1.5 mb-3">
                    <Smartphone size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input className="wp-input pl-10" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <div className="relative mt-1.5 mb-4">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input type="password" className="wp-input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
                </div>
                {error && <p className="text-sm mb-3" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                <button className="wp-btn wp-btn-primary w-full" disabled={loading} onClick={login}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <>Login <ArrowRight size={17} /></>}
                </button>
                <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>Demo: <b>9000000099</b> · <b>whoply123</b></p>
            </motion.div>
        </div>
    );
}
