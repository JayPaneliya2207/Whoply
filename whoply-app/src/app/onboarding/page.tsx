'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Building2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { api, apiErr } from '@/lib/api';
import { GSTIN_PLACEHOLDER, maskGstin, isValidGstin } from '@/lib/gstin';
import { useAuth } from '@/stores/auth.store';

export default function OnboardingPage() {
    const router = useRouter();
    const { setUser } = useAuth();
    const [type, setType] = useState<'retail' | 'wholesale'>('retail');
    const [businessName, setBusinessName] = useState('');
    const [gstin, setGstin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setLoading(true); setError('');
        try {
            const { data } = await api.post('/auth/onboarding', { businessName, type, gstin: gstin || undefined });
            setUser(data.data.user);
            router.replace('/dashboard');
        } catch (e) { setError(apiErr(e)); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen wp-gradient grid place-items-center p-6">
            <div className="wp-card p-8 w-full max-w-md wp-fade-up">
                <Logo size={34} />
                <h1 className="text-2xl font-bold mt-6" style={{ color: 'var(--text-primary)' }}>Set up your business</h1>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>This tailors your dashboard and features.</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    {([['retail', 'Retail Shop', Store], ['wholesale', 'Wholesale', Building2]] as const).map(([val, label, Icon]) => (
                        <button key={val} onClick={() => setType(val)} className="wp-card p-4 text-left"
                            style={type === val ? { borderColor: 'var(--brand-700)', boxShadow: 'var(--shadow-md)' } : {}}>
                            <Icon size={22} style={{ color: type === val ? 'var(--brand-700)' : 'var(--text-muted)' }} />
                            <p className="font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
                        </button>
                    ))}
                </div>

                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Business name</label>
                <input className="wp-input mt-1.5 mb-3" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Sharma General Store" />
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>GSTIN (optional)</label>
                <input className="wp-input mt-1.5 mb-1 uppercase" value={gstin} onChange={(e) => setGstin(maskGstin(e.target.value))} placeholder={GSTIN_PLACEHOLDER} maxLength={15} />
                {gstin.length === 15 && !isValidGstin(gstin)
                    ? <p className="text-xs mb-4" style={{ color: 'var(--danger-500)' }}>Invalid GSTIN. Expected format like {GSTIN_PLACEHOLDER}.</p>
                    : <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>15-character GSTIN — 2-digit state code + PAN + entity code.</p>}

                {error && <p className="text-sm mb-3" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                <button className="wp-btn wp-btn-primary w-full" disabled={loading || !businessName || (!!gstin && !isValidGstin(gstin))} onClick={submit}>Create business</button>
            </div>
        </div>
    );
}
