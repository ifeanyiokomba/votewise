// Chapter 3 — reauthentication for critical account actions.
//
// Pulled out as a plain function (not inline in the route) specifically so
// it can be unit tested directly without needing to construct a real
// NextRequest/JWT session. The route handler is a thin wrapper around this.

import { verifyPassword, verifyTotp } from './crypto'

export interface ReauthCandidate {
  passwordHash: string
  totpEnabled: boolean
  totpSecret: string | null
}

export type ReauthResult =
  | { ok: true }
  | { ok: false; reason: 'MISSING_PASSWORD' | 'WRONG_PASSWORD' | 'MISSING_TOTP' | 'WRONG_TOTP' }

/**
 * Verify that the person making this request can currently prove they are
 * the account holder — not just that they're holding a valid bearer token.
 * Requires the current password always, and the current TOTP code if the
 * account has 2FA enabled. Used before actions where a stolen-but-not-yet-
 * revoked access token should not be sufficient on its own: disabling 2FA
 * is the first consumer, and this is written to be reused anywhere else in
 * the app that needs the same "prove you're still you" gate.
 */
export function verifyReauth(
  official: ReauthCandidate,
  supplied: { password?: string; totp?: string },
): ReauthResult {
  if (!supplied.password) return { ok: false, reason: 'MISSING_PASSWORD' }
  if (!verifyPassword(supplied.password, official.passwordHash)) {
    return { ok: false, reason: 'WRONG_PASSWORD' }
  }
  if (official.totpEnabled) {
    if (!supplied.totp) return { ok: false, reason: 'MISSING_TOTP' }
    if (!verifyTotp(supplied.totp, official.totpSecret!)) {
      return { ok: false, reason: 'WRONG_TOTP' }
    }
  }
  return { ok: true }
}
