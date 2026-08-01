// VoteWise — Password Policy (Chapter 4 IAM)
//
// Enforces strong passwords:
//   - Minimum 12 characters
//   - At least 1 uppercase letter
//   - At least 1 lowercase letter
//   - At least 1 number
//   - At least 1 special character
//
// Platform staff (SUPER_ADMIN) require mandatory 2FA + this password policy.

export interface PasswordValidation {
  valid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters.')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number.')
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must contain at least one special character.')
  }

  // Strength scoring
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score++
  if (password.length >= 20) score++

  const strength = score <= 2 ? 'weak' : score === 3 ? 'medium' : score === 4 ? 'strong' : 'very-strong'

  return {
    valid: errors.length === 0,
    errors,
    strength: strength as PasswordValidation['strength'],
  }
}

// Account status constants (Chapter 4 spec)
export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED',
  LOCKED: 'LOCKED',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
} as const

// Failed login protection (Chapter 4 spec)
export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_DURATION_MINUTES = 15

// Check if an account should be locked after failed attempts
export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS
}

// Calculate lock expiry
export function lockExpiry(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
}

// Check if a locked account can be auto-unlocked
export function canUnlock(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false
  return new Date() >= lockedUntil
}
