import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getIncident, updateIncidentStatus, assignIncident, addInvestigationNote, markFalsePositive, escalateIncident } from '@/lib/eifdirs'
import { verifyAccessToken } from '@/lib/auth'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/incidents/[incidentId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ incidentId: string }> }) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { incidentId } = await params
  const incident = await getIncident(incidentId)
  if (!incident) return errorJson('Incident not found', 404)

  return json(incident)
}

// PATCH /api/eifdirs/incidents/[incidentId] — update incident
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ incidentId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { incidentId } = await params
  const body = await req.json().catch(() => ({}))
  const { action } = body

  // Get current user
  const auth = verifyAccessToken(req)
  const userName = auth?.email || 'Unknown'
  const userId = auth?.sub || 'unknown'

  switch (action) {
    case 'assign':
      await assignIncident(incidentId, body.assignedToId || userId, body.assignedToName || userName)
      return json({ ok: true, message: 'Incident assigned' })

    case 'updateStatus':
      await updateIncidentStatus(incidentId, body.status, userName, userId, body.resolution)
      return json({ ok: true, message: `Status updated to ${body.status}` })

    case 'addNote':
      await addInvestigationNote(incidentId, body.note, userName, userId)
      return json({ ok: true, message: 'Note added' })

    case 'markFalsePositive':
      await markFalsePositive(incidentId, body.reason, userName, userId)
      return json({ ok: true, message: 'Marked as false positive' })

    case 'escalate':
      await escalateIncident(incidentId, body.severity, body.reason, userName, userId)
      return json({ ok: true, message: `Escalated to ${body.severity}` })

    default:
      return errorJson(`Unknown action: ${action}`, 400)
  }
}
