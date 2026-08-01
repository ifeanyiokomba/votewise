// VoteWise — Real-time results & turnout broadcast service (Chapter 10 SVE).
//
// Reads the same SQLite DB and pushes aggregated results + turnout to every
// connected client. Path MUST be "/" so Caddy routes via ?XTransformPort=3030.
//
// Chapter 10 additions:
// - Per-election channels: clients subscribe to a specific election via
//   socket.emit('subscribe', { electionId }).
// - Reads from the new VoteRecord table (SVE) in addition to legacy
//   EncryptedVote.
// - /internal/bump endpoint: the SVE live-counter signals updates after a
//   vote is cast, triggering an immediate broadcast (no 3s wait).
// - vote-cast events: real-time vote feed for the observer live view.
// - Legacy broadcast preserved for backward compatibility.

import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { createHash, createHmac, createDecipheriv } from 'crypto'

const db = new PrismaClient({ log: ['error', 'warn'] })

const VOTE_ENC_KEY_RAW = process.env.VOTE_ENC_KEY || 'votewise-sug-vote-encryption-key-v2-32bytes!'
const VOTE_ENC_KEY = VOTE_ENC_KEY_RAW.length >= 32 ? VOTE_ENC_KEY_RAW.slice(0, 32) : createHash('sha256').update(VOTE_ENC_KEY_RAW).digest().subarray(0, 32)

function decryptVote(ciphertextB64: string, ivB64: string) {
  const buf = Buffer.from(ciphertextB64, 'base64')
  const tag = buf.subarray(buf.length - 16)
  const data = buf.subarray(0, buf.length - 16)
  const iv = Buffer.from(ivB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', VOTE_ENC_KEY, iv)
  decipher.setAuthTag(tag)
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(json)
}

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------------------------------------------------------------------
// Legacy cache (single-election broadcast every 3s)
// ---------------------------------------------------------------------------
let cachedPayload: any = null
let cachedAt = 0
const CACHE_TTL_MS = 2500

async function computeResults() {
  const now = Date.now()
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) return cachedPayload

  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  const settings = await db.electionSetting.findUnique({ where: { id: 'default' } })
  const sessionId = election?.id || null

  const positions = await db.position.findMany({
    where: sessionId ? { electionSessionId: sessionId } : {},
    orderBy: { order: 'asc' },
    include: {
      candidates: {
        where: { status: 'APPROVED' },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, fullName: true, slug: true, photoUrl: true, slogan: true, facultyId: true, departmentId: true, level: true },
      },
    },
  })

  // Read from BOTH legacy EncryptedVote and new VoteRecord (SVE).
  const legacyVotes = await db.encryptedVote.findMany({
    where: sessionId ? { electionSessionId: sessionId } : {},
    select: { positionId: true, ciphertext: true, iv: true, candidateId: true, isNota: true },
  })
  const sveVotes = await db.voteRecord.findMany({
    where: sessionId ? { electionId: sessionId, isSimulation: false } : { isSimulation: false },
    select: { positionId: true, encryptedChoice: true, iv: true, candidateId: true },
  })

  const allVotes = [
    ...legacyVotes.map((v) => ({ positionId: v.positionId, ciphertext: v.ciphertext, iv: v.iv, candidateId: v.candidateId, isNota: v.isNota })),
    ...sveVotes.map((v) => ({ positionId: v.positionId, ciphertext: v.encryptedChoice, iv: v.iv, candidateId: v.candidateId, isNota: false })),
  ]

  const positionResults = positions.map((p) => {
    const posVotes = allVotes.filter((v) => v.positionId === p.id)
    const total = posVotes.length
    const counts = new Map<string, number>()
    let notaVotes = 0
    for (const v of posVotes) {
      let candidateId = v.candidateId
      let isNota = v.isNota
      if (!candidateId && !isNota && v.ciphertext) {
        try { const d = decryptVote(v.ciphertext, v.iv); candidateId = d.candidateId; isNota = d.isNota } catch {}
      }
      if (isNota) notaVotes++
      else if (candidateId) counts.set(candidateId, (counts.get(candidateId) || 0) + 1)
    }
    const candidates = p.candidates.map((c) => ({ ...c, votes: counts.get(c.id) || 0 }))
    return {
      id: p.id, title: p.title, slug: p.slug, scope: p.scope,
      totalVotes: total,
      notaVotes: settings?.notaEnabled ? notaVotes : 0,
      candidates: candidates.map((c) => ({ ...c, pct: total > 0 ? Math.round((c.votes / total) * 1000) / 10 : 0 })).sort((a, b) => b.votes - a.votes),
    }
  })

  const totalVoters = await db.voter.count({ where: sessionId ? { electionSessionId: sessionId } : {} })
  const voted = await db.voter.count({ where: { ...(sessionId ? { electionSessionId: sessionId } : {}), hasVoted: true } })
  const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0

  cachedPayload = {
    election: election ? {
      id: election.id, name: election.name, university: election.university, status: election.status,
      startTime: election.startTime, endTime: election.endTime,
      publicResults: settings?.publicLiveResults ?? true,
    } : null,
    positions: positionResults,
    turnout: { totalVoters, voted, turnoutPct, remaining: totalVoters - voted },
    generatedAt: new Date().toISOString(),
  }
  cachedAt = now
  return cachedPayload
}

// ---------------------------------------------------------------------------
// Chapter 10: Per-election SVE live stats
// ---------------------------------------------------------------------------
const sveCache = new Map<string, { data: any; at: number }>()
const SVE_CACHE_TTL = 2000

