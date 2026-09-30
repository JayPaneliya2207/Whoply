'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { getQueryClient } from '@/lib/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
    const [qc] = useState(getQueryClient);
    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </ThemeProvider>
    );
}
