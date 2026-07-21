/**
 * Messaging & payments — STUBBED for MVP.
 * These log the intent and return a success shape so the product flow is complete.
 * Swap the bodies for real Gupshup/Twilio (WhatsApp) and Razorpay/UPI intents later.
 */

export interface WhatsAppResult {
    ok: boolean;
    to: string;
    channel: 'whatsapp';
    preview: string;
    stub: true;
}

export function sendWhatsApp(to: string, message: string): WhatsAppResult {
    console.log(`[whatsapp:stub] → ${to}: ${message}`);
    return { ok: true, to, channel: 'whatsapp', preview: message, stub: true };
}

/** Build a UPI intent string (upi://pay?...) — the app renders this as a QR. */
export function buildUpiIntent(params: { pa: string; pn: string; am: number; tn?: string }): string {
    const q = new URLSearchParams({
        pa: params.pa, // payee VPA
        pn: params.pn, // payee name
        am: String(params.am), // amount
        cu: 'INR',
        ...(params.tn && { tn: params.tn }), // note
    });
    return `upi://pay?${q.toString()}`;
}
