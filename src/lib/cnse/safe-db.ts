// VoteWise — CNSE Safe DB wrapper.
//
// In development, Next.js's Turbopack caches the @prisma/client module in
// memory. After `prisma generate` regenerates the client (e.g. when the CNSE
// models MessageQueue / MessageTemplate / Announcement were added), the cached
// PrismaClient class may NOT include the new model delegates, even though the
// underlying SQLite tables exist. The dev server keeps returning
// `db.messageQueue is undefined` until it is manually restarted.
//
// This wrapper transparently fills the gap: it exposes a Proxy over `db` that
// returns raw-SQL shims for any missing model delegates. Use exactly like db:
//   import { db } from '@/lib/cnse/safe-db'
//   await db.messageQueue.count({ where })
//
// In production (or once the dev server is restarted), the real PrismaClient
// delegates are used and the shims are never touched.

import { db as dbOrig } from '@/lib/db'

// ---------------------------------------------------------------------------
// Value normalisation (Date → ISO string, boolean → 0/1, object → JSON)
// ---------------------------------------------------------------------------
function norm(v: any): any {
  if (v === null || v === undefined) return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

/** Run a parameterised SELECT and return rows as plain objects. */
async function select<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const rows = await (dbOrig as any).$queryRawUnsafe(sql, ...params.map(norm))
  return (rows || []) as T[]
}

/** Run a parameterised statement and return nothing. */
async function exec(sql: string, params: any[] = []): Promise<void> {
  await (dbOrig as any).$executeRawUnsafe(sql, ...params.map(norm))
}

/** Convert a Prisma-style where clause (subset) to SQL + params. */
function buildWhere(
  where: any,
  columnMap: Record<string, string> = {},
): { sql: string; params: any[] } {
  const clauses: string[] = []
  const params: any[] = []
  const col = (k: string) => columnMap[k] || k

  for (const [key, value] of Object.entries(where || {})) {
    if (value === undefined) continue
    if (key === 'OR' && Array.isArray(value)) {
      const orParts: string[] = []
      for (const cond of value) {
        const inner = buildWhere(cond, columnMap)
        if (inner.sql) {
          orParts.push(`(${inner.sql})`)
          params.push(...inner.params)
        }
      }
      if (orParts.length) clauses.push(`(${orParts.join(' OR ')})`)
      continue
    }
    if (key === 'AND' && Array.isArray(value)) {
      const andParts: string[] = []
      for (const cond of value) {
        const inner = buildWhere(cond, columnMap)
        if (inner.sql) {
          andParts.push(`(${inner.sql})`)
          params.push(...inner.params)
        }
      }
      if (andParts.length) clauses.push(`(${andParts.join(' AND ')})`)
      continue
    }
    if (value === null) {
      clauses.push(`"${col(key)}" IS NULL`)
      continue
    }
    if (typeof value === 'object' && value instanceof Date === false) {
      // Prisma operator objects: { gte, lte, gt, lt, not, in }
      for (const [op, opVal] of Object.entries(value as any)) {
        const c = col(key)
        if (op === 'gte') { clauses.push(`"${c}" >= ?`); params.push(opVal) }
        else if (op === 'lte') { clauses.push(`"${c}" <= ?`); params.push(opVal) }
        else if (op === 'gt') { clauses.push(`"${c}" > ?`); params.push(opVal) }
        else if (op === 'lt') { clauses.push(`"${c}" < ?`); params.push(opVal) }
        else if (op === 'not') { clauses.push(`"${c}" != ?`); params.push(opVal) }
        else if (op === 'in' && Array.isArray(opVal) && opVal.length) {
          const placeholders = opVal.map(() => '?').join(',')
          clauses.push(`"${c}" IN (${placeholders})`)
          params.push(...opVal)
        }
      }
      continue
    }
    clauses.push(`"${col(key)}" = ?`)
    params.push(value)
  }
  return { sql: clauses.join(' AND '), params }
}

function buildOrderBy(orderBy: any): string {
  if (!orderBy) return ''
  if (typeof orderBy === 'string') return `"${orderBy}" DESC`
  if (Array.isArray(orderBy)) {
    return orderBy
      .map((o: any) => {
        const keys = Object.keys(o)
        return keys.map((k) => `"${k}" ${o[k] === 'asc' ? 'ASC' : 'DESC'}`).join(', ')
      })
      .join(', ')
  }
  if (typeof orderBy === 'object') {
    return Object.entries(orderBy)
      .map(([k, v]) => `"${k}" ${v === 'asc' ? 'ASC' : 'DESC'}`)
      .join(', ')
  }
  return ''
}

// ---------------------------------------------------------------------------
// CUID generator (matches Prisma's default ID shape)
// ---------------------------------------------------------------------------
function generateCuid(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  const rand2 = Math.random().toString(36).slice(2, 10)
  return `c${ts}${rand}${rand2}`.slice(0, 24)
}

