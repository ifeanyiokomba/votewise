// VoteWise — Secret Management
//
// ALL secrets MUST come from environment variables. No hardcoded fallbacks.
// If a required secret is missing, the process fails immediately with a clear
// error — fail loud, not silent.
//
// This module is imported by both the main Next.js app (via src/lib/crypto.ts
// and src/lib/sve/crypto.ts) and the results-service mini-service (which has
// its own copy at mini-services/results-service/index.ts — they MUST stay in
// sync, or votes encrypted by the app won't decrypt in the service).
//
// Required environment variables:
//   VOTE_ENC_KEY      — 32+ char hex/string for AES-256-GCM vote encryption
//   VOTER_HASH_PEPPER — pepper for legacy voter hashing (hashVoter)
//   HMAC_SECRET       — HMAC-SHA256 signing key (tokens, snapshots, audit)
//   SVE_BALLOT_PEPPER — pepper for SVE ballot integrity tokens + audit hash
//   SVE_VOTER_PEPPER  — pepper for SVE voter identity hashing
//
// Generate with: openssl rand -hex 32

function requireSecret(name: string): string {
  const value = process.env[name]
  if (!value || value.length < 16) {
    throw new Error(
      `[security] FATAL: Required secret "${name}" is missing or too short (min 16 chars). ` +
      `Set it in the environment (e.g. openssl rand -hex 32). ` +
      `The process cannot start safely without it.`
    )
  }
  return value
}

// Export eagerly-evaluated secrets — if any is missing, the process crashes
// at import time with a clear message rather than running silently on defaults.
export const VOTE_ENC_KEY = requireSecret('VOTE_ENC_KEY')
export const VOTER_HASH_PEPPER = requireSecret('VOTER_HASH_PEPPER')
export const HMAC_SECRET = requireSecret('HMAC_SECRET')
export const SVE_BALLOT_PEPPER = requireSecret('SVE_BALLOT_PEPPER')
export const SVE_VOTER_PEPPER = requireSecret('SVE_VOTER_PEPPER')

// Optional — has a safe default.
export const VOTE_KEY_ID = process.env.VOTE_KEY_ID || 'v1'

// ---------------------------------------------------------------------------
// Secret verification + management helpers (consolidated from infra/secrets.ts)
// ---------------------------------------------------------------------------

/**
 * Verify all required secrets are present. Returns missing list.
 * Used by the readiness checker.
 */
export function verifySecrets(): { ok: boolean; missing: string[] } {
  const required = ['VOTE_ENC_KEY', 'VOTER_HASH_PEPPER', 'HMAC_SECRET', 'SVE_BALLOT_PEPPER', 'SVE_VOTER_PEPPER']
  const missing = required.filter((k) => !process.env[k] || process.env[k]!.length < 16)
  return { ok: missing.length === 0, missing }
}

/**
 * Get a secret (returns undefined if missing). Use for optional secrets.
 */
export function getSecret(key: string): string | undefined {
  const v = process.env[key]
  if (!v || v.length < 16) return undefined
  return v
}
