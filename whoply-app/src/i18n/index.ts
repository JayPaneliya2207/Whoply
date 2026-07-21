'use client';
import { create } from 'zustand';
import { dictionaries, type Lang } from './translations';
export { LANGS, type Lang } from './translations';

interface LangState {
    lang: Lang;
    setLang: (l: Lang) => void;
    hydrate: () => void;
}

export const useLang = create<LangState>((set) => ({
    lang: 'en',
    setLang: (l) => {
        if (typeof window !== 'undefined') localStorage.setItem('whoply_lang', l);
        set({ lang: l });
    },
    hydrate: () => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem('whoply_lang') as Lang | null;
        if (stored && dictionaries[stored]) set({ lang: stored });
    },
}));

/** translation hook — t('key') with English fallback */
export const useT = () => {
    const lang = useLang((s) => s.lang);
    return (key: string): string => dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
};
