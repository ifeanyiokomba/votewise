// AfriVote SUG — Real-time results & turnout broadcast service.
// Reads the same SQLite DB the Next.js app writes to, and pushes aggregated
// results + turnout to every connected client every 3 seconds (and on demand).
//
// IMPORTANT: path MUST be "/" so Caddy can route it via ?XTransformPort=3030.

import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ log: ['error', 'warn'] })

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Simple in-memory cache to avoid hammering SQLite on every connection.
let cachedPayload: any = null
let cachedAt = 0
const CACHE_TTL_MS = 2500

async function computeResults() {
  const now = Date.now()
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) return cachedPayload

  const election = await db.election.findUnique({ where: { id: 'default' } })
  const settings = await db.electionSetting.findUnique({ where: { id: 'default' } })
  const positions = await db.position.findMany({
    orderBy: { order: 'asc' },
    include: {
      candidates: {
        where: { status: 'APPROVED' },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, fullName: true, slug: true, photoUrl: true, slogan: true, facultyId: true, departmentId: true, level: true },
      },
    },
  })

  // Aggregate votes by position -> candidate (and NOTA).
  const votes = await db.vote.findMany({ select: { positionId: true, candidateId: true, isNota: true } })

  const positionResults = positions.map((p) => {
    const posVotes = votes.filter((v) => v.positionId === p.id)
    const total = posVotes.length
    const candidates = p.candidates.map((c) => ({
      ...c,
      votes: posVotes.filter((v) => v.candidateId === c.id).length,
    }))
    const notaVotes = posVotes.filter((v) => v.isNota).length
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      scope: p.scope,
      totalVotes: total,
      notaVotes: settings?.notaEnabled ? notaVotes : 0,
      candidates: candidates
        .map((c) => ({ ...c, pct: total > 0 ? Math.round((c.votes / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.votes - a.votes),
    }
  })

  // Turnout
  const totalVoters = await db.voter.count()
  const voted = await db.voter.count({ where: { hasVoted: true } })
  const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0

  // Recent activity (last 20 vote timestamps) for the live feed.
  const recent = await db.vote.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, positionId: true },
  })

  cachedPayload = {
    election: election
      ? {
          name: election.name,
          university: election.university,
          status: election.status,
          startTime: election.startTime,
          endTime: election.endTime,
          publicResults: settings?.publicLiveResults ?? true,
        }
      : null,
    positions: positionResults,
    turnout: { totalVoters, voted, turnoutPct, remaining: totalVoters - voted },
    recentActivity: recent.map((r) => ({ positionId: r.positionId, at: r.createdAt })),
    generatedAt: new Date().toISOString(),
  }
  cachedAt = now
  return cachedPayload
}

async function broadcast() {
  try {
    const payload = await computeResults()
    io.emit('results', payload)
  } catch (e) {
    console.error('[results-service] broadcast error', e)
  }
}

// Periodic broadcast every 3s while election is "open"; otherwise every 10s.
setInterval(broadcast, 3000)

io.on('connection', (socket) => {
  console.log(`[results-service] client connected: ${socket.id}`)
  // Send a snapshot immediately on connect.
  computeResults()
    .then((payload) => socket.emit('results', payload))
    .catch((e) => console.error('initial send error', e))

  socket.on('request-results', () => {
    computeResults().then((p) => socket.emit('results', p)).catch(() => {})
  })

  socket.on('disconnect', () => {
    console.log(`[results-service] client disconnected: ${socket.id}`)
  })
})

const PORT = 3030
httpServer.listen(PORT, () => {
  console.log(`[results-service] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
