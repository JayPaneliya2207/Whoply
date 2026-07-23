'use client';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Globe, Building2, Check, Store, ReceiptText, QrCode, Upload, Landmark } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { useLang, LANGS, type Lang } from '@/i18n';
import { useT } from '@/i18n';

export default function SettingsPage() {
    const t = useT();
    const { user, setUser } = useAuth();
    const { lang, setLang } = useLang();
    const qc = useQueryClient();
    const base = user?.business?.type === 'wholesale' ? '/wholesaler' : '/shopkeeper';
    const isWholesale = user?.business?.type === 'wholesale';
    const canEditShop = user?.role === 'owner' || user?.role === 'manager';

    // ── Shop details ─────────────────────────────────────────────
    const { data: biz } = useQuery({ queryKey: ['my-business', base], queryFn: async () => (await api.get(`${base}/business`)).data.data });
    const [shop, setShop] = useState<any>(null);
    const [shopSaved, setShopSaved] = useState(false);
    const [shopErr, setShopErr] = useState('');
    const [savingShop, setSavingShop] = useState(false);
    useEffect(() => {
        if (biz) setShop({ name: biz.name || '', ownerName: biz.ownerName || '', mobile: biz.mobile || '', gstin: biz.gstin || '', address: biz.address || '', city: biz.city || '', state: biz.state || '', invoicePrefix: biz.settings?.invoicePrefix || 'INV', upiId: biz.upiId || '', upiQrImage: biz.upiQrImage || '', bankName: biz.bank?.name || '', bankHolder: biz.bank?.holder || '', bankAccount: biz.bank?.account || '', bankIfsc: biz.bank?.ifsc || '' });
    }, [biz]);
    const setS = (k: string, v: string) => setShop((s: any) => ({ ...s, [k]: v }));
    // Downscale an uploaded QR image to a small data URL so it fits comfortably in the DB.
    const onQrFile = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const max = 512;
                const scale = Math.min(1, max / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                setS('upiQrImage', canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };
    const saveShop = async () => {
        setSavingShop(true); setShopErr(''); setShopSaved(false);
        try {
            const body = { name: shop.name, ownerName: shop.ownerName, mobile: shop.mobile, gstin: shop.gstin, address: shop.address, city: shop.city, state: shop.state, upiId: shop.upiId, upiQrImage: shop.upiQrImage, bank: { name: shop.bankName, holder: shop.bankHolder, account: shop.bankAccount, ifsc: shop.bankIfsc }, settings: { invoicePrefix: shop.invoicePrefix } };
            const { data } = await api.patch(`${base}/business`, body);
            if (user?.business) setUser({ ...user, business: { ...user.business, name: data.data.name, gstin: data.data.gstin } });
            qc.invalidateQueries({ queryKey: ['pos-business'] });
            qc.invalidateQueries({ queryKey: ['ws-business'] });
            qc.invalidateQueries({ queryKey: ['my-business'] });
            setShopSaved(true); setTimeout(() => setShopSaved(false), 2500);
        } catch (e) { setShopErr(apiErr(e)); } finally { setSavingShop(false); }
    };

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

            {/* Shop details — shown on every bill / invoice */}
            <div className="wp-card p-5">
                <div className="flex items-center gap-2 mb-1"><ReceiptText size={18} style={{ color: 'var(--brand-700)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{isWholesale ? t('businessDetails') : t('shopDetails')}</h3></div>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('shownOnBills')}</p>
                {!shop && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
                {shop && (
                    <>
                        <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{isWholesale ? t('businessDetails') : t('shopName')}</span>
                            <input className="wp-input mt-1.5" value={shop.name} onChange={(e) => setS('name', e.target.value)} disabled={!canEditShop} placeholder="e.g. Sharma General Store" /></label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('ownerName')}</span>
                                <input className="wp-input mt-1.5" value={shop.ownerName} onChange={(e) => setS('ownerName', e.target.value)} disabled={!canEditShop} /></label>
                            <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('shopMobile')}</span>
                                <input className="wp-input mt-1.5" inputMode="numeric" value={shop.mobile} onChange={(e) => setS('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} disabled={!canEditShop} /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>GSTIN</span>
                                <input className="wp-input mt-1.5 uppercase" value={shop.gstin} onChange={(e) => setS('gstin', e.target.value.toUpperCase())} disabled={!canEditShop} placeholder="22AAAAA0000A1Z5" maxLength={15} /></label>
                            <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('invoicePrefix')}</span>
                                <input className="wp-input mt-1.5 uppercase" value={shop.invoicePrefix} onChange={(e) => setS('invoicePrefix', e.target.value.toUpperCase().slice(0, 6))} disabled={!canEditShop} placeholder="INV" /></label>
                        </div>
                        <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('addressLabel')}</span>
                            <input className="wp-input mt-1.5" value={shop.address} onChange={(e) => setS('address', e.target.value)} disabled={!canEditShop} placeholder="Shop no, street, area" /></label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block mb-4"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('cityLabel')}</span>
                                <input className="wp-input mt-1.5" value={shop.city} onChange={(e) => setS('city', e.target.value)} disabled={!canEditShop} /></label>
                            <label className="block mb-4"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('stateLabel')}</span>
                                <input className="wp-input mt-1.5" value={shop.state} onChange={(e) => setS('state', e.target.value)} disabled={!canEditShop} /></label>
                        </div>

                        {/* UPI payment — shown as a QR in POS when "UPI" is chosen */}
                        <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><QrCode size={15} /> {t('upiPayment')}</p>
                            <label className="block mb-3"><span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('yourUpiId')}</span>
                                <input className="wp-input mt-1.5" value={shop.upiId} onChange={(e) => setS('upiId', e.target.value)} disabled={!canEditShop} placeholder="yourname@okhdfc / 98765@ybl" /></label>
                            <div className="flex items-center gap-3">
                                {shop.upiQrImage
                                    ? <img src={shop.upiQrImage} alt="UPI QR" className="h-20 w-20 rounded-lg object-cover" style={{ border: '1px solid var(--card-border)' }} />
                                    : <div className="h-20 w-20 rounded-lg grid place-items-center" style={{ border: '1px dashed var(--card-border)', color: 'var(--text-muted)' }}><QrCode size={22} /></div>}
                                {canEditShop && (
                                    <div className="text-xs">
                                        <label className="wp-btn wp-btn-ghost !py-1.5 cursor-pointer inline-flex"><Upload size={14} /> {shop.upiQrImage ? t('changeQr') : t('uploadQrImage')}
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => onQrFile(e.target.files?.[0])} /></label>
                                        {shop.upiQrImage && <button className="wp-btn wp-btn-ghost !py-1.5 ml-1" onClick={() => setS('upiQrImage', '')}>{t('remove')}</button>}
                                        <p className="mt-1.5" style={{ color: 'var(--text-muted)' }}>Optional — upload your PhonePe/GPay/Paytm QR to show it at billing.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bank details — shown to dealers/customers for transfer */}
                        <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><Landmark size={15} /> {t('bankDetails')}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block mb-3"><span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('bankName')}</span>
                                    <input className="wp-input mt-1.5" value={shop.bankName} onChange={(e) => setS('bankName', e.target.value)} disabled={!canEditShop} placeholder="HDFC / SBI…" /></label>
                                <label className="block mb-3"><span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('accountHolder')}</span>
                                    <input className="wp-input mt-1.5" value={shop.bankHolder} onChange={(e) => setS('bankHolder', e.target.value)} disabled={!canEditShop} placeholder="Name as per bank" /></label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block"><span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('accountNumber')}</span>
                                    <input className="wp-input mt-1.5 tabular" inputMode="numeric" value={shop.bankAccount} onChange={(e) => setS('bankAccount', e.target.value.replace(/\D/g, '').slice(0, 18))} disabled={!canEditShop} placeholder="e.g. 50100123456789" maxLength={18} /></label>
                                <label className="block"><span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>IFSC</span>
                                    <input className="wp-input mt-1.5 uppercase" value={shop.bankIfsc} onChange={(e) => setS('bankIfsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} disabled={!canEditShop} placeholder="e.g. HDFC0001234" maxLength={11} /></label>
                            </div>
                        </div>

                        {shopErr && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{shopErr}</p>}
                        {canEditShop
                            ? <button className="wp-btn wp-btn-primary" disabled={savingShop || !shop.name} onClick={saveShop}>{shopSaved ? <><Check size={16} /> {t('saved')}</> : t('saveShopDetails')}</button>
                            : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('onlyOwnerEdit')}</p>}
                    </>
                )}
            </div>

            {/* Profile */}
            <div className="wp-card p-5">
                <div className="flex items-center gap-2 mb-4"><User size={18} style={{ color: 'var(--brand-700)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('editProfile')}</h3></div>
                <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('name')}</span>
                    <input className="wp-input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="block mb-3"><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('emailLabel')}</span>
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
