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
/**
 * Save something that may take a dealer over their credit limit. On the API's
 * OVER_CREDIT_LIMIT warning, ask (owner / manager) and send again with
 * overLimitOk if they agree; otherwise the warning is the error shown.
 */
export async function withCreditCheck<T>(send: (extra: Record<string, unknown>) => Promise<T>, ask: (message: string) => boolean): Promise<T> {
    try {
        return await send({});
    } catch (e: any) {
        const err = e?.response?.data?.error;
        if (e?.response?.status === 409 && err?.code === 'OVER_CREDIT_LIMIT' && ask(err.message)) return send({ overLimitOk: true });
        throw e;
    }
}

/** Every row of a paged list endpoint (100 per request), e.g. for a CSV export. */
export async function fetchAll(path: string): Promise<any[]> {
    const out: any[] = [];
    for (let page = 1; page <= 200; page++) {
        const { data } = await api.get(`${path}${path.includes('?') ? '&' : '?'}limit=100&page=${page}`);
        out.push(...(data.data.items || []));
        if (page >= (data.data.meta?.totalPages || 1)) break;
    }
    return out;
}

export const apiErr = (e: any): string => {
    if (!e?.response && typeof navigator !== 'undefined' && !navigator.onLine) {
        const lang = useLang.getState().lang;
        return dictionaries[lang]?.offlineNotSaved ?? dictionaries.en.offlineNotSaved;
    }
    return e?.response?.data?.error?.message || e?.message || 'Something went wrong';
};
