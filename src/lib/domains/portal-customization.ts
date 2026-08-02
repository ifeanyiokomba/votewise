// VoteWise — Portal Customization (Enterprise Audit Part 2)
//
// Manages PortalSettings, HomepageBlock, HomepageBanner.
// Spec: "PortalSettings, HomepageBlocks, HomepageAnnouncements,
// HomepageBanners. Every organization customizes its portal."

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// PortalSettings
// ---------------------------------------------------------------------------

export interface PortalSettingsInput {
  organizationId: string
  showCountdown?: boolean
  showStats?: boolean
  showCandidates?: boolean
  showCommittee?: boolean
  showTimetable?: boolean
  showAnnouncements?: boolean
  resultsVisibility?: string
  customWelcomeText?: string
  customFooterText?: string
  socialLinks?: Record<string, string>
  metaDescription?: string
}

export async function getPortalSettings(organizationId: string) {
  let settings = await db.portalSettings.findUnique({ where: { organizationId } })
  if (!settings) {
    // Create defaults
    settings = await db.portalSettings.create({ data: { organizationId } })
  }
  return {
    ...settings,
    socialLinks: settings.socialLinks ? JSON.parse(settings.socialLinks) : null,
  }
}

export async function updatePortalSettings(organizationId: string, input: Partial<PortalSettingsInput>) {
  const data: any = { ...input }
  if (input.socialLinks) data.socialLinks = JSON.stringify(input.socialLinks)
  // Upsert: update if exists, create if not
  return db.portalSettings.upsert({
    where: { organizationId },
    update: data,
    create: { organizationId, ...data },
  })
}

// ---------------------------------------------------------------------------
// HomepageBlock
// ---------------------------------------------------------------------------

export interface HomepageBlockInput {
  organizationId: string
  blockType: string
  title?: string
  content?: string
  position?: number
  visible?: boolean
  startDate?: Date
  endDate?: Date
}

export async function listHomepageBlocks(organizationId: string) {
  return db.homepageBlock.findMany({
    where: { organizationId },
    orderBy: { position: 'asc' },
  })
}

export async function createHomepageBlock(input: HomepageBlockInput) {
  return db.homepageBlock.create({ data: input })
}

export async function updateHomepageBlock(id: string, update: Partial<HomepageBlockInput>) {
  return db.homepageBlock.update({ where: { id }, data: update })
}

export async function deleteHomepageBlock(id: string) {
  return db.homepageBlock.delete({ where: { id } })
}

// ---------------------------------------------------------------------------
// HomepageBanner
// ---------------------------------------------------------------------------

export interface HomepageBannerInput {
  organizationId: string
  title: string
  message: string
  type?: string
  imageUrl?: string
  actionUrl?: string
  actionLabel?: string
  dismissible?: boolean
  startDate?: Date
  endDate?: Date
  active?: boolean
}

export async function listHomepageBanners(organizationId: string, activeOnly: boolean = false) {
  const where: any = { organizationId }
  if (activeOnly) {
    where.active = true
    const now = new Date()
    where.OR = [
      { startDate: null, endDate: null },
      { startDate: { lte: now }, endDate: null },
      { startDate: null, endDate: { gte: now } },
      { startDate: { lte: now }, endDate: { gte: now } },
    ]
  }
  return db.homepageBanner.findMany({ where, orderBy: { createdAt: 'desc' } })
}

export async function createHomepageBanner(input: HomepageBannerInput) {
  return db.homepageBanner.create({ data: input })
}

export async function updateHomepageBanner(id: string, update: Partial<HomepageBannerInput>) {
  return db.homepageBanner.update({ where: { id }, data: update })
}

export async function deleteHomepageBanner(id: string) {
  return db.homepageBanner.delete({ where: { id } })
}
