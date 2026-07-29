import { create } from 'zustand';
import { useLang } from '@/i18n';
import { dictionaries } from '@/i18n/translations';

/** Apply an account's saved language to the active i18n store (per-account, per-device). */
const applyUserLang = (lang?: string) => {
    if (lang && (dictionaries as Record<string, unknown>)[lang]) {
        useLang.getState().setLang(lang as any);
    }
};

export interface Business {
    id: string;
    name: string;
    type: 'retail' | 'wholesale';
    plan: string;
    gstin?: string;
}
export interface AuthUser {
    id: string;
    name: string;
    mobile: string;
    role: string;
    language: string;
    avatar?: string;
    business: Business | null;
    needsOnboarding: boolean;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    hydrated: boolean;
    setSession: (token: string, user: AuthUser) => void;
    setUser: (user: AuthUser) => void;
    hydrate: () => void;
    logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
    user: null,
    token: null,
    hydrated: false,
    setSession: (token, user) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('whoply_token', token);
            localStorage.setItem('whoply_user', JSON.stringify(user));
        }
        set({ token, user });
        applyUserLang(user?.language); // load this account's language (don't inherit the previous login's)
    },
    setUser: (user) => {
        if (typeof window !== 'undefined') localStorage.setItem('whoply_user', JSON.stringify(user));
        set({ user });
    },
    hydrate: () => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('whoply_token');
        const raw = localStorage.getItem('whoply_user');
        const user = raw ? JSON.parse(raw) : null;
        set({ token, user, hydrated: true });
        applyUserLang(user?.language);
    },
    logout: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('whoply_token');
            localStorage.removeItem('whoply_user');
            localStorage.removeItem('whoply_pos_cart'); // don't carry a half-built bill to the next login
        }
        set({ token: null, user: null });
    },
}));
