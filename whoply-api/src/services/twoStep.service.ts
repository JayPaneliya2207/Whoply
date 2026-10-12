/**
 * Two-step sign-in for platform admin logins: after the password, a 6-digit
 * code from an authenticator app (utils/totp.ts). Each admin turns it on for
 * their own login; until then the password alone signs them in.
 */
import { findStep, plainRecovery, recoveryHash, unseal } from '../utils/totp.js';
import AdminUser from '../models/AdminUser.js';

/** Add to a `select()` so `spendCode` can read what it needs (hidden by default). */
export const TWO_STEP_FIELDS = '+twoFactor.secret';
/** Error code of "the password was right, now send the code" — the sign-in screen shows its second step on it. */
export const CODE_NEEDED = 'CODE_NEEDED';

type WithTwoStep = { _id: unknown; twoFactor?: { on?: boolean; secret?: string } | null };

/**
 * Is this the right code for this login, right now? A right code is used up by
 * the call: an authenticator code works once (so does everything before it),
 * and a recovery code is struck off the list.
 *
 * - 'ok'         go on
 * - 'wrong'      count it as a wrong try
 * - 'used'       a right code that was already used — wait for the next one
 * - 'unreadable' the stored secret can not be opened (JWT_SECRET was changed)
 */
export async function spendCode(user: WithTwoStep, raw: unknown): Promise<'ok' | 'wrong' | 'used' | 'unreadable'> {
    const typed = String(raw ?? '').trim();
    const digits = typed.replace(/[\s-]/g, '');
    if (/^\d{6}$/.test(digits)) {
        const secret = unseal(user.twoFactor?.secret);
        if (!secret) return 'unreadable';
        const step = findStep(secret, digits);
        if (step === null) return 'wrong';
        // One atomic step: of two sign-ins sent with the same code at the same moment, one gets in.
        const took = await AdminUser.updateOne(
            { _id: user._id as any, $or: [{ 'twoFactor.lastStep': { $lt: step } }, { 'twoFactor.lastStep': null }] },
            { $set: { 'twoFactor.lastStep': step } }
        );
        return took.modifiedCount === 1 ? 'ok' : 'used';
    }
    if (!plainRecovery(typed)) return 'wrong';
    const hash = recoveryHash(typed);
    const took = await AdminUser.updateOne({ _id: user._id as any, 'twoFactor.recovery': hash }, { $pull: { 'twoFactor.recovery': hash } });
    return took.modifiedCount === 1 ? 'ok' : 'wrong';
}
