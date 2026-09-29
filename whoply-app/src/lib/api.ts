import axios from 'axios';
import { useAuth } from '@/stores/auth.store';
import { useLang } from '@/i18n';
import { dictionaries } from '@/i18n/translations';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api';

export const api = axios.create({ baseURL: API_URL });

// Attach the bearer token from localStorage on every request.
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('whoply_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// On 401, log out fully (token, saved user, cart, cached screens) and bounce to login.
api.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error?.response?.status === 401 && typeof window !== 'undefined') {
            // Only once: after the first 401 the token is gone, and screens still on
            // the page may fire a few more requests before the redirect lands.
            if (localStorage.getItem('whoply_token')) useAuth.getState().logout();
            if (!location.pathname.startsWith('/login')) location.href = '/login';
        }
        return Promise.reject(error);
    }
);

/** The error to show a person. No response at all while offline means nothing was saved. */
export const apiErr = (e: any): string => {
    if (!e?.response && typeof navigator !== 'undefined' && !navigator.onLine) {
        const lang = useLang.getState().lang;
        return dictionaries[lang]?.offlineNotSaved ?? dictionaries.en.offlineNotSaved;
    }
    return e?.response?.data?.error?.message || e?.message || 'Something went wrong';
};
