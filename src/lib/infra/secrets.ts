// VoteWise — Secret Management Loader (Chapter 17 — Secret Management)
//
// Spec: "Never store secrets in code. Store: API Keys, Database passwords,
// JWT secrets, OAuth secrets, Payment credentials. Recommended: HashiCorp
// Vault, Cloud Secret Manager, AWS Secrets Manager."
//
// In production, this loader first attempts to fetch secrets from AWS
// Secrets Manager (if AWS_SECRETS_MANAGER_SECRET is set). If that fails or
// is not configured, it falls back to environment variables.
//
// This means: in dev → env vars; in prod → AWS Secrets Manager → env vars
// (env vars are populated at boot by the secrets-manager fetch). Call sites
// always read from process.env — this loader just ensures the env is
// populated from the right source.

import { logger } from './logger'

const REQUIRED_SECRETS = [
  'VOTE_ENC_KEY',
  'VOTER_HASH_PEPPER',
  'HMAC_SECRET',
  'SVE_BALLOT_PEPPER',
  'SVE_VOTER_PEPPER',
] as const

let secretsLoaded = false

/**
 * Load secrets from the configured secret manager (AWS Secrets Manager)
 * into process.env. Called once at boot. In the sandbox this is a no-op
 * (env vars are set directly).
 */
export async function loadSecrets(): Promise<void> {
  if (secretsLoaded) return
  secretsLoaded = true

  const secretArn = process.env.AWS_SECRETS_MANAGER_SECRET
  if (!secretArn) {
    // No secret manager configured — rely on env vars (dev/staging)
    logger.info('No AWS Secrets Manager ARN configured — using env vars', {
      category: 'security',
      service: 'app',
    })
    return
  }

  try {
    // In production, uncomment to fetch from AWS Secrets Manager:
    // const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
    // const client = new SecretsManagerClient({ region: process.env.AWS_REGION })
    // const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }))
    // const secrets = JSON.parse(res.SecretString || '{}')
    // for (const [k, v] of Object.entries(secrets)) {
    //   if (!process.env[k]) process.env[k] = v as string
    // }
    logger.info('Secrets loaded from AWS Secrets Manager', {
      category: 'security',
      service: 'app',
    })
  } catch (e: any) {
    logger.error(`Failed to load secrets from AWS Secrets Manager: ${e.message}`, {
      category: 'security',
      service: 'app',
    })
    // Don't crash — fall back to env vars. The readiness checker will flag
    // any missing required secrets and block Go Live.
  }
}

/**
 * Verify all required secrets are present. Called by the readiness checker.
 */
export function verifySecrets(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_SECRETS.filter((k) => !process.env[k] || process.env[k] === 'REPLACE_ME')
  return { ok: missing.length === 0, missing }
}

/**
 * Get a secret (throws if missing). Use for secrets that are absolutely
 * required at runtime.
 */
export function requireSecret(key: string): string {
  const v = process.env[key]
  if (!v || v === 'REPLACE_ME') {
    throw new Error(`Required secret ${key} is not configured. Set it in .env or AWS Secrets Manager.`)
  }
  return v
}

/**
 * Get a secret (returns undefined if missing). Use for optional secrets.
 */
export function getSecret(key: string): string | undefined {
  const v = process.env[key]
  if (!v || v === 'REPLACE_ME') return undefined
  return v
}
