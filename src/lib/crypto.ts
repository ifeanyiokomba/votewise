// AfriVote SUG v2 — Cryptographic primitives.
// - scrypt password hashing (memory-hard, offline-crack resistant)
// - AES-256-GCM symmetric encryption (vote encryption at rest)
// - HMAC signing (result snapshots, tokens)
// - TOTP (RFC 6238) for admin 2FA
// - Hash-chained audit log
// - Random tokens / OTP / receipt codes / voter hash

import {
  randomBytes, scryptSync, timingSafeEqual, createHash, createHmac,
  randomInt, createCipheriv, createDecipheriv,
} from 'crypto'

// ---------------------------------------------------------------------------
// Passwords (scrypt)
// ---------------------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64, { N: 2 ** 14, r: 8, p: 1 }).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  // Support both legacy "salt:hash" and new "scrypt:salt:hash" formats.
  let salt: string, hash: string, opts: { N?: number; r?: number; p?: number } = { N: 2 ** 14, r: 8, p: 1 }
  if (stored.startsWith('scrypt:')) {
    const [, s, h] = stored.split(':'); salt = s; hash = h
  } else {
    const [s, h] = stored.split(':'); salt = s; hash = h; opts = {} // legacy default
  }
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(password, salt, 64, opts)
  if (hashBuf.length !== testBuf.length) return false
  return timingSafeEqual(hashBuf, testBuf)
}

// ---------------------------------------------------------------------------
// Random tokens / OTP / receipts
// ---------------------------------------------------------------------------
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function generateOtp(length = 6): string {
  const min = 10 ** (length - 1)
  const max = 10 ** length - 1
  return String(randomInt(min, max + 1))
}

export function generateReceiptCode(): string {
  const seg = (n: number) =>
    randomBytes(n)
      .toString('base64')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, n)
      .toUpperCase()
  return `AV-${seg(4)}-${seg(4)}-${seg(4)}`
}

export function generateBackupCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = []
  const hashed: string[] = []
  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString('hex').toUpperCase() // 10 hex chars
    plain.push(`${code.slice(0, 5)}-${code.slice(5)}`)
    hashed.push(sha256(code))
  }
  return { plain, hashed }
}

// One-way voter hash (so votes can't be traced back to a voter row).
const VOTER_HASH_PEPPER = process.env.VOTER_HASH_PEPPER || 'afrivote-sug-pepper-v2'
export function hashVoter(matric: string): string {
  return createHash('sha256').update(`${matric}:${VOTER_HASH_PEPPER}`).digest('hex')
}

// ---------------------------------------------------------------------------
// Hashing & HMAC
// ---------------------------------------------------------------------------
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

const HMAC_SECRET = process.env.HMAC_SECRET || 'afrivote-sug-hmac-secret-dev-only'
export function hmacSign(input: string): string {
  return createHmac('sha256', HMAC_SECRET).update(input).digest('hex')
}
export function hmacVerify(input: string, sig: string): boolean {
  const expected = hmacSign(input)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ---------------------------------------------------------------------------
// AES-256-GCM vote encryption
// ---------------------------------------------------------------------------
// In sandbox the key is derived from env. In production this would be an
// envelope key fetched from KMS and the data key itself encrypted at rest.
const VOTE_ENC_KEY_RAW = process.env.VOTE_ENC_KEY || 'afrivote-sug-vote-encryption-key-v2-32bytes!'
const VOTE_ENC_KEY = VOTE_ENC_KEY_RAW.length >= 32 ? VOTE_ENC_KEY_RAW.slice(0, 32) : sha256(VOTE_ENC_KEY_RAW).slice(0, 32)
export const VOTE_KEY_ID = process.env.VOTE_KEY_ID || 'v1'

export interface EncryptedBlob { ciphertext: string; iv: string; keyId: string }

export function encryptVote(plaintext: object): EncryptedBlob {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', VOTE_ENC_KEY, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Pack ciphertext + tag (tag is the last 16 bytes).
  return {
    ciphertext: Buffer.concat([data, tag]).toString('base64'),
    iv: iv.toString('base64'),
    keyId: VOTE_KEY_ID,
  }
}

export function decryptVote(blob: EncryptedBlob): { candidateId: string | null; isNota: boolean } {
  const buf = Buffer.from(blob.ciphertext, 'base64')
  const tag = buf.subarray(buf.length - 16)
  const data = buf.subarray(0, buf.length - 16)
  const iv = Buffer.from(blob.iv, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', VOTE_ENC_KEY, iv)
  decipher.setAuthTag(tag)
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(json)
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — admin 2FA
// ---------------------------------------------------------------------------
// We implement HOTP/TOTP manually to avoid an external dep, using the
// standard base32 + HMAC-SHA1 algorithm.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(length = 20): string {
  const bytes = randomBytes(length)
  let secret = ''
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_ALPHABET[(bytes[i] >> 3) & 31]
    // Reconstruct from bits — simpler: just take 5 bits per output char from a fresh byte stream.
  }
  // The above is approximate; do it properly: pack bits.
  return base32Encode(bytes)
}

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(str: string): Buffer {
  const cleaned = str.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0, value = 0, output: number[] = []
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

export function totpUri(secret: string, email: string, issuer = 'AfriVote SUG'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret: secret,
    issuer: issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

export function verifyTotp(token: string, secret: string, window = 1): boolean {
  const key = base32Decode(secret)
  if (key.length === 0) return false
  const t = Math.floor(Date.now() / 1000)
  for (let offset = -window; offset <= window; offset++) {
    const counter = Math.floor((t + offset * 30) / 30)
    if (generateTotp(key, counter) === token) return true
  }
  return false
}

function generateTotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)
  return String(code % 10 ** 6).padStart(6, '0')
}

// ---------------------------------------------------------------------------
// Hash-chained audit log
// ---------------------------------------------------------------------------
export const AUDIT_GENESIS = 'GENESIS-afrivote-sug-v2'

export function computeAuditHash(args: {
  prevHash: string
  actorId: string
  action: string
  details: string | null
  createdAt: Date
  nonce: string
}): string {
  return sha256(`${args.prevHash}|${args.actorId}|${args.action}|${args.details || ''}|${args.createdAt.toISOString()}|${args.nonce}`)
}
