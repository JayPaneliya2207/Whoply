export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api';

/** International format, digits only (e.g. 919876543210). Unset → WhatsApp CTAs are hidden. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

export type Role = 'retail' | 'wholesale';

export function whatsappLink(message: string) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
