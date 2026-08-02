// VoteWise — Scheduled Maintenance Manager (Chapter 17 — Maintenance Windows)
//
// Lets admins schedule future maintenance windows (planned downtime or
// degraded periods), notify affected orgs, and auto-activate when the
// window starts. Distinct from MaintenanceMode (which is active right now).
//
// Spec (Ch.17 Platform Status Page): "Public page displaying: Uptime,
// Maintenance windows, Service incidents, Historical availability."

import { db } from '@/lib/db'
import { logger } from './logger'

export interface ScheduledMaintenanceInput {
  title: string
  description: string
  level: string // PLATFORM | ORGANIZATION | MODULE
  organizationId?: string
  module?: string
  scheduledStart: Date
  scheduledEnd: Date
  createdBy: string
  createdByName: string
}

export async function createScheduledMaintenance(input: ScheduledMaintenanceInput) {
  if (input.scheduledEnd <= input.scheduledStart) {
    throw new Error('End time must be after start time')
  }

  const sm = await db.scheduledMaintenance.create({
    data: {
      title: input.title,
      description: input.description,
      level: input.level,
      organizationId: input.organizationId || null,
      module: input.module || null,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      status: 'SCHEDULED',
      createdBy: input.createdBy,
      createdByName: input.createdByName,
    },
  })

  logger.audit(`Scheduled maintenance created: ${input.title}`, {
    category: 'deployment',
    metadata: { id: sm.id, start: input.scheduledStart, end: input.scheduledEnd },
  })

  return sm
}

export async function listScheduledMaintenance(limit: number = 20, status?: string) {
  const where = status ? { status } : {}
  return db.scheduledMaintenance.findMany({
    where,
    orderBy: { scheduledStart: 'asc' },
    take: limit,
  })
}

export async function updateScheduledMaintenance(id: string, update: {
  status?: string
  notifiedOrgs?: boolean
  title?: string
  description?: string
  scheduledStart?: Date
  scheduledEnd?: Date
}) {
  return db.scheduledMaintenance.update({ where: { id }, data: update })
}

export async function cancelScheduledMaintenance(id: string) {
  return db.scheduledMaintenance.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
}

/**
 * Check for scheduled maintenance windows that should be activated now.
 * Called by the periodic scheduler. When a window's start time arrives,
 * it creates a MaintenanceMode record (active) and updates the scheduled
 * maintenance status to IN_PROGRESS.
 */
export async function activateDueMaintenance() {
  const now = new Date()
  const due = await db.scheduledMaintenance.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledStart: { lte: now },
      scheduledEnd: { gt: now },
    },
  })

  for (const sm of due) {
    // Create an active MaintenanceMode record
    await db.maintenanceMode.create({
      data: {
        level: sm.level,
        organizationId: sm.organizationId || null,
        module: sm.module || null,
        reason: sm.title,
        isActive: true,
        startedAt: now,
      },
    }).catch(() => {})

    await db.scheduledMaintenance.update({
      where: { id: sm.id },
      data: { status: 'IN_PROGRESS' },
    })

    logger.deployment(`Maintenance window activated: ${sm.title}`, {
      metadata: { id: sm.id },
    })
  }

  // Mark expired windows as COMPLETED
  const expired = await db.scheduledMaintenance.findMany({
    where: {
      status: 'IN_PROGRESS',
      scheduledEnd: { lte: now },
    },
  })

  for (const sm of expired) {
    // Deactivate the corresponding MaintenanceMode
    await db.maintenanceMode.updateMany({
      where: { reason: sm.title, isActive: true },
      data: { isActive: false, endedAt: now },
    }).catch(() => {})

    await db.scheduledMaintenance.update({
      where: { id: sm.id },
      data: { status: 'COMPLETED' },
    })

    logger.deployment(`Maintenance window completed: ${sm.title}`, {
      metadata: { id: sm.id },
    })
  }

  return { activated: due.length, completed: expired.length }
}

export async function getScheduledMaintenanceStats() {
  const now = new Date()
  const [total, scheduled, inProgress, completed, cancelled, upcoming] = await Promise.all([
    db.scheduledMaintenance.count(),
    db.scheduledMaintenance.count({ where: { status: 'SCHEDULED' } }),
    db.scheduledMaintenance.count({ where: { status: 'IN_PROGRESS' } }),
    db.scheduledMaintenance.count({ where: { status: 'COMPLETED' } }),
    db.scheduledMaintenance.count({ where: { status: 'CANCELLED' } }),
    db.scheduledMaintenance.count({
      where: {
        status: 'SCHEDULED',
        scheduledStart: { gte: now },
      },
    }),
  ])

  return { total, scheduled, inProgress, completed, cancelled, upcoming }
}

/**
 * Seed a sample scheduled maintenance window so the dashboard has content.
 */
export async function ensureScheduledMaintenanceSeeded() {
  const count = await db.scheduledMaintenance.count()
  if (count > 0) return

  const now = Date.now()
  await db.scheduledMaintenance.createMany({
    data: [
      {
        title: 'Database maintenance — index rebuild',
        description: 'Rebuilding indexes on the VoteRecord table to improve query performance for the upcoming election. Read replicas will serve traffic during the maintenance window. No downtime expected, but brief latency increases may occur.',
        level: 'PLATFORM',
        scheduledStart: new Date(now + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        scheduledEnd: new Date(now + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours
        status: 'SCHEDULED',
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
      {
        title: 'Q3 security patch rollout',
        description: 'Rolling security update to all application servers. Zero-downtime deployment via blue-green strategy. Voters will not be affected.',
        level: 'PLATFORM',
        scheduledStart: new Date(now + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        scheduledEnd: new Date(now + 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000), // 1 hour
        status: 'SCHEDULED',
        createdBy: 'system',
        createdByName: 'Security Team',
      },
      {
        title: 'Completed: Redis failover test',
        description: 'Scheduled Redis failover test to verify HA configuration. Test passed successfully — failover completed in 8 seconds.',
        level: 'PLATFORM',
        scheduledStart: new Date(now - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        scheduledEnd: new Date(now - 14 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min
        status: 'COMPLETED',
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
    ],
  })
}
