import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    // Docker builds (deploy/) use a small self-contained server; local dev and npm start are unchanged.
    ...(process.env.NEXT_OUTPUT === 'standalone' && { output: 'standalone' as const }),
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7200',
    },
};

export default nextConfig;
