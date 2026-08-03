// VoteWise — Platform Credential Manager
//
// Securely stores, retrieves, and syncs API keys for all providers
// (Resend, Termii, Paystack, Flutterwave, Stripe, Sentry, S3, Slack, Teams).
//
// Credentials are encrypted at rest with AES-256-GCM using VOTE_ENC_KEY.
// At runtime, they're synced to process.env so all existing code that reads
// process.env.RESEND_API_KEY etc. works seamlessly without changes.
//
// The admin UI at /admin/credentials provides a secure interface for
// inputting, rotating, and verifying these keys.

import { db } from '@/lib/db'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const key = process.env.VOTE_ENC_KEY
  if (!key || key.length < 16) {
    throw new Error('VOTE_ENC_KEY is required for credential encryption')
  }
  // AES-256 requires exactly 32 bytes. If the key is shorter, pad with zeros.
  // If longer, truncate to 32 bytes.
  const keyBytes = Buffer.from(key, 'utf-8')
  if (keyBytes.length >= 32) return keyBytes.subarray(0, 32)
  const padded = Buffer.alloc(32)
  keyBytes.copy(padded)
  return padded
}

function encrypt(value: string): { encrypted: string; iv: string } {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Store as base64: encrypted + authTag (last 16 bytes)
  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('base64'),
  }
}

