'use client';
import { useState } from 'react';
import { User, Lock, Globe, Building2, Check, Store } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { useLang, LANGS, type Lang } from '@/i18n';
import { useT } from '@/i18n';

export default function SettingsPage() {
    const t = useT();
    const { user, setUser } = useAuth();
    const { lang, setLang } = useLang();

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState((user as any)?.email || '');
    const [savedProfile, setSavedProfile] = useState(false);
    const [profileErr, setProfileErr] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    const [cur, setCur] = useState('');
    const [nw, setNw] = useState('');
    const [pwMsg, setPwMsg] = useState('');
    const [pwErr, setPwErr] = useState('');
    const [savingPw, setSavingPw] = useState(false);

    const saveProfile = async () => {
        setSavingProfile(true); setProfileErr(''); setSavedProfile(false);
        try {
            const { data } = await api.patch('/auth/profile', { name, email, language: lang });
            setUser(data.data.user);
            setSavedProfile(true);
            setTimeout(() => setSavedProfile(false), 2500);
        } catch (e) { setProfileErr(apiErr(e)); } finally { setSavingProfile(false); }
    };

    const changePw = async () => {
        setSavingPw(true); setPwErr(''); setPwMsg('');
        try {
            await api.post('/auth/change-password', { currentPassword: cur, newPassword: nw });
            setPwMsg('Password changed successfully'); setCur(''); setNw('');
        } catch (e) { setPwErr(apiErr(e)); } finally { setSavingPw(false); }
    };

    return (
        <div className="space-y-5 max-w-2xl">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings')}</h1>

            {/* Business */}
            <div className="wp-card p-5">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 grid place-items-center rounded-xl" style={{ background: 'var(--brand-700)', color: '#fff' }}>
                        {user?.business?.type === 'wholesale' ? <Building2 size={22} /> : <Store size={22} />}
                    </div>
                    <div>
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{user?.business?.name || t('myBusiness')}</p>
                        <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{user?.business?.type} · {user?.business?.plan} · {user?.role}</p>
                    </div>
                </div>
            </div>

            {/* Profile */}
            <div className="wp-card p-5">
                <div className="flex items-center gap-2 mb-4"><User size={18} style={{ color: 'var(--brand-700)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('editProfile')}</h3></div>
                <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('name')}</span>
                    <input className="wp-input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Email</span>
                    <input className="wp-input mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" /></label>
                <label className="block mb-4"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('mobile')}</span>
                    <input className="wp-input mt-1.5" value={user?.mobile || ''} disabled style={{ opacity: 0.6 }} /></label>
                {profileErr && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{profileErr}</p>}
                <button className="wp-btn wp-btn-primary" disabled={savingProfile} onClick={saveProfile}>
                    {savedProfile ? <><Check size={16} /> Saved</> : t('save')}
                </button>
            </div>

            {/* Language */}
            <div className="wp-card p-5">
                <div className="flex items-center gap-2 mb-4"><Globe size={18} style={{ color: 'var(--brand-700)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('language')}</h3></div>
                <div className="flex gap-2 flex-wrap">
                    {LANGS.map((l) => (
                        <button key={l.code} onClick={() => { setLang(l.code as Lang); api.patch('/auth/profile', { language: l.code }).catch(() => {}); }}
                            className="wp-btn" style={lang === l.code ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                            {l.native}
                        </button>
                    ))}
                </div>
            </div>

            {/* Change password */}
            <div className="wp-card p-5">
                <div className="flex items-center gap-2 mb-4"><Lock size={18} style={{ color: 'var(--brand-700)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('changePassword')}</h3></div>
                <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('currentPassword')}</span>
                    <input type="password" className="wp-input mt-1.5" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
                <label className="block mb-4"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('newPassword')}</span>
                    <input type="password" className="wp-input mt-1.5" value={nw} onChange={(e) => setNw(e.target.value)} /></label>
                {pwErr && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{pwErr}</p>}
                {pwMsg && <p className="text-sm mb-2" style={{ color: 'var(--success-600)' }}>{pwMsg}</p>}
                <button className="wp-btn wp-btn-primary" disabled={savingPw || !nw} onClick={changePw}>{t('changePassword')}</button>
            </div>
        </div>
    );
}
