/**
 * WhatsApp messages through the Whatsline gateway (whatsline.io) — today the
 * sign-in code, and the test message on the admin Settings page.
 *
 * The on/off switch, the sender number and the token are kept in the platform
 * settings, so the admin changes them from the panel without a deploy. The
 * token is stored sealed (utils/seal.ts) and never leaves the server.
 *
 * Sending is best-effort: it answers { ok, detail } and never throws. The
 * message text (it holds the code) and the token are never logged.
 */
import PlatformSettings from '../models/PlatformSettings.js';
import { unsealSecret, sealSecret } from '../utils/seal.js';
import { OTP_MINUTES } from '../utils/otp.js';

export const DEFAULT_WHATSAPP_API_URL = 'https://whatsline.io/api/qr/rest/send_message';
const SEAL_PURPOSE = 'whoply whatsapp gateway token';
const TIMEOUT_MS = 12_000;
/** How long one API process keeps the settings before reading them again. */
const CACHE_MS = 30_000;

export interface WhatsappGateway { from: string; apiUrl: string; token: string }
export interface WhatsappSetup { enabled: boolean; from: string; apiUrl: string; tokenSet: boolean; gateway: WhatsappGateway | null }

export const sealWhatsappToken = (token: string) => sealSecret(token, SEAL_PURPOSE);

let cache: { at: number; setup: WhatsappSetup } | null = null;
/** After the settings were saved: read them fresh the next time. */
export const forgetWhatsappSetup = (): void => { cache = null; };

/** What is set up: the switch, the sender, and — when sender and token are both there — the gateway to send through. */
export async function whatsappSetup(): Promise<WhatsappSetup> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.setup;
    const doc = await PlatformSettings.findOne({ key: 'main' }).select('+whatsapp.token').lean();
    const w = doc?.whatsapp;
    const from = String(w?.from || '');
    const apiUrl = String(w?.apiUrl || DEFAULT_WHATSAPP_API_URL);
    const token = unsealSecret(w?.token, SEAL_PURPOSE) || '';
    const setup: WhatsappSetup = { enabled: w?.enabled === true, from, apiUrl, tokenSet: !!token, gateway: from && token ? { from, apiUrl, token } : null };
    cache = { at: Date.now(), setup };
    return setup;
}

/** The gateway to send through, or null while WhatsApp is switched off or not fully set up. */
export async function whatsappGateway(): Promise<WhatsappGateway | null> {
    const setup = await whatsappSetup();
    return setup.enabled ? setup.gateway : null;
}

/** "+91" and "9876543210" → "919876543210": the number as the gateway takes it (country code first, no plus). */
export const whatsappNumber = (mobile: string, countryCode = '+91'): string => `${countryCode || '+91'}${mobile}`.replace(/\D/g, '');

/**
 * Send one text message. `detail` says in a few words why it failed (for the
 * admin's test button) — never the token.
 */
export async function sendWhatsAppText(to: string, text: string, gateway: WhatsappGateway | null): Promise<{ ok: boolean; detail: string }> {
    if (!gateway) return { ok: false, detail: 'WhatsApp is not set up' };
    if (!/^\d{10,15}$/.test(to) || !text.trim()) return { ok: false, detail: 'Not a mobile number' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(gateway.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: gateway.token, from: gateway.from, messageType: 'text', requestType: 'POST', to, text }).toString(),
            signal: controller.signal,
        });
        const reply = (await res.text().catch(() => '')).slice(0, 400);
        const said = reply.split(gateway.token).join('***').replace(/\s+/g, ' ').trim().slice(0, 160);
        if (!res.ok) return { ok: false, detail: `The gateway answered ${res.status}${said ? `: ${said}` : ''}` };
        // A gateway can answer 200 and still say "no" inside (wrong token, phone not connected).
        let body: any = null;
        try { body = JSON.parse(reply); } catch { /* not JSON: a 200 is a yes */ }
        const refused = body && typeof body === 'object' && (body.success === false || body.status === false || ['error', 'failed', 'fail'].includes(String(body.status).toLowerCase()));
        return refused ? { ok: false, detail: `The gateway refused the message${said ? `: ${said}` : ''}` } : { ok: true, detail: said };
    } catch (e: any) {
        return { ok: false, detail: e?.name === 'AbortError' ? 'The gateway did not answer in time' : 'The gateway could not be reached' };
    } finally {
        clearTimeout(timer);
    }
}

/** The sign-in code message, in the language the person uses the app in. *bold* is WhatsApp's own marking. */
const OTP_TEXT: Record<string, (code: string, minutes: number) => string> = {
    en: (code, m) => `*Whoply*\n\nYour sign-in code is *${code}*\n\nIt works for ${m} minutes. Do not share it with anyone — Whoply never asks for this code.`,
    hi: (code, m) => `*Whoply*\n\nआपका साइन-इन कोड *${code}* है\n\nयह ${m} मिनट तक चलेगा। इसे किसी को न बताएँ — Whoply यह कोड कभी नहीं माँगता।`,
    gu: (code, m) => `*Whoply*\n\nતમારો સાઇન-ઇન કોડ *${code}* છે\n\nઆ ${m} મિનિટ સુધી ચાલશે. તે કોઈને ન કહો — Whoply આ કોડ ક્યારેય માંગતું નથી.`,
};
export const otpMessage = (code: string, language = 'en'): string => (OTP_TEXT[language] || OTP_TEXT.en)(code, OTP_MINUTES);

/** Send a sign-in code to a login's own number. True when the gateway took it. */
export async function sendOtpOnWhatsApp(user: { mobile: string; countryCode?: string; language?: string }, code: string): Promise<boolean> {
    const gateway = await whatsappGateway();
    if (!gateway) return false;
    return (await sendWhatsAppText(whatsappNumber(user.mobile, user.countryCode), otpMessage(code, user.language), gateway)).ok;
}