async function computeSveLive(electionId: string) {
  const now = Date.now()
  const cached = sveCache.get(electionId)
  if (cached && now - cached.at < SVE_CACHE_TTL) return cached.data

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, status: true, startTime: true, endTime: true, organizationId: true, settings: true },
  })
  if (!election) return null

  const settings = election.settings ? JSON.parse(election.settings) : {}
  const showCandidateResults = settings.showLiveResults || election.status === 'COMPLETED' || election.status === 'CERTIFIED'

  // Eligible voters (org-wide for now; rule-evaluated in production).
  const eligibleVoters = await db.voter.count({
    where: {
      OR: [{ electionSessionId: electionId }, { organizationId: election.organizationId || undefined }],
      status: { not: 'SUSPENDED' },
    },
  })

  // SVE vote records (non-simulation).
  const sveVotes = await db.voteRecord.findMany({
    where: { electionId, isSimulation: false },
    select: { id: true, positionId: true, candidateId: true, encryptedChoice: true, iv: true, voterHash: true, createdAt: true },
  })

  const uniqueVoters = new Set(sveVotes.map((v) => v.voterHash)).size
  const turnoutPct = eligibleVoters > 0 ? Math.round((uniqueVoters / eligibleVoters) * 10000) / 100 : 0

  // Per-position counts.
  const positions = await db.position.findMany({
    where: { electionSessionId: electionId },
    select: { id: true, title: true },
    orderBy: { displayOrder: 'asc' },
  })
  const votesByPosition = positions.map((p) => ({
    positionId: p.id,
    title: p.title,
    count: sveVotes.filter((v) => v.positionId === p.id).length,
  }))

  // Per-candidate counts (only if results visible).
  let votesByCandidate: any[] = []
  if (showCandidateResults) {
    const candidates = await db.candidate.findMany({
      where: { electionSessionId: electionId, status: 'APPROVED' },
      select: { id: true, fullName: true, positionId: true, photoUrl: true },
    })
    votesByCandidate = candidates.map((c) => ({
      positionId: c.positionId,
      candidateId: c.id,
      candidateName: c.fullName,
      photo: c.photoUrl,
      count: sveVotes.filter((v) => v.candidateId === c.id).length,
    }))
  }

  const lastVote = sveVotes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

  const data = {
    electionId,
    electionName: election.name,
    status: election.status,
    eligibleVoters,
    votesCast: uniqueVoters,
    ballotRecords: sveVotes.length,
    turnoutPct,
    lastVoteAt: lastVote?.createdAt?.toISOString(),
    votesByPosition,
    votesByCandidate,
    showCandidateResults,
    votingWindow: { start: election.startTime, end: election.endTime },
    generatedAt: new Date().toISOString(),
  }
  sveCache.set(electionId, { data, at: now })
  return data
}

async function broadcast() {
  try { io.emit('results', await computeResults()) } catch (e) { console.error('[results-service] broadcast error', e) }
}
setInterval(broadcast, 3000)

// Broadcast SVE live stats to per-election rooms every 2s.
const subscribedElections = new Set<string>()
setInterval(async () => {
  for (const electionId of subscribedElections) {
    try {
      const data = await computeSveLive(electionId)
      if (data) io.to(`election:${electionId}`).emit('sve:live', data)
    } catch (e) { /* ignore */ }
  }
}, 2000)

io.on('connection', (socket) => {
  console.log(`[results-service] client connected: ${socket.id}`)

  // Legacy: send initial results.
  computeResults().then((p) => socket.emit('results', p)).catch(() => {})
  socket.on('request-results', () => { computeResults().then((p) => socket.emit('results', p)).catch(() => {}) })

  // Chapter 10: subscribe to a specific election's live feed.
  socket.on('subscribe', (payload: { electionId?: string }) => {
    if (!payload?.electionId) return
    socket.join(`election:${payload.electionId}`)
    subscribedElections.add(payload.electionId)
    computeSveLive(payload.electionId).then((data) => {
      if (data) socket.emit('sve:live', data)
    }).catch(() => {})
    console.log(`[results-service] ${socket.id} subscribed to election ${payload.electionId}`)
  })

  socket.on('unsubscribe', (payload: { electionId?: string }) => {
    if (!payload?.electionId) return
    socket.leave(`election:${payload.electionId}`)
    console.log(`[results-service] ${socket.id} unsubscribed from election ${payload.electionId}`)
  })

  socket.on('disconnect', () => { console.log(`[results-service] client disconnected: ${socket.id}`) })
})

// ---------------------------------------------------------------------------
// Internal HTTP endpoint: SVE live-counter signals a vote was cast.
// Triggers an immediate broadcast to the election's room (no 2s wait).
// ---------------------------------------------------------------------------
const internalServer = createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://localhost`)
  if (url.pathname === '/internal/bump' && req.method === 'POST') {
    const electionId = url.searchParams.get('electionId')
    if (electionId) {
      sveCache.delete(electionId) // invalidate cache
      subscribedElections.add(electionId)
      try {
        const data = await computeSveLive(electionId)
        if (data) {
          io.to(`election:${electionId}`).emit('sve:live', data)
          io.to(`election:${electionId}`).emit('sve:vote-cast', {
            electionId,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (e) { /* ignore */ }
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404)
  res.end('not found')
})

const PORT = 3030
httpServer.listen(PORT, () => console.log(`[results-service] WebSocket server running on port ${PORT}`))
internalServer.listen(3031, () => console.log(`[results-service] internal HTTP on port 3031`))

process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)); internalServer.close() })
process.on('SIGINT', () => { httpServer.close(() => process.exit(0)); internalServer.close() })
