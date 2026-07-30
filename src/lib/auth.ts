// Signed token (HMAC) sessions for admin & observer. Stateless, DB-free.
import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.SESSION_SECRET || 'afrivote-sug-session-secret-dev-only'

export interface SessionPayload {
  sub: string // user id
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OBSERVER'
  name: string
  email: string
  iat: number
  exp: number
}

export function signToken(payload: Omit<SessionPayload, 'iat' | 'exp'>, ttlSeconds = 60 * 60 * 12): string {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + ttlSeconds
  const body: SessionPayload = { ...payload, iat, exp }
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [data, sig] = parts
  const expected = createHmac('sha256', SECRET).update(data).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// Read token from request headers (Authorization: Bearer ... or x-session-token).
export function readTokenFromHeaders(headers: Headers): string | null {
  const auth = headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  const x = headers.get('x-session-token')
  if (x) return x
  return null
}

// Cookie helper — also accept session via cookie.
export function readTokenFromRequest(req: Request): string | null {
  const fromHeader = readTokenFromHeaders(req.headers)
  if (fromHeader) return fromHeader
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)afrivote-session=([^;]+)/)
  return match ? match[1] : null
}
