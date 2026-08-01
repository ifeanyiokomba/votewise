import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// Default settings shape — used when the election has no settings JSON yet.
const DEFAULT_SETTINGS = {
  requireAccreditation: true,
  requireOTVP: false,
  showLiveTurnout: true,
  showLiveResults: false,
  hideResultsUntilEnd: false,
  allowResultDownload: true,
  requireObserverApproval: false,
  enableAuditMode: true,
  notaEnabled: false,
}

// Allowed voting-settings keys (defensive: prevents arbitrary key injection).
const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]

function parseSettings(raw: string | null | undefined): Record<string, any> {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) {
      return { ...DEFAULT_SETTINGS }
    }
    // Merge so the client always sees the full shape, even on legacy elections
    // that were saved with a partial settings object.
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// GET /api/workspace/elections/[id]/settings
// Returns the election's settings (parsed from JSON) plus the editable
// election fields: name, description, visibility. The settings object is
// always the full shape (merged with defaults) so the UI doesn't have to
// handle missing keys.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const election = await db.electionSession.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      status: true,
      settings: true,
      organizationId: true,
      startTime: true,
      endTime: true,
    },
  })

  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  return json({
    election: {
      id: election.id,
      name: election.name,
      description: election.description,
      visibility: election.visibility,
      status: election.status,
      startTime: election.startTime,
      endTime: election.endTime,
    },
    settings: parseSettings(election.settings),
    locked: election.status === 'CERTIFIED' || election.status === 'ARCHIVED',
  })
}

// PATCH /api/workspace/elections/[id]/settings
// Updates election settings + the editable fields (name, description, visibility).
// - Requires `election.manage` capability.
// - Rejects if election is CERTIFIED or ARCHIVED (immutable).
// - Merges incoming settings with existing settings (doesn't replace).
// - Writes an ElectionEvent timeline entry + an AuditLog entry.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const officialRes = await requireOfficial(req, 'election.manage')
  if (officialRes instanceof Response) return officialRes
  const official = officialRes.official

  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, name: true, settings: true, status: true, organizationId: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Immutable after certification
  if (election.status === 'CERTIFIED' || election.status === 'ARCHIVED') {
    return errorJson('Election is immutable after certification. Settings are locked.', 403)
  }

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, any> = {}
  const changedFields: string[] = []

  // Editable general-information fields.
  if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== election.name) {
    updates.name = body.name.trim()
    changedFields.push('name')
  }
  if (body.description !== undefined && body.description !== election.description) {
    updates.description = body.description === null ? null : String(body.description)
    changedFields.push('description')
  }
  if (
    typeof body.visibility === 'string' &&
    ['Public', 'Private', 'Invite Only'].includes(body.visibility) &&
    body.visibility !== election.visibility
  ) {
    updates.visibility = body.visibility
    changedFields.push('visibility')
  }

  // Settings — merge with existing, only accept known keys.
  if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
    const current = parseSettings(election.settings)
    const next: Record<string, any> = { ...current }
    let settingsChanged = false
    for (const key of SETTING_KEYS) {
      const incoming = (body.settings as Record<string, any>)[key]
      if (typeof incoming === 'boolean' && incoming !== current[key]) {
        next[key] = incoming
        settingsChanged = true
      }
    }
    if (settingsChanged) {
      updates.settings = JSON.stringify(next)
      changedFields.push('settings')
    }
  }

  if (changedFields.length === 0) {
    return json({ ok: true, changed: false, message: 'No changes detected.' })
  }

  const updated = await db.electionSession.update({
    where: { id },
    data: updates,
    select: {
      id: true, name: true, description: true, visibility: true,
      status: true, settings: true, startTime: true, endTime: true,
    },
  })

  // Timeline event describing what changed.
  await db.electionEvent.create({
    data: {
      electionId: id,
      organizationId: org.id,
      eventType: 'ELECTION_UPDATED',
      description: `Settings updated by ${official.name} — changed: ${changedFields.join(', ')}`,
      actorId: official.id,
      actorName: official.name,
      metadata: JSON.stringify({ fields: changedFields }),
    },
  }).catch(() => {})

  // Audit log entry (hash-chained).
  await writeAudit({
    actorId: official.id,
    actorRole: official.role,
    actorName: official.name,
    action: 'ELECTION_UPDATED',
    details: {
      organizationId: org.id,
      electionId: id,
      fields: changedFields,
      settingsChanged: changedFields.includes('settings'),
    },
    ip: getClientIp(req),
    electionId: id,
  }).catch(() => {})

  return json({
    ok: true,
    changed: true,
    fields: changedFields,
    election: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      visibility: updated.visibility,
      status: updated.status,
      startTime: updated.startTime,
      endTime: updated.endTime,
    },
    settings: parseSettings(updated.settings),
  })
}
