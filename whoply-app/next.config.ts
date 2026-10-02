import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    // Browser-side protections on every page: no framing by other sites (clickjacking), no MIME guessing,
    // no full URLs leaked to other sites, and only the device features the app really uses.
    async headers() {
        return [{
            source: '/:path*',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
            ],
        }];
    },
    // Docker builds (deploy/) use a small self-contained server; local dev and npm start are unchanged.
    ...(process.env.NEXT_OUTPUT === 'standalone' && { output: 'standalone' as const }),
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api',
    },
};

export default nextConfig;
