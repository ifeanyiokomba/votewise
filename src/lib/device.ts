// VoteWise SUG v2 — Device fingerprinting.
// Combines User-Agent + screen + timezone + a salt into an opaque hash.
// Used for session binding, anomaly detection, and single-device enforcement.

import { sha256 } from '@/lib/crypto'

export interface DeviceInfo {
  fingerprint: string
  label: string
  userAgent: string
  ipAddress: string
}

const SALT = process.env.DEVICE_SALT || 'votewise-device-salt-v2'

// Server-side: build from request headers. The browser can additionally send
// `x-device-fp` (a client-computed hash including screen/timezone) for stronger
// binding; if absent we fall back to UA + IP.
export function deviceFromRequest(req: Request): DeviceInfo {
  const ua = req.headers.get('user-agent') || 'unknown'
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const clientFp = req.headers.get('x-device-fp')
  const fp = clientFp || sha256(`${ua}|${ip}|${SALT}`)
  return {
    fingerprint: fp,
    label: labelFromUA(ua),
    userAgent: ua,
    ipAddress: ip,
  }
}

export function labelFromUA(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'OS'
  return `${browser} on ${os}`
}
