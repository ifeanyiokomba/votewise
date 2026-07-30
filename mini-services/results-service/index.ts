// AfriVote SUG v2 — Real-time results & turnout broadcast service.
// Reads the same SQLite DB, decrypts encrypted votes server-side, and pushes
// aggregated results + turnout to every connected client every 3 seconds.
// Path MUST be "/" so Caddy routes via ?XTransformPort=3030.

import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { createHash, createHmac, createDecipheriv } from 'crypto'

const db = new PrismaClient({ log: ['error', 'warn'] })

const VOTE_ENC_KEY_RAW = process.env.VOTE_ENC_KEY || 'afrivote-sug-vote-encryption-key-v2-32bytes!'
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

  const votes = await db.encryptedVote.findMany({
    where: sessionId ? { electionSessionId: sessionId } : {},
    select: { positionId: true, ciphertext: true, iv: true, candidateId: true, isNota: true },
  })

  const positionResults = positions.map((p) => {
    const posVotes = votes.filter((v) => v.positionId === p.id)
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

async function broadcast() {
  try { io.emit('results', await computeResults()) } catch (e) { console.error('[results-service] broadcast error', e) }
}
setInterval(broadcast, 3000)

io.on('connection', (socket) => {
  console.log(`[results-service] client connected: ${socket.id}`)
  computeResults().then((p) => socket.emit('results', p)).catch(() => {})
  socket.on('request-results', () => { computeResults().then((p) => socket.emit('results', p)).catch(() => {}) })
  socket.on('disconnect', () => { console.log(`[results-service] client disconnected: ${socket.id}`) })
})

const PORT = 3030
httpServer.listen(PORT, () => console.log(`[results-service] WebSocket server running on port ${PORT}`))
process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
