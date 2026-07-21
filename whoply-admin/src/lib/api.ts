import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api';

export const api = axios.create({ baseURL: API_URL });

// Attach the bearer token from localStorage on every request.
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('whoply_admin_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// On 401, clear the session and bounce to login.
api.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error?.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('whoply_admin_token');
            if (!location.pathname.startsWith('/login')) location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const apiErr = (e: any): string =>
    e?.response?.data?.error?.message || e?.message || 'Something went wrong';
