'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative, Pagination } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/effect-creative';
import 'swiper/css/pagination';
import { Smartphone, Lock, ArrowRight, ArrowLeft, Receipt, Package, BarChart3, ChevronRight, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { OTPInput } from '@/components/OTPInput';
import { PhoneInput } from '@/components/PhoneInput';
import { api, apiErr } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { useT, useLang, LANGS, type Lang } from '@/i18n';

type Method = 'otp' | 'password';

export default function LoginPage() {
    const router = useRouter();
    const setSession = useAuth((s) => s.setSession);
    const t = useT();
    const { lang, setLang, hydrate } = useLang();
    const swiperRef = useRef<SwiperType | null>(null);

    const [mobile, setMobile] = useState('');
    const [country, setCountry] = useState('+91');
    const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
    const [password, setPassword] = useState('');
    const [method, setMethod] = useState<Method>('otp');
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [devOtp, setDevOtp] = useState('');
    const [canResend, setCanResend] = useState(false);
    const [cooldown, setCooldown] = useState(30);

    useEffect(() => { hydrate(); if (localStorage.getItem('whoply_token')) router.replace('/dashboard'); }, [hydrate, router]);

    useEffect(() => {
        if (!otpSent || canResend) return;
        const id = setInterval(() => setCooldown((c) => { if (c <= 1) { setCanResend(true); return 0; } return c - 1; }), 1000);
        return () => clearInterval(id);
    }, [otpSent, canResend, cooldown]);

    const finish = (token: string, user: any) => { setSession(token, user); router.replace(user.needsOnboarding ? '/onboarding' : '/dashboard'); };

    const sendOtp = async () => {
        if (mobile.length < 10) { setError('Please enter a valid 10-digit mobile'); return; }
        setError(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { mobile });
            setDevOtp(data.data.devOtp || ''); setOtpSent(true); setCanResend(false); setCooldown(30);
        } catch (e) { setError(apiErr(e)); } finally { setLoading(false); }
    };

    const verifyOtp = useCallback(async (code: string) => {
        setError(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/verify-otp', { mobile, otp: code, language: lang });
            finish(data.data.token, data.data.user);
        } catch (e) { setError(apiErr(e)); setLoading(false); }
    }, [mobile, lang]);

    const passwordLogin = async () => {
        setError(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/password-login', { mobile, password, language: lang });
            finish(data.data.token, data.data.user);
        } catch (e) { setError(apiErr(e)); setLoading(false); }
    };

    const features = [
        { icon: Receipt, label: t('featBilling'), bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
        { icon: Package, label: t('featStock'), bg: '#dcfce7', fg: 'var(--success-600)' },
        { icon: BarChart3, label: t('featInsights'), bg: '#fef3c7', fg: 'var(--accent-600)' },
    ];

    return (
        <div className="h-screen w-screen overflow-hidden wp-gradient">
            <Swiper
                modules={[EffectCreative, Pagination]}
                effect="creative"
                grabCursor
                allowTouchMove={!otpSent}
                creativeEffect={{ prev: { translate: ['-20%', 0, -100], opacity: 0.4 }, next: { translate: ['100%', 0, 0] } }}
                pagination={{ clickable: true, el: '.wp-pagination' }}
                onSwiper={(s) => (swiperRef.current = s)}
                className="h-full w-full"
            >
                {/* ---------- Slide 1: Landing ---------- */}
                <SwiperSlide>
                    <div className="h-full flex flex-col px-6 py-8">
                        <div className="flex justify-center"><Logo size={38} /></div>
                        <main className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('heroTitle')}</h1>
                                <p className="mt-3 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>{t('tagline')}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                                {features.map((f) => (
                                    <div key={f.label} className="wp-card p-3 flex flex-col items-center gap-1.5">
                                        <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: f.bg, color: f.fg }}><f.icon size={20} /></div>
                                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="w-full max-w-xs">
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{t('selectLanguage')}</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {LANGS.map((l) => (
                                        <button key={l.code} onClick={() => setLang(l.code as Lang)} className="py-2.5 rounded-xl text-sm font-bold transition-all"
                                            style={lang === l.code ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                                            {l.native}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </main>

                        <div className="space-y-3">
                            <div className="wp-pagination flex justify-center gap-2" />
                            <button className="wp-btn wp-btn-primary w-full !py-3.5 !text-base" onClick={() => swiperRef.current?.slideNext()}>
                                {t('getStarted')} <ArrowRight size={18} />
                            </button>
                            <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>{t('swipeToContinue')} →</p>
                        </div>
                    </div>
                </SwiperSlide>

                {/* ---------- Slide 2: Login ---------- */}
                <SwiperSlide>
                    <div className="h-full w-full overflow-y-auto wp-scroll relative">
                        {/* top bar */}
                        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-5 z-10">
                            <button onClick={() => swiperRef.current?.slidePrev()} className="h-10 w-10 grid place-items-center rounded-full" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                                <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} />
                            </button>
                            <div className="flex gap-1.5">
                                {LANGS.map((l) => (
                                    <button key={l.code} onClick={() => setLang(l.code as Lang)} className="wp-chip px-2.5 py-1.5 text-xs" style={lang === l.code ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>{l.native}</button>
                                ))}
                            </div>
                        </div>

                        <div className="min-h-full flex items-center justify-center p-5 py-20">
                            <div className="w-full max-w-md">
                                <div className="wp-card p-6 sm:p-8">
                                    <div className="text-center mb-6">
                                        <div className="flex justify-center mb-4"><Logo size={34} showText={false} /></div>
                                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('welcomeBack')}</h1>
                                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('signInToContinue')}</p>
                                    </div>

                                    {error && <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: '#fee2e2', color: 'var(--danger-500)' }}>{error}</div>}

                                    {/* Mobile */}
                                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('mobileNumber')}</label>
                                    <div className="mb-4">
                                        <PhoneInput value={mobile} onChange={setMobile} country={country} onCountryChange={setCountry} disabled={otpSent && method === 'otp'} />
                                    </div>

                                    {/* Tabs */}
                                    {!otpSent && (
                                        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--surface-2)' }}>
                                            {(['otp', 'password'] as Method[]).map((m) => (
                                                <button key={m} onClick={() => { setMethod(m); setError(''); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                                                    style={method === m ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                                                    {m === 'otp' ? <Smartphone size={16} /> : <Lock size={16} />}{m === 'otp' ? t('otpLogin') : t('password')}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* OTP flow */}
                                    {method === 'otp' && (
                                        !otpSent ? (
                                            <button className="wp-btn wp-btn-primary w-full !py-3.5 !text-base" disabled={loading} onClick={sendOtp}>
                                                {loading ? <Loader2 className="animate-spin" size={18} /> : <>{t('sendOtpBtn')} <ChevronRight size={18} /></>}
                                            </button>
                                        ) : (
                                            <div className="space-y-4">
                                                <p className="text-xs font-semibold text-center" style={{ color: 'var(--text-secondary)' }}>{t('otpSentTo')} {country} {mobile}</p>
                                                <OTPInput value={otp} onChange={setOtp} onComplete={verifyOtp} disabled={loading} />
                                                {devOtp && <p className="text-xs text-center wp-chip mx-auto w-fit" style={{ background: 'var(--accent-500)', color: '#1a1205' }}>Dev OTP: {devOtp}</p>}
                                                {loading && <div className="flex justify-center"><Loader2 className="animate-spin" size={20} style={{ color: 'var(--brand-700)' }} /></div>}
                                                <div className="flex gap-3 text-sm">
                                                    <button className="flex-1 font-medium" style={{ color: 'var(--text-secondary)' }} onClick={() => { setOtpSent(false); setOtp(['', '', '', '', '', '']); }}>{t('changeMobile')}</button>
                                                    <button className="flex-1 font-medium" disabled={!canResend} style={{ color: canResend ? 'var(--brand-700)' : 'var(--text-muted)' }} onClick={sendOtp}>{canResend ? t('resendOtp') : `${t('resendOtp')} (${cooldown})`}</button>
                                                </div>
                                            </div>
                                        )
                                    )}

                                    {/* Password flow */}
                                    {method === 'password' && (
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                                <input type="password" placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && passwordLogin()} className="wp-input pl-11" style={{ fontSize: 16 }} />
                                            </div>
                                            <button className="wp-btn wp-btn-primary w-full !py-3.5 !text-base" disabled={loading || !password} onClick={passwordLogin}>
                                                {loading ? <Loader2 className="animate-spin" size={18} /> : <>{t('signIn')} <ArrowRight size={18} /></>}
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>{t('agreeTerms')}</p>
                                </div>
                                <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>Demo: <b>9000000001</b> · <b>whoply123</b> · OTP <b>123456</b></p>
                            </div>
                        </div>
                    </div>
                </SwiperSlide>
            </Swiper>
        </div>
    );
}