function decrypt(encryptedValue: string, iv: string): string {
  const data = Buffer.from(encryptedValue, 'base64')
  const authTag = data.subarray(data.length - 16)
  const encrypted = data.subarray(0, data.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function maskValue(value: string): string {
  if (!value || value.length < 8) return '****'
  if (value.length <= 12) return value.slice(0, 2) + '****' + value.slice(-2)
  return value.slice(0, 4) + '...' + value.slice(-4)
}

// ---------------------------------------------------------------------------
// Credential definitions — the full catalog of provider keys
// ---------------------------------------------------------------------------

export interface CredentialDefinition {
  key: string
  displayName: string
  category: string
  provider: string
  description: string
  isRequired: boolean
  placeholder: string
  verifyUrl?: string // URL to test the key against
}

export const CREDENTIAL_CATALOG: CredentialDefinition[] = [
  // Email — Resend (cheapest email API, 3K free/month)
  { key: 'RESEND_API_KEY', displayName: 'Resend API Key', category: 'EMAIL', provider: 'resend', description: 'Used for sending OTVP codes and notifications via email. Free tier: 3,000 emails/month.', isRequired: false, placeholder: 're_abc123...', verifyUrl: 'https://api.resend.com/domains' },
  // SMS — Termii (cheapest Nigerian SMS gateway, supports SMS + WhatsApp)
  { key: 'TERMII_API_KEY', displayName: 'Termii API Key', category: 'SMS', provider: 'termii', description: 'Used for sending OTVP codes via SMS to Nigerian phone numbers (MTN, Glo, Airtel, 9mobile). ~₦2-4 per SMS.', isRequired: false, placeholder: 'TLxxxxx...', verifyUrl: 'https://api.termii.com/sender-id' },
  { key: 'TERMII_SENDER_ID', displayName: 'Termii Sender ID', category: 'SMS', provider: 'termii', description: 'The sender name that appears on SMS messages (max 11 chars)', isRequired: false, placeholder: 'VoteWise' },
  // WhatsApp — Termii (same provider, cheapest for Nigeria)
  { key: 'TERMII_WHATSAPP_KEY', displayName: 'Termii WhatsApp Key', category: 'WHATSAPP', provider: 'termii', description: 'Key for WhatsApp message delivery via Termii. Usually same as SMS key. ~₦5 per message.', isRequired: false, placeholder: 'TLxxxxx...' },
  // Payment — Paystack only (Nigerian payment gateway)
  { key: 'PAYSTACK_SECRET_KEY', displayName: 'Paystack Secret Key', category: 'PAYMENT', provider: 'paystack', description: 'Server-side key for verifying payments. Get from dashboard.paystack.com. Must start with sk_live_ for production.', isRequired: false, placeholder: 'sk_live_...', verifyUrl: 'https://api.paystack.co/transaction' },
  { key: 'PAYSTACK_PUBLIC_KEY', displayName: 'Paystack Public Key', category: 'PAYMENT', provider: 'paystack', description: 'Client-side key for initiating payments. Get from dashboard.paystack.com.', isRequired: false, placeholder: 'pk_live_...' },
  // Monitoring
  { key: 'SENTRY_DSN', displayName: 'Sentry DSN', category: 'MONITORING', provider: 'sentry', description: 'Error tracking and performance monitoring. Free tier: 5,000 errors/month.', isRequired: false, placeholder: 'https://xxx@sentry.io/xxx' },
  // Storage
  { key: 'S3_BUCKET', displayName: 'S3/R2 Bucket Name', category: 'STORAGE', provider: 's3', description: 'Object storage bucket for logos, reports, evidence. Cloudflare R2 recommended (10GB free, 0 egress).', isRequired: false, placeholder: 'votewise-production-storage' },
  { key: 'S3_REGION', displayName: 'S3/R2 Region', category: 'STORAGE', provider: 's3', description: 'AWS region or Cloudflare R2 region', isRequired: false, placeholder: 'eu-west-1' },
  { key: 'S3_ACCESS_KEY', displayName: 'S3/R2 Access Key', category: 'STORAGE', provider: 's3', description: 'Access key ID for S3/R2 storage', isRequired: false, placeholder: 'AKIA...' },
  { key: 'S3_SECRET_KEY', displayName: 'S3/R2 Secret Key', category: 'STORAGE', provider: 's3', description: 'Secret access key for S3/R2 storage', isRequired: false, placeholder: 'xxxx...' },
  // Notifications (alerts)
  { key: 'SLACK_WEBHOOK_URL', displayName: 'Slack Webhook URL', category: 'NOTIFICATION', provider: 'slack', description: 'Incoming webhook for posting alerts to Slack', isRequired: false, placeholder: 'https://hooks.slack.com/services/...' },
  { key: 'TEAMS_WEBHOOK_URL', displayName: 'Teams Webhook URL', category: 'NOTIFICATION', provider: 'teams', description: 'Incoming webhook for posting alerts to Microsoft Teams', isRequired: false, placeholder: 'https://outlook.office.com/webhook/...' },
  // Database
  { key: 'DATABASE_URL', displayName: 'Database URL', category: 'DATABASE', provider: 'postgresql', description: 'PostgreSQL connection string (production). Currently SQLite in sandbox.', isRequired: true, placeholder: 'postgresql://user:pass@host:5432/db' },
  { key: 'DATABASE_REPLICA_URL', displayName: 'Database Replica URL', category: 'DATABASE', provider: 'postgresql', description: 'Read replica for analytics queries (optional)', isRequired: false, placeholder: 'postgresql://user:pass@replica:5432/db' },
  // Cache
  { key: 'REDIS_URL', displayName: 'Redis URL', category: 'CACHE', provider: 'redis', description: 'Redis connection for sessions, rate limiting, and caching', isRequired: false, placeholder: 'redis://localhost:6379' },
  // OAuth
  { key: 'GOOGLE_CLIENT_ID', displayName: 'Google OAuth Client ID', category: 'OAUTH', provider: 'google', description: 'For Google SSO integrations', isRequired: false, placeholder: 'xxx.apps.googleusercontent.com' },
  { key: 'GOOGLE_CLIENT_SECRET', displayName: 'Google OAuth Client Secret', category: 'OAUTH', provider: 'google', description: 'For Google SSO integrations', isRequired: false, placeholder: 'GOCSPX-...' },
]

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function setCredential(key: string, value: string): Promise<void> {
  const def = CREDENTIAL_CATALOG.find((c) => c.key === key)
  if (!def) throw new Error(`Unknown credential key: ${key}`)

  const { encrypted, iv } = encrypt(value)
  const masked = maskValue(value)

  await db.platformCredential.upsert({
    where: { key },
    create: {
      key,
      displayName: def.displayName,
      category: def.category,
      provider: def.provider,
      description: def.description,
      encryptedValue: encrypted,
      iv,
      maskedValue: masked,
      isConfigured: true,
      isRequired: def.isRequired,
      lastRotatedAt: new Date(),
      lastVerifiedStatus: 'UNTESTED',
    },
    update: {
      encryptedValue: encrypted,
      iv,
      maskedValue: masked,
      isConfigured: true,
      lastRotatedAt: new Date(),
      lastVerifiedStatus: 'UNTESTED',
    },
  })

  // Sync to process.env so all code that reads process.env works
  process.env[key] = value
}

export async function getCredential(key: string): Promise<string | null> {
  // First check process.env (may have been set at startup)
  if (process.env[key]) return process.env[key]

  // Then check the database
  const cred = await db.platformCredential.findUnique({ where: { key } })
  if (!cred || !cred.isConfigured) return null

  const value = decrypt(cred.encryptedValue, cred.iv)
  // Sync to process.env for future reads
  process.env[key] = value
  return value
}

export async function deleteCredential(key: string): Promise<void> {
  await db.platformCredential.update({
    where: { key },
    data: {
      encryptedValue: '',
      iv: '',
      maskedValue: '',
      isConfigured: false,
      lastVerifiedStatus: null,
    },
  }).catch(() => {})

  // Remove from process.env
  delete process.env[key]
}

export async function listCredentials() {
  const creds = await db.platformCredential.findMany({
    orderBy: { category: 'asc' },
  })

  // Merge with catalog (show all defined keys, even if not yet configured)
  const configuredMap = new Map(creds.map((c) => [c.key, c]))
  return CREDENTIAL_CATALOG.map((def) => {
    const cred = configuredMap.get(def.key)
    return {
      key: def.key,
      displayName: def.displayName,
      category: def.category,
      provider: def.provider,
      description: def.description,
      isRequired: def.isRequired,
      placeholder: def.placeholder,
      isConfigured: cred?.isConfigured || false,
      maskedValue: cred?.maskedValue || null,
      lastRotatedAt: cred?.lastRotatedAt?.toISOString() || null,
      lastVerifiedAt: cred?.lastVerifiedAt?.toISOString() || null,
      lastVerifiedStatus: cred?.lastVerifiedStatus || null,
    }
  })
}

export async function getCredentialStats() {
  const total = CREDENTIAL_CATALOG.length
  const configured = CREDENTIAL_CATALOG.filter((c) => process.env[c.key]).length
  const required = CREDENTIAL_CATALOG.filter((c) => c.isRequired).length
  const requiredConfigured = CREDENTIAL_CATALOG.filter((c) => c.isRequired && process.env[c.key]).length

  const byCategory: Record<string, { total: number; configured: number }> = {}
  for (const def of CREDENTIAL_CATALOG) {
    if (!byCategory[def.category]) byCategory[def.category] = { total: 0, configured: 0 }
    byCategory[def.category].total++
    if (process.env[def.key]) byCategory[def.category].configured++
  }

  return {
    total,
    configured,
    missing: total - configured,
    required,
    requiredConfigured,
    requiredMissing: required - requiredConfigured,
    byCategory,
    allRequiredConfigured: requiredConfigured === required,
  }
}

/**
 * Verify a credential by making a test API call to the provider.
 * Returns { valid: boolean, message: string }
 */
export async function verifyCredential(key: string): Promise<{ valid: boolean; message: string }> {
  const value = await getCredential(key)
  if (!value) return { valid: false, message: 'Credential not configured' }

  const def = CREDENTIAL_CATALOG.find((c) => c.key === key)
  if (!def?.verifyUrl) return { valid: true, message: 'No verification URL defined — key is stored' }

  try {
    let res: Response
    if (key === 'RESEND_API_KEY') {
      res = await fetch(def.verifyUrl, { headers: { Authorization: `Bearer ${value}` } })
    } else if (key === 'PAYSTACK_SECRET_KEY') {
      res = await fetch(def.verifyUrl, { headers: { Authorization: `Bearer ${value}` } })
    } else if (key === 'TERMII_API_KEY') {
      res = await fetch(def.verifyUrl, { headers: { Authorization: `Bearer ${value}` } })
    } else {
      return { valid: true, message: 'Verification not implemented for this provider — key is stored' }
    }

    const valid = res.ok
    const message = valid ? 'Credential verified successfully' : `Provider returned HTTP ${res.status}`

    // Update the verification status in the DB
    await db.platformCredential.update({
      where: { key },
      data: {
        lastVerifiedAt: new Date(),
        lastVerifiedStatus: valid ? 'VALID' : 'INVALID',
      },
    }).catch(() => {})

    return { valid, message }
  } catch (e: any) {
    await db.platformCredential.update({
      where: { key },
      data: {
        lastVerifiedAt: new Date(),
        lastVerifiedStatus: 'INVALID',
      },
    }).catch(() => {})

    return { valid: false, message: e.message || 'Verification failed' }
  }
}

/**
 * Sync all configured credentials from the database to process.env.
 * Called at application startup.
 */
export async function syncCredentialsToEnv(): Promise<void> {
  const creds = await db.platformCredential.findMany({
    where: { isConfigured: true },
  }).catch(() => [])

  for (const cred of creds) {
    try {
      const value = decrypt(cred.encryptedValue, cred.iv)
      process.env[cred.key] = value
    } catch {
      // Decryption failed — skip this credential
    }
  }
}
