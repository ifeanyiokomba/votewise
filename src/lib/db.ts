import { PrismaClient } from '@prisma/client'

// VoteWise — Prisma client singleton.
//
// In development, Next.js's HMR can preserve a stale PrismaClient class on
// `globalThis` after `prisma db push` regenerates the client. To work around
// this without forcing a dev-server restart, we attach a schema signature to
// the cached entry. When the signature changes (e.g. after a schema migration),
// we discard the cached client and create a fresh one.
//
// If you add or remove a Prisma model field, bump SCHEMA_SIG below to force
// every dev server to pick up the new client on the next request.
const SCHEMA_SIG = 'v7-notification-delivery-fix'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  __prismaSig?: string
}

function makeClient() {
  return new PrismaClient({ log: ['error', 'warn'] })
}

let db: PrismaClient
if (process.env.NODE_ENV === 'production') {
  db = globalForPrisma.prisma ?? makeClient()
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = db
    globalForPrisma.__prismaSig = SCHEMA_SIG
  }
} else {
  if (globalForPrisma.prisma && globalForPrisma.__prismaSig === SCHEMA_SIG) {
    db = globalForPrisma.prisma
  } else {
    try { globalForPrisma.prisma?.$disconnect?.() } catch { /* ignore */ }
    db = makeClient()
    globalForPrisma.prisma = db
    globalForPrisma.__prismaSig = SCHEMA_SIG
  }
}

export { db }
