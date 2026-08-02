// VoteWise — Chapter 14 Subscription Manager
//
// Handles subscription lifecycle: upgrade, downgrade, renewal reminders,
// and white-label licensing.

import { db } from '@/lib/db'
import { recordEvent } from '@/lib/eifdirs'

// ---------------------------------------------------------------------------
// Upgrade / Downgrade
// ---------------------------------------------------------------------------

export async function upgradeSubscription(organizationId: string, newPlan: string, upgradedBy: string): Promise<void> {
  const sub = await db.organizationSubscription.findUnique({ where: { organizationId } })
  if (!sub) throw new Error('Subscription not found')

  const oldPlan = sub.plan
  await db.organizationSubscription.update({
    where: { organizationId },
    data: { plan: newPlan },
  })

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'INFO',
    description: `Subscription upgraded from ${oldPlan} to ${newPlan} by ${upgradedBy}`,
    actorId: upgradedBy,
    actorRole: 'ADMIN',
  })
}

export async function downgradeSubscription(organizationId: string, newPlan: string, downgradedBy: string): Promise<void> {
  const sub = await db.organizationSubscription.findUnique({ where: { organizationId } })
  if (!sub) throw new Error('Subscription not found')

  // Warn about data limits — never delete data immediately
  const plan = await db.pricingPlan.findFirst({ where: { name: newPlan } })
  if (plan && plan.maxVoters > 0) {
    const voterCount = await db.voter.count({ where: { organizationId } })
    if (voterCount > plan.maxVoters) {
      throw new Error(`Cannot downgrade: you have ${voterCount} voters but ${newPlan} plan allows only ${plan.maxVoters}. Please reduce voters before downgrading.`)
    }
  }

  const oldPlan = sub.plan
  await db.organizationSubscription.update({
    where: { organizationId },
    data: { plan: newPlan },
  })

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'WARNING',
    description: `Subscription downgraded from ${oldPlan} to ${newPlan} by ${downgradedBy}. Data preserved.`,
    actorId: downgradedBy,
    actorRole: 'ADMIN',
  })
}

// ---------------------------------------------------------------------------
// Renewal Reminders (30, 14, 7, 3, 1 days before expiry)
// ---------------------------------------------------------------------------

const RENEWAL_REMINDER_DAYS = [30, 14, 7, 3, 1]

export async function processRenewalReminders(): Promise<{ processed: number; sent: number }> {
  const activeSubs = await db.organizationSubscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { not: null },
    },
    select: { id: true, organizationId: true, currentPeriodEnd: true },
  })

  let processed = 0
  let sent = 0

  for (const sub of activeSubs) {
    if (!sub.currentPeriodEnd) continue
    processed++

    const daysUntilExpiry = Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    if (RENEWAL_REMINDER_DAYS.includes(daysUntilExpiry)) {
      // Check if we already sent a reminder for this threshold
      const existing = await db.notification.findFirst({
        where: {
          electionSession: { organizationId: sub.organizationId },
          title: { contains: `Renewal reminder: ${daysUntilExpiry} days` },
          createdAt: { gte: new Date(Date.now() - 25 * 60 * 60 * 1000) }, // last 25 hours
        },
      })

      if (!existing) {
        await db.notification.create({
          data: {
            title: `Renewal reminder: ${daysUntilExpiry} days remaining`,
            message: `Your VoteWise subscription expires in ${daysUntilExpiry} day(s). Please renew to avoid service interruption.`,
            type: 'WARNING',
          },
        }).catch(() => {})
        sent++
      }
    }
  }

  return { processed, sent }
}

// ---------------------------------------------------------------------------
// White Label Licensing
// ---------------------------------------------------------------------------

export async function enableWhiteLabel(organizationId: string, enabledBy: string): Promise<void> {
  const brand = await db.organizationBrand.findUnique({ where: { organizationId } })
  if (!brand) throw new Error('Organization branding not found')

  await db.organizationBrand.update({
    where: { organizationId },
    data: { customCSS: (brand.customCSS || '') + '\n/* White Label: VoteWise branding hidden */\n.votewise-brand-mark { display: none !important; }' },
  })

  await db.organizationSubscription.update({
    where: { organizationId },
    data: { plan: 'WHITE_LABEL' },
  })

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'HIGH',
    description: `White label licensing enabled by ${enabledBy}. VoteWise branding will be hidden.`,
    actorId: enabledBy,
    actorRole: 'ADMIN',
  })
}

export async function disableWhiteLabel(organizationId: string, disabledBy: string): Promise<void> {
  const brand = await db.organizationBrand.findUnique({ where: { organizationId } })
  if (brand?.customCSS) {
    await db.organizationBrand.update({
      where: { organizationId },
      data: { customCSS: brand.customCSS.replace(/\/\* White Label.*?\}\s*\}/s, '') },
    })
  }

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'INFO',
    description: `White label licensing disabled by ${disabledBy}.`,
    actorId: disabledBy,
    actorRole: 'ADMIN',
  })
}
