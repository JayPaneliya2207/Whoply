import type { Lang } from '@/i18n/landing';

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7200';

/** International format, digits only (e.g. 919876543210). Unset → WhatsApp CTAs are hidden. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

export type Role = 'retail' | 'wholesale';

/**
 * Entry into the app. `start=1` skips the app's own intro slide (the visitor
 * just read the pitch here), `lang` carries the locale across, and `role`
 * pre-selects the business type on onboarding. Login and sign-up are the
 * same OTP flow, so both go through here.
 */
export function appEntry(lang: Lang, role?: Role) {
    const q = new URLSearchParams({ start: '1', lang });
    if (role) q.set('role', role);
    return `${APP_URL}/login?${q}`;
}

export function whatsappLink(message: string) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
