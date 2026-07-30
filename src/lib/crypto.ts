// Password hashing using Node's built-in scrypt (no external deps).
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(password, salt, 64)
  if (hashBuf.length !== testBuf.length) return false
  return timingSafeEqual(hashBuf, testBuf)
}

// Random tokens / OTP codes.
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function generateOtp(length = 6): string {
  // cryptographically-flavoured numeric OTP
  const min = 10 ** (length - 1)
  const max = 10 ** length - 1
  return String(min + (randomBytes(4).readUInt32BE() % (max - min + 1)))
}

export function generateReceiptCode(): string {
  // AV-XXXX-XXXX-XXXX (readable, uppercase)
  const seg = (n: number) =>
    randomBytes(n)
      .toString('base64')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, n)
      .toUpperCase()
  return `AV-${seg(4)}-${seg(4)}-${seg(4)}`
}

// One-way voter hash (so votes can't be traced back to a voter row).
const VOTER_HASH_PEPPER = process.env.VOTER_HASH_PEPPER || 'afrivote-sug-pepper-v1'

export function hashVoter(matric: string): string {
  return createHash('sha256')
    .update(`${matric}:${VOTER_HASH_PEPPER}`)
    .digest('hex')
}
