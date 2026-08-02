// VoteWise — Chapter 16 API Key Manager
//
// Generate, validate, and manage organization-scoped API keys with
// fine-grained permission scopes.

import { db } from '@/lib/db'
import { sha256, randomToken } from '@/lib/crypto'
import { recordEvent } from '@/lib/eifdirs'
import type { ApiKeyCreate, ApiKeyResult } from './types'

const KEY_PREFIX = 'vw_'

/**
 * Generate a new API key for an organization.
 * Returns the full key ONLY on creation — never again.
 */
export async function createApiKey(organizationId: string, input: ApiKeyCreate, createdById?: string, createdByName?: string): Promise<ApiKeyResult> {
  const fullKey = `${KEY_PREFIX}${randomToken(32)}`
  const keyHash = sha256(fullKey)
  const keyPrefix = fullKey.slice(0, 12) + '...'

  const apiKey = await db.apiKey.create({
    data: {
      organizationId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: JSON.stringify(input.scopes),
      environment: input.environment || 'production',
      expiresAt: input.expiresAt || null,
      createdById,
      createdByName,
    },
  })

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'INFO',
    description: `API key '${input.name}' created with scopes: ${input.scopes.join(', ')}`,
    actorId: createdById,
    actorName: createdByName,
    actorRole: 'ADMIN',
  })

  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix,
    fullKey,
    scopes: input.scopes,
    environment: apiKey.environment,
    expiresAt: apiKey.expiresAt?.toISOString() || null,
    createdAt: apiKey.createdAt.toISOString(),
  }
}

/**
 * Validate an API key and return the organization ID + scopes if valid.
 */
export async function validateApiKey(fullKey: string): Promise<{
  valid: boolean
  organizationId?: string
  apiKeyId?: string
  scopes?: string[]
  environment?: string
}> {
  if (!fullKey.startsWith(KEY_PREFIX)) {
    return { valid: false }
  }

  const keyHash = sha256(fullKey)
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, organizationId: true, scopes: true, environment: true, expiresAt: true, revokedAt: true },
  })

  if (!apiKey || apiKey.revokedAt) {
    return { valid: false }
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false }
  }

  // Update last used
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    valid: true,
    organizationId: apiKey.organizationId,
    apiKeyId: apiKey.id,
    scopes: JSON.parse(apiKey.scopes),
    environment: apiKey.environment,
  }
}

/**
 * Check if a scope is granted.
 */
export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes('manage:organizations')
}

/**
 * List API keys for an organization (without revealing the full key).
 */
export async function listApiKeys(organizationId: string) {
  const keys = await db.apiKey.findMany({
    where: { organizationId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, keyPrefix: true, scopes: true, environment: true,
      expiresAt: true, lastUsedAt: true, lastUsedIp: true, createdAt: true,
    },
  })

  return keys.map((k) => ({
    ...k,
    scopes: JSON.parse(k.scopes),
    expiresAt: k.expiresAt?.toISOString() || null,
    lastUsedAt: k.lastUsedAt?.toISOString() || null,
    createdAt: k.createdAt.toISOString(),
  }))
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(organizationId: string, keyId: string, revokedBy?: string): Promise<void> {
  const key = await db.apiKey.findUnique({ where: { id: keyId } })
  if (!key || key.organizationId !== organizationId) throw new Error('API key not found')

  await db.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  })

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'WARNING',
    description: `API key '${key.name}' revoked by ${revokedBy || 'admin'}`,
    actorId: revokedBy,
    actorRole: 'ADMIN',
  })
}
