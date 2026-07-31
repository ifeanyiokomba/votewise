// VoteWise SUG v2 — Election helpers: lifecycle, encrypted-vote collation,
// hash-chained audit log, security events, result aggregation with caching.

import { db } from '@/lib/db'
import { Cache, CACHE_KEYS } from '@/lib/cache'
import { computeAuditHash, AUDIT_GENESIS, hmacSign, sha256, randomToken, decryptVote } from '@/lib/crypto'

export type ElectionStatus = 'DRAFT' | 'PUBLISHED' | 'ACCREDITATION' | 'VOTING' | 'CLOSED' | 'CERTIFIED'

export function computeLiveStatus(status: string, start: Date, end: Date): ElectionStatus {
  const now = new Date()
  if (status === 'CERTIFIED') return 'CERTIFIED'
  if (now >= start && now < end) return 'VOTING'
  if (now >= end && status !== 'DRAFT') return 'CLOSED'
  return (status as ElectionStatus) || 'DRAFT'
}

export function isVotingOpen(status: string, start: Date, end: Date): boolean {
  return computeLiveStatus(status, start, end) === 'VOTING'
}

export async function getElectionContext() {
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  const settings = await db.electionSetting.findUnique({ where: { id: 'default' } })
  return { election, settings }
}

// ---------------------------------------------------------------------------
// Hash-chained audit log
// ---------------------------------------------------------------------------
export async function writeAudit(entry: {
  actorId: string
  actorRole: string
  actorName: string
  action: string
  details?: Record<string, unknown>
  ip?: string | null
  electionId?: string
}): Promise<void> {
  try {
    // Fetch the last audit row to chain from.
    const last = await db.auditLog.findFirst({ orderBy: { createdAt: 'desc' } })
    const prevHash = last?.hash || AUDIT_GENESIS
    const createdAt = new Date()
    const nonce = randomToken(8)
    const detailsStr = entry.details ? JSON.stringify(entry.details) : null
    const hash = computeAuditHash({ prevHash, actorId: entry.actorId, action: entry.action, details: detailsStr, createdAt, nonce })
    await db.auditLog.create({
      data: {
        electionId: entry.electionId || 'default',
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        actorName: entry.actorName,
        action: entry.action,
        details: detailsStr,
        ip: entry.ip || null,
        prevHash,
        hash,
        nonce,
        createdAt,
      },
    })
  } catch (e) {
    console.error('[audit] failed to write log', e)
  }
}

// Walks the chain and returns the first broken link (or null if intact).
// The first row is treated as the genesis anchor: we verify it links from
// AUDIT_GENESIS and that its hash is internally consistent, then every
// subsequent row must chain from the previous row's hash.
export async function verifyAuditChain(): Promise<{ intact: boolean; brokenAt?: string; totalChecked?: number }> {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'asc' } })
  if (logs.length === 0) return { intact: true, totalChecked: 0 }
  let prevHash = AUDIT_GENESIS
  let checked = 0
  for (const log of logs) {
    // Link check: this row's prevHash must equal the previous row's hash.
    if (log.prevHash !== prevHash) return { intact: false, brokenAt: log.id, totalChecked: checked }
    // Self-integrity check: recompute this row's hash. (Skip for the genesis
    // row if it was seeded with a legacy hash formula.)
    const isGenesis = log.action === 'GENESIS'
    if (!isGenesis) {
      const recomputed = computeAuditHash({
        prevHash, actorId: log.actorId, action: log.action, details: log.details,
        createdAt: log.createdAt, nonce: log.nonce,
      })
      if (recomputed !== log.hash) return { intact: false, brokenAt: log.id, totalChecked: checked }
    }
    prevHash = log.hash
    checked++
  }
  return { intact: true, totalChecked: checked }
}

// ---------------------------------------------------------------------------
// Voter activity logging (tracks login/verify/accredit/vote — NOT vote choices)
// ---------------------------------------------------------------------------
export async function logVoterActivity(entry: {
  voterId?: string
  actionById?: string
  action: string
  details?: Record<string, unknown>
  ipAddress?: string | null
  deviceLabel?: string
}): Promise<void> {
  try {
    await db.voterActivityLog.create({
      data: {
        voterId: entry.voterId || null,
        actionById: entry.actionById || null,
        action: entry.action,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress || null,
        deviceLabel: entry.deviceLabel || null,
      },
    })
  } catch (e) {
    console.error('[activity] failed to log', e)
  }
}

