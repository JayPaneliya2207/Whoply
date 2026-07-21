import { create } from 'zustand';

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
    },
    setUser: (user) => {
        if (typeof window !== 'undefined') localStorage.setItem('whoply_user', JSON.stringify(user));
        set({ user });
    },
    hydrate: () => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('whoply_token');
        const raw = localStorage.getItem('whoply_user');
        set({ token, user: raw ? JSON.parse(raw) : null, hydrated: true });
    },
    logout: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('whoply_token');
            localStorage.removeItem('whoply_user');
        }
        set({ token: null, user: null });
    },
}));