// ---------------------------------------------------------------------------
// MessageQueue shim
// ---------------------------------------------------------------------------
class MessageQueueShim {
  async count(opts: { where?: any } = {}): Promise<number> {
    const { sql, params } = buildWhere(opts.where || {})
    const whereClause = sql ? `WHERE ${sql}` : ''
    const rows = await select<{ c: number | bigint }>(
      `SELECT COUNT(*) as c FROM "MessageQueue" ${whereClause}`,
      params,
    )
    const c = rows[0]?.c
    return typeof c === 'bigint' ? Number(c) : (c as number) || 0
  }

  async findMany<T = any>(opts: {
    where?: any
    orderBy?: any
    take?: number
    select?: any
  } = {}): Promise<T[]> {
    const { sql, params } = buildWhere(opts.where || {})
    const whereClause = sql ? `WHERE ${sql}` : ''
    const orderClause = buildOrderBy(opts.orderBy) || '"createdAt" DESC'
    const limitClause = opts.take ? `LIMIT ${Number(opts.take)}` : ''
    const rows = await select<T>(
      `SELECT * FROM "MessageQueue" ${whereClause} ORDER BY ${orderClause} ${limitClause}`,
      params,
    )
    if (opts.select && rows.length) {
      const keys = Object.keys(opts.select)
      return rows.map((r: any) => {
        const out: any = {}
        for (const k of keys) out[k] = r[k]
        return out as T
      }) as T[]
    }
    return rows
  }

  async findUnique<T = any>(opts: { where: { id: string } }): Promise<T | null> {
    const rows = await select<T>(
      `SELECT * FROM "MessageQueue" WHERE "id" = ? LIMIT 1`,
      [opts.where.id],
    )
    return (rows[0] as T) || null
  }

  async create(opts: { data: any }): Promise<any> {
    const data = opts.data
    const id = data.id || generateCuid()
    const cols: string[] = []
    const ph: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue
      cols.push(`"${k}"`)
      ph.push('?')
      vals.push(v)
    }
    cols.push('"id"'); ph.push('?'); vals.push(id)
    // Prisma's @default(now()) and @updatedAt directives are enforced at the
    // ORM layer, NOT at the SQLite column level — raw INSERTs must set them
    // explicitly or the NOT NULL constraint fires.
    if (!cols.includes('"createdAt"')) { cols.push('"createdAt"'); ph.push('CURRENT_TIMESTAMP') }
    if (!cols.includes('"updatedAt"')) { cols.push('"updatedAt"'); ph.push('CURRENT_TIMESTAMP') }
    if (!cols.includes('"scheduledAt"')) { cols.push('"scheduledAt"'); ph.push('CURRENT_TIMESTAMP') }
    await exec(
      `INSERT INTO "MessageQueue" (${cols.join(', ')}) VALUES (${ph.join(', ')})`,
      vals,
    )
    return { id, ...data }
  }

  async update(opts: { where: { id: string }; data: any }): Promise<any> {
    const sets: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(opts.data)) {
      if (v === undefined) continue
      sets.push(`"${k}" = ?`)
      vals.push(v)
    }
    sets.push('"updatedAt" = CURRENT_TIMESTAMP')
    vals.push(opts.where.id)
    await exec(`UPDATE "MessageQueue" SET ${sets.join(', ')} WHERE "id" = ?`, vals)
    return await this.findUnique({ where: { id: opts.where.id } })
  }

  async updateMany(opts: { where: any; data: any }): Promise<{ count: number }> {
    const { sql, params } = buildWhere(opts.where || {})
    const whereClause = sql ? `WHERE ${sql}` : ''
    const sets: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(opts.data)) {
      if (v === undefined) continue
      sets.push(`"${k}" = ?`)
      vals.push(v)
    }
    sets.push('"updatedAt" = CURRENT_TIMESTAMP')
    const rows = await select<{ c: number | bigint }>(
      `SELECT COUNT(*) as c FROM "MessageQueue" ${whereClause}`,
      params,
    )
    const count = typeof rows[0]?.c === 'bigint' ? Number(rows[0].c) : (rows[0]?.c as number) || 0
    await exec(
      `UPDATE "MessageQueue" SET ${sets.join(', ')} ${whereClause}`,
      [...vals, ...params],
    )
    return { count }
  }
}

// ---------------------------------------------------------------------------
// MessageTemplate shim
// ---------------------------------------------------------------------------
class MessageTemplateShim {
  async findMany<T = any>(opts: { where?: any; orderBy?: any } = {}): Promise<T[]> {
    const { sql, params } = buildWhere(opts.where || {})
    const whereClause = sql ? `WHERE ${sql}` : ''
    const orderClause = buildOrderBy(opts.orderBy) || '"category" ASC'
    return select<T>(
      `SELECT * FROM "MessageTemplate" ${whereClause} ORDER BY ${orderClause}`,
      params,
    )
  }

  async findFirst<T = any>(opts: { where: any }): Promise<T | null> {
    const { sql, params } = buildWhere(opts.where || {})
    const whereClause = sql ? `WHERE ${sql}` : ''
    const rows = await select<T>(
      `SELECT * FROM "MessageTemplate" ${whereClause} LIMIT 1`,
      params,
    )
    return (rows[0] as T) || null
  }