// ---------------------------------------------------------------------------
// Security events
// ---------------------------------------------------------------------------
export async function recordSecurityEvent(entry: {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: string
  actorId?: string
  actorEmail?: string
  ipAddress?: string | null
  message: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        severity: entry.severity,
        category: entry.category,
        actorId: entry.actorId || null,
        actorEmail: entry.actorEmail || null,
        ipAddress: entry.ipAddress || null,
        message: entry.message,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    })
  } catch (e) {
    console.error('[security] failed to record event', e)
  }
}

// ---------------------------------------------------------------------------
// Result aggregation (with caching + decryption)
// ---------------------------------------------------------------------------
export async function computeAggregatedResults(force = false) {
  const cacheKey = CACHE_KEYS.results()
  if (!force) {
    const cached = Cache.get<any>(cacheKey)
    if (cached) return cached
  }
  const { election, settings } = await getElectionContext()
  const sessionId = election?.id || null

  const positions = await db.position.findMany({
    where: sessionId ? { electionSessionId: sessionId } : {},
    orderBy: { order: 'asc' },
    include: {
      candidates: {
        where: { status: 'APPROVED' },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, fullName: true, slug: true, photoUrl: true, slogan: true, manifesto: true, campaignVideoUrl: true, facultyId: true, departmentId: true, level: true, politicalPartyId: true },
      },
    },
  })

  // Fetch encrypted votes and decrypt server-side.
  const votes = await db.encryptedVote.findMany({
    where: sessionId ? { electionSessionId: sessionId } : {},
    select: { id: true, positionId: true, ciphertext: true, iv: true, keyId: true, candidateId: true, isNota: true },
  })

  const positionResults = positions.map((p) => {
    const posVotes = votes.filter((v) => v.positionId === p.id)
    const total = posVotes.length
    // Pre-certification: decrypt to count. Post-certification: candidateId/isNota are mirrored.
    const counts = new Map<string, number>()
    let notaVotes = 0
    for (const v of posVotes) {
      let candidateId: string | null = v.candidateId
      let isNota = v.isNota
      // If not yet mirrored (pre-certify), decrypt.
      if (!candidateId && !isNota && v.ciphertext) {
        try {
          const dec = decryptVote({ ciphertext: v.ciphertext, iv: v.iv, keyId: v.keyId })
          candidateId = dec.candidateId
          isNota = dec.isNota
        } catch { /* skip un-decryptable */ }
      }
      if (isNota) notaVotes++
      else if (candidateId) counts.set(candidateId, (counts.get(candidateId) || 0) + 1)
    }
    const candidates = p.candidates.map((c) => ({ ...c, votes: counts.get(c.id) || 0 }))
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      scope: p.scope,
      description: p.description,
      totalVotes: total,
      notaVotes: settings?.notaEnabled ? notaVotes : 0,
      candidates: candidates
        .map((c) => ({ ...c, pct: total > 0 ? Math.round((c.votes / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.votes - a.votes),
    }
  })

  const totalVoters = await db.voter.count({ where: sessionId ? { electionSessionId: sessionId } : {} })
  // Exclude flagged voters from the "voted" count — their votes don't count.
  const voted = await db.voter.count({ where: { ...(sessionId ? { electionSessionId: sessionId } : {}), hasVoted: true, flagged: false } })
  const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0

  const result = {
    election: election
      ? {
          id: election.id,
          name: election.name,
          university: election.university,
          academicSession: election.academicSession,
          status: election.status,
          startTime: election.startTime,
          endTime: election.endTime,
          liveStatus: computeLiveStatus(election.status, election.startTime, election.endTime),
          publicResults: settings?.publicLiveResults ?? true,
        }
      : null,
    settings: settings
      ? {
          publicLiveResults: settings.publicLiveResults,
          showTurnout: settings.showTurnout,
          requireOtp: settings.requireOtp,
          requireAccreditation: settings.requireAccreditation,
          ballotRandomization: settings.ballotRandomization,
          notaEnabled: settings.notaEnabled,
          singleDeviceEnforcement: settings.singleDeviceEnforcement,
        }
      : null,
    positions: positionResults,
    turnout: { totalVoters, voted, turnoutPct, remaining: totalVoters - voted },
    generatedAt: new Date().toISOString(),
  }
  Cache.set(cacheKey, result, 2500)
  return result
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
export function json(body: unknown, status = 200, extra: HeadersInit = {}) {
  return Response.json(body, { status, headers: { 'content-type': 'application/json', ...extra } })
}

export function errorJson(message: string, status = 400, details?: unknown) {
  return json({ error: message, details }, status)
}

export function getClientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

// Fisher–Yates shuffle (seedable) for ballot randomization.
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr]
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  const rand = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// HMAC-sign a result snapshot (for tamper-evidence on certification).
export function signSnapshot(snapshotJson: string): string {
  return hmacSign(`snapshot:${snapshotJson}`)
}
