// VoteWise — Shared Input Validation (Enterprise Audit Part 4)
//
// Spec: "Every API route should validate input. Use Zod schemas."
//
// This module provides reusable Zod schemas for common API inputs.
// Usage:
//   import { schemas, validate } from '@/lib/validation'
//   const result = validate(schemas.login, body)
//   if (!result.success) return errorJson(result.error, 400)

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const schemas = {
  // Authentication
  login: z.object({
    email: z.string().email('Valid email required'),
    password: z.string().min(1, 'Password required'),
    mfaCode: z.string().optional(),
  }),

  // Voter
  verifyMatric: z.object({
    matricNumber: z.string().min(1, 'Matriculation number required'),
  }),

  sendOtp: z.object({
    matricNumber: z.string().min(1),
    phone: z.string().optional(),
  }),

  verifyOtp: z.object({
    matricNumber: z.string().min(1),
    code: z.string().length(6, 'OTP must be 6 digits'),
  }),

  // Vote casting
  voteCast: z.object({
    electionId: z.string().min(1, 'Election ID required'),
    selections: z.array(
      z.object({
        positionId: z.string().min(1),
        candidateId: z.string().min(1),
      }),
    ).min(1, 'At least one selection required'),
    receipt: z.boolean().optional(),
  }),

  // Election
  createElection: z.object({
    name: z.string().min(1, 'Name required').max(200, 'Name too long'),
    organizationId: z.string().min(1),
    description: z.string().max(2000).optional(),
    startTime: z.union([z.string(), z.date()]),
    endTime: z.union([z.string(), z.date()]),
    category: z.string().optional(),
    electionType: z.string().optional(),
    visibility: z.string().optional(),
  }),

  updateElection: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED', 'CERTIFIED', 'ARCHIVED']).optional(),
    startTime: z.union([z.string(), z.date()]).optional(),
    endTime: z.union([z.string(), z.date()]).optional(),
    settings: z.record(z.any()).optional(),
  }),

  // Organization
  registerOrg: z.object({
    name: z.string().min(1, 'Organization name required').max(200),
    subdomain: z.string().min(2, 'Subdomain too short').max(30, 'Subdomain too long').regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric'),
    ownerEmail: z.string().email('Valid email required'),
    ownerName: z.string().min(1, 'Owner name required'),
    category: z.string().optional(),
  }),

  // Candidate
  createCandidate: z.object({
    fullName: z.string().min(1, 'Full name required').max(200),
    positionId: z.string().min(1),
    biography: z.string().max(5000).optional(),
    manifesto: z.string().max(10000).optional(),
    photoUrl: z.string().url().optional(),
    campaignVideoUrl: z.string().url().optional(),
  }),

  // Support chat
  createConversation: z.object({
    organizationId: z.string().min(1),
    voterName: z.string().optional(),
    subject: z.string().max(200).optional(),
    category: z.enum(['OTP', 'ELIGIBILITY', 'TECHNICAL', 'OTHER']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  }),

  sendMessage: z.object({
    sender: z.enum(['VOTER', 'BOT', 'OFFICIAL']),
    content: z.string().min(1, 'Message content required').max(5000),
    isInternalNote: z.boolean().optional(),
  }),

  // API key
  createApiKey: z.object({
    name: z.string().min(1, 'Name required').max(100),
    scopes: z.array(z.string()).min(1, 'At least one scope required'),
    environment: z.enum(['production', 'sandbox']),
    expiresAt: z.string().optional(),
  }),

  // Webhook
  createWebhook: z.object({
    name: z.string().min(1).max(100),
    url: z.string().url('Valid URL required'),
    events: z.array(z.string()).min(1, 'At least one event required'),
  }),

  // Custom domain
  addDomain: z.object({
    organizationId: z.string().min(1),
    domain: z.string().min(3, 'Domain too short').regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i, 'Invalid domain format'),
    type: z.enum(['subdomain', 'apex', 'wildcard']).optional(),
    primary: z.boolean().optional(),
  }),

  // Readiness check
  runReadiness: z.object({
    expectedVoters: z.number().int().min(0).optional(),
    organizationId: z.string().optional(),
    electionId: z.string().optional(),
    notes: z.string().max(500).optional(),
  }),

  // Certification
  issueCertification: z.object({
    electionId: z.string().min(1),
    electionName: z.string().min(1),
    organizationId: z.string().optional(),
    organizationName: z.string().optional(),
    integrityScore: z.number().min(0).max(100).optional(),
    votesVerified: z.number().int().min(0).optional(),
  }),

  // Pagination
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string; details?: any } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  // Zod 4 uses .issues, Zod 3 uses .errors — support both
  const issues = (result.error as any).issues || (result.error as any).errors || []
  const firstError = issues[0]
  return {
    success: false,
    error: firstError?.message || 'Validation failed',
    details: issues,
  }
}

/**
 * Validate and return a 400 response on failure, or the validated data on success.
 * Usage:
 *   const [data, errorResponse] = validateOrError(schemas.login, body)
 *   if (errorResponse) return errorResponse
 *   // use data.email, data.password
 */
export function validateOrError<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): [T | null, NextResponse | null] {
  const result = validate(schema, data)
  if (result.success) {
    return [result.data, null]
  }
  return [null, NextResponse.json(
    { error: result.error, details: result.details },
    { status: 400 },
  )]
}

// Lazy import to avoid circular dependency in edge cases
import { NextResponse } from 'next/server'
