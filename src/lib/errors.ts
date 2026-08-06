// VoteWise — Standardized Error Codes (Enterprise Audit Part 4)
//
// Spec: "Every API should have consistent responses. Avoid exposing database
// errors, stack traces, internal IDs."
//
// All API errors return a consistent shape:
//   { success: false, error: { code: "OTVP_EXPIRED", message: "Your voting password has expired" } }

import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Error codes — the complete catalog
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  // Authentication errors (401)
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please log in again.', status: 401 },
  TOKEN_INVALID: { code: 'TOKEN_INVALID', message: 'Invalid authentication token', status: 401 },
  MFA_REQUIRED: { code: 'MFA_REQUIRED', message: 'Multi-factor authentication required', status: 401 },
  MFA_INVALID: { code: 'MFA_INVALID', message: 'Invalid MFA code', status: 401 },
  ACCOUNT_LOCKED: { code: 'ACCOUNT_LOCKED', message: 'Account locked due to too many failed attempts', status: 401 },

  // Authorization errors (403)
  FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action', status: 403 },
  INSUFFICIENT_ROLE: { code: 'INSUFFICIENT_ROLE', message: 'Your role does not allow this action', status: 403 },
  ORG_MISMATCH: { code: 'ORG_MISMATCH', message: 'You can only access your own organization', status: 403 },
  ELECTION_LOCKED: { code: 'ELECTION_LOCKED', message: 'This election is locked and cannot be modified', status: 403 },
  READINESS_FAILED: { code: 'READINESS_FAILED', message: 'Election readiness check failed. Resolve critical issues before going live.', status: 403 },

  // Not found (404)
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Resource not found', status: 404 },
  ELECTION_NOT_FOUND: { code: 'ELECTION_NOT_FOUND', message: 'Election not found', status: 404 },
  VOTER_NOT_FOUND: { code: 'VOTER_NOT_FOUND', message: 'Voter not found', status: 404 },
  ORGANIZATION_NOT_FOUND: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found', status: 404 },

  // Validation errors (400)
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', message: 'Input validation failed', status: 400 },
  INVALID_INPUT: { code: 'INVALID_INPUT', message: 'Invalid input provided', status: 400 },
  DUPLICATE_ENTRY: { code: 'DUPLICATE_ENTRY', message: 'A record with this identifier already exists', status: 400 },
  SUBDOMAIN_TAKEN: { code: 'SUBDOMAIN_TAKEN', message: 'This subdomain is already taken', status: 400 },
  DOMAIN_INVALID: { code: 'DOMAIN_INVALID', message: 'Invalid domain format', status: 400 },

  // OTVP errors (400)
  OTVP_EXPIRED: { code: 'OTVP_EXPIRED', message: 'Your voting password has expired. Please request a new one.', status: 400 },
  OTVP_ALREADY_USED: { code: 'OTVP_ALREADY_USED', message: 'This voting password has already been used', status: 400 },
  OTVP_INVALID: { code: 'OTVP_INVALID', message: 'Invalid voting password', status: 400 },
  OTVP_MAX_ATTEMPTS: { code: 'OTVP_MAX_ATTEMPTS', message: 'Maximum OTP attempts reached. Please request a new one.', status: 400 },
  OTVP_RESEND_LIMIT: { code: 'OTVP_RESEND_LIMIT', message: 'Resend limit reached. Please wait before retrying.', status: 400 },
  OTVP_COOLDOWN: { code: 'OTVP_COOLDOWN', message: 'Please wait before requesting another OTP', status: 400 },

  // Voting errors (400/409)
  VOTE_ALREADY_CAST: { code: 'VOTE_ALREADY_CAST', message: 'You have already cast your vote in this election', status: 409 },
  VOTE_ELECTION_NOT_LIVE: { code: 'VOTE_ELECTION_NOT_LIVE', message: 'Voting is not currently open for this election', status: 400 },
  VOTE_NOT_ELIGIBLE: { code: 'VOTE_NOT_ELIGIBLE', message: 'You are not eligible to vote in this election', status: 403 },
  VOTE_POSITION_INVALID: { code: 'VOTE_POSITION_INVALID', message: 'Invalid position or candidate selection', status: 400 },
  VOTE_REPLAY_DETECTED: { code: 'VOTE_REPLAY_DETECTED', message: 'Duplicate vote attempt detected', status: 409 },

  // State machine errors (400)
  INVALID_STATE_TRANSITION: { code: 'INVALID_STATE_TRANSITION', message: 'This election state transition is not allowed', status: 400 },

  // Rate limiting (429)
  RATE_LIMITED: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', status: 429 },

  // Payment errors (400/402)
  PAYMENT_REQUIRED: { code: 'PAYMENT_REQUIRED', message: 'Payment required to activate this election', status: 402 },
  PAYMENT_FAILED: { code: 'PAYMENT_FAILED', message: 'Payment processing failed', status: 400 },
  PAYMENT_ALREADY_PROCESSED: { code: 'PAYMENT_ALREADY_PROCESSED', message: 'This payment has already been processed', status: 409 },

  // Server errors (500)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', message: 'An internal error occurred. Please try again.', status: 500 },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again.', status: 503 },

  // Deprecated endpoints (410)
  GONE: { code: 'GONE', message: 'This endpoint is no longer available', status: 410 },
} as const

export type ErrorCode = keyof typeof ERROR_CODES

// ---------------------------------------------------------------------------
// Error response helper — returns a consistent JSON error
// ---------------------------------------------------------------------------

export function errorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: any,
): NextResponse {
  const error = ERROR_CODES[code]
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: customMessage || error.message,
        ...(details ? { details } : {}),
      },
    },
    { status: error.status },
  )
}

/**
 * Wrap an async API handler with standardized error handling.
 * Catches any thrown error and returns a consistent error response.
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (e: any) {
      // If it's already a NextResponse, pass it through
      if (e instanceof NextResponse) return e

      // Log the real error internally (never expose to client)
      console.error('[api-error]', e)

      // Return a generic error to the client
      return errorResponse('INTERNAL_ERROR')
    }
  }
}
