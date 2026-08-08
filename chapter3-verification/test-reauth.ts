// Chapter 3 verification: verifyReauth against the real crypto functions.
// No mocking needed here — hashPassword/verifyPassword/generateTotpSecret/
// verifyTotp are all pure functions with no database dependency, so this
// exercises the actual, complete, real code path end to end.
//
// Run with:
//   npx tsx --tsconfig tsconfig.test.json chapter3-verification/test-reauth.ts

process.env.VOTE_ENC_KEY = 'a'.repeat(64)
process.env.VOTER_HASH_PEPPER = 'b'.repeat(32)
process.env.HMAC_SECRET = 'c'.repeat(32)
process.env.SVE_BALLOT_PEPPER = 'd'.repeat(32)
process.env.SVE_VOTER_PEPPER = 'e'.repeat(32)

import { hashPassword, generateTotpSecret, generateTotp, base32Decode } from '../src/lib/crypto'
import { verifyReauth } from '../src/lib/reauth'

let failures = 0

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`PASS: ${label}`)
  } else {
    console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
    failures++
  }
}

function main() {
  console.log('--- Chapter 3: verifyReauth verification (real crypto, no mocks) ---\n')

  const realPassword = 'correct horse battery staple'
  const passwordHash = hashPassword(realPassword)
  const totpSecret = generateTotpSecret()
  const currentCode = generateTotp(base32Decode(totpSecret), Math.floor(Date.now() / 1000 / 30))

  // --- Account with 2FA NOT enabled ---
  const noMfaAccount = { passwordHash, totpEnabled: false, totpSecret: null }

  let r = verifyReauth(noMfaAccount, {})
  check('No 2FA, no password supplied -> MISSING_PASSWORD', !r.ok && r.reason === 'MISSING_PASSWORD')

  r = verifyReauth(noMfaAccount, { password: 'wrong password entirely' })
  check('No 2FA, wrong password -> WRONG_PASSWORD', !r.ok && r.reason === 'WRONG_PASSWORD')

  r = verifyReauth(noMfaAccount, { password: realPassword })
  check('No 2FA, correct password, no TOTP needed -> ok', r.ok === true)

  // --- Account WITH 2FA enabled — this is the actually-consumed path for
  // the roles requires2FA() applies to, and the one that mattered for the
  // vulnerability this closes. ---
  const mfaAccount = { passwordHash, totpEnabled: true, totpSecret }

  r = verifyReauth(mfaAccount, { password: realPassword })
  check('2FA enabled, correct password, no TOTP supplied -> MISSING_TOTP', !r.ok && r.reason === 'MISSING_TOTP')

  r = verifyReauth(mfaAccount, { password: realPassword, totp: '000000' })
  check('2FA enabled, correct password, wrong TOTP -> WRONG_TOTP (unless 000000 is genuinely current, astronomically unlikely)', !r.ok && r.reason === 'WRONG_TOTP')

  r = verifyReauth(mfaAccount, { password: realPassword, totp: currentCode })
  check('2FA enabled, correct password, correct current TOTP -> ok', r.ok === true, JSON.stringify(r))

  r = verifyReauth(mfaAccount, { totp: currentCode })
  check('2FA enabled, correct TOTP but NO password -> MISSING_PASSWORD (password checked first, TOTP alone is not enough)', !r.ok && r.reason === 'MISSING_PASSWORD')

  console.log(`\n--- ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} ---`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
