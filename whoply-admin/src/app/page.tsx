'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';

export default function Home() {
    const router = useRouter();
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('whoply_admin_token') : null;
        router.replace(token ? '/dashboard' : '/login');
    }, [router]);
    return <div className="min-h-screen wp-gradient grid place-items-center"><Logo size={42} /></div>;
}