  async findUnique<T = any>(opts: { where: { id: string } }): Promise<T | null> {
    const rows = await select<T>(
      `SELECT * FROM "MessageTemplate" WHERE "id" = ? LIMIT 1`,
      [opts.where.id],
    )
    return (rows[0] as T) || null
  }

  async create(opts: { data: any }): Promise<any> {
    const data = opts.data
    const id = data.id || generateCuid()
    const cols: string[] = []
    const ph: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue
      cols.push(`"${k}"`)
      ph.push('?')
      vals.push(v)
    }
    cols.push('"id"'); ph.push('?'); vals.push(id)
    if (!cols.includes('"createdAt"')) { cols.push('"createdAt"'); ph.push('CURRENT_TIMESTAMP') }
    if (!cols.includes('"updatedAt"')) { cols.push('"updatedAt"'); ph.push('CURRENT_TIMESTAMP') }
    await exec(
      `INSERT INTO "MessageTemplate" (${cols.join(', ')}) VALUES (${ph.join(', ')})`,
      vals,
    )
    return { id, ...data }
  }

  async update(opts: { where: { id: string }; data: any }): Promise<any> {
    const sets: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(opts.data)) {
      if (v === undefined) continue
      sets.push(`"${k}" = ?`)
      vals.push(v)
    }
    sets.push('"updatedAt" = CURRENT_TIMESTAMP')
    vals.push(opts.where.id)
    await exec(`UPDATE "MessageTemplate" SET ${sets.join(', ')} WHERE "id" = ?`, vals)
    return await this.findUnique({ where: { id: opts.where.id } })
  }
}

// ---------------------------------------------------------------------------
// Announcement shim
// ---------------------------------------------------------------------------
class AnnouncementShim {
  async findMany<T = any>(opts: { where?: any; orderBy?: any; take?: number } = {}): Promise<T[]> {
    const { sql, params } = buildWhere(opts.where || {})
    const whereClause = sql ? `WHERE ${sql}` : ''
    const orderClause = buildOrderBy(opts.orderBy) || '"publishedAt" DESC'
    const limitClause = opts.take ? `LIMIT ${Number(opts.take)}` : ''
    return select<T>(
      `SELECT * FROM "Announcement" ${whereClause} ORDER BY ${orderClause} ${limitClause}`,
      params,
    )
  }

  async create(opts: { data: any }): Promise<any> {
    const data = opts.data
    const id = data.id || generateCuid()
    const cols: string[] = []
    const ph: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue
      cols.push(`"${k}"`)
      ph.push('?')
      vals.push(v)
    }
    cols.push('"id"'); ph.push('?'); vals.push(id)
    if (!cols.includes('"createdAt"')) { cols.push('"createdAt"'); ph.push('CURRENT_TIMESTAMP') }
    if (!cols.includes('"updatedAt"')) { cols.push('"updatedAt"'); ph.push('CURRENT_TIMESTAMP') }
    if (!cols.includes('"publishedAt"')) { cols.push('"publishedAt"'); ph.push('CURRENT_TIMESTAMP') }
    await exec(
      `INSERT INTO "Announcement" (${cols.join(', ')}) VALUES (${ph.join(', ')})`,
      vals,
    )
    return { id, ...data }
  }

  async update(opts: { where: { id: string }; data: any }): Promise<any> {
    const sets: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(opts.data)) {
      if (v === undefined) continue
      sets.push(`"${k}" = ?`)
      vals.push(v)
    }
    sets.push('"updatedAt" = CURRENT_TIMESTAMP')
    vals.push(opts.where.id)
    await exec(`UPDATE "Announcement" SET ${sets.join(', ')} WHERE "id" = ?`, vals)
    return { id: opts.where.id, ...opts.data }
  }

  async findUnique<T = any>(opts: { where: { id: string } }): Promise<T | null> {
    const rows = await select<T>(
      `SELECT * FROM "Announcement" WHERE "id" = ? LIMIT 1`,
      [opts.where.id],
    )
    return (rows[0] as T) || null
  }
}

// ---------------------------------------------------------------------------
// Public safe-db proxy
// ---------------------------------------------------------------------------
const messageQueueShim = new MessageQueueShim()
const messageTemplateShim = new MessageTemplateShim()
const announcementShim = new AnnouncementShim()

/**
 * Drop-in replacement for `db` that transparently fills in any missing model
 * delegates with raw-SQL shims. Swap `@/lib/db` → `@/lib/cnse/safe-db` in the
 * import statement; the rest of the call sites stay identical.
 */
export const db = new Proxy(dbOrig as any, {
  get(target, prop: string, receiver) {
    if (prop in target) {
      return Reflect.get(target, prop, receiver)
    }
    if (prop === 'messageQueue') return messageQueueShim
    if (prop === 'messageTemplate') return messageTemplateShim
    if (prop === 'announcement') return announcementShim
    return undefined
  },
}) as typeof dbOrig
