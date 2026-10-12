/**
 * Platform admin — the WhatsApp gateway (Whatsline) that sends sign-in codes.
 *
 *   GET  /admin/whatsapp        the switch, sender number, address; whether a token is saved
 *   PUT  /admin/whatsapp        { enabled?, from?, apiUrl?, token? } — what isn't sent stays
 *   POST /admin/whatsapp/test   { mobile } — one test message, to check the set-up
 *
 * The token is write-only: it is stored sealed and no reply ever holds it.
 */
import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import { env } from '../../config/env.js';
import PlatformSettings, { getPlatformSettings } from '../../models/PlatformSettings.js';
import { DEFAULT_WHATSAPP_API_URL, forgetWhatsappSetup, sealWhatsappToken, sendWhatsAppText, whatsappSetup } from '../../services/whatsapp.service.js';
import type { AuthRequest } from '../../interfaces/index.js';

const schema = z
    .object({
        enabled: z.boolean(),
        from: z.string().trim().max(20),
        apiUrl: z.string().trim().max(300),
        token: z.string().trim().max(500),
    })
    .partial();

/** A mobile number as the gateway takes it: digits with the country code. Ten digits are read as an Indian number. */
function gatewayNumber(raw: string, what: string): string {
    const digits = raw.replace(/\D/g, '');
    const full = /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : digits;
    if (!/^\d{11,15}$/.test(full)) throw AppError.badRequest(`${what} must be a mobile number with its country code, like 919876543210`);
    return full;
}

/** The gateway's address. A live server only talks to a real https site — never to an address inside its own network. */
function gatewayUrl(raw: string): string {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw AppError.badRequest('The API address must be a full web address, like https://whatsline.io/api/qr/rest/send_message');
    }
    const live = env.NODE_ENV === 'production';
    const inside = url.hostname === 'localhost' || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':');
    if (url.protocol !== 'https:' && (live || url.protocol !== 'http:')) throw AppError.badRequest('The API address must start with https://');
    if (live && inside) throw AppError.badRequest('The API address must be a web address, not a number or localhost');
    return url.toString();
}

const shape = async () => {
    const s = await whatsappSetup();
    return { enabled: s.enabled, from: s.from, apiUrl: s.apiUrl, tokenSet: s.tokenSet, ready: s.enabled && !!s.gateway };
};

/** GET /admin/whatsapp */
export const getWhatsapp = asyncHandler(async (_req: AuthRequest, res: Response) => {
    forgetWhatsappSetup(); // the settings page always shows what is saved, not what this process remembers
    sendSuccess(res, await shape());
});

/** PUT /admin/whatsapp */
export const updateWhatsapp = asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = schema.parse(req.body);
    await getPlatformSettings(); // make sure the document exists
    forgetWhatsappSetup();
    const now = await whatsappSetup();

    const set: Record<string, unknown> = {};
    if (body.from !== undefined) set['whatsapp.from'] = body.from === '' ? '' : gatewayNumber(body.from, 'The sender number');
    if (body.apiUrl !== undefined) set['whatsapp.apiUrl'] = gatewayUrl(body.apiUrl || DEFAULT_WHATSAPP_API_URL);
    // An empty token means "keep the one that is saved".
    if (body.token) set['whatsapp.token'] = sealWhatsappToken(body.token);
    if (body.enabled !== undefined) set['whatsapp.enabled'] = body.enabled;

    const from = set['whatsapp.from'] !== undefined ? set['whatsapp.from'] : now.from;
    const enabled = body.enabled !== undefined ? body.enabled : now.enabled;
    if (enabled && (!from || !(body.token || now.tokenSet))) throw AppError.badRequest('Add the sender number and the token before turning WhatsApp on');

    if (Object.keys(set).length) await PlatformSettings.updateOne({ key: 'main' }, { $set: set }, { runValidators: true });
    forgetWhatsappSetup();
    sendSuccess(res, await shape(), 'WhatsApp settings saved');
});

/** POST /admin/whatsapp/test { mobile } — works before the switch is on, so the set-up can be tried first. */
export const testWhatsapp = asyncHandler(async (req: AuthRequest, res: Response) => {
    const to = gatewayNumber(String(req.body?.mobile ?? ''), 'The number to test with');
    forgetWhatsappSetup();
    const { gateway } = await whatsappSetup();
    if (!gateway) throw AppError.badRequest('Save the sender number and the token first');
    const result = await sendWhatsAppText(to, '*Whoply*\n\nThis is a test message from your Whoply admin panel. WhatsApp sending works. ✅', gateway);
    sendSuccess(res, { ok: result.ok, detail: result.detail, to }, result.ok ? 'The gateway accepted the test message' : 'The test message was not sent');
});
