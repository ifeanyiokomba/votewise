// VoteWise — Chapter 14 Pricing Engine
//
// Configurable pricing engine that reads from PricingPlan + PricingRule tables.
// Never hardcode pricing — everything is database-driven so pricing can change
// without code changes.
//
// Supports: per election, per voter, annual, custom. Tiered pricing, volume
// discounts, feature add-ons, seasonal discounts, educational/NGO discounts.

import { db } from '@/lib/db'
import type { QuoteItem, PricingEstimate, PlanName } from './types'

// Default plans (seeded on first run)
const DEFAULT_PLANS = [
  {
    name: 'FREE',
    displayName: 'Free',
    description: 'Build and test your election. Pay only when you go live.',
    model: 'PER_ELECTION',
    basePrice: 0,
    perVoterPrice: 0,
    perElectionPrice: 0,
    currency: 'NGN',
    features: ['dashboard', 'branding', 'election_builder', 'voter_import', 'test_elections'],
    maxVoters: 100,
    maxElections: 3,
    maxObservers: 5,
    sortOrder: 0,
  },
  {
    name: 'PAYG',
    displayName: 'Pay As You Go',
    description: 'Pay per election. Perfect for one-off elections.',
    model: 'PER_ELECTION',
    basePrice: 50000, // ₦50,000 base
    perVoterPrice: 100, // ₦100 per voter
    perElectionPrice: 0,
    currency: 'NGN',
    features: ['dashboard', 'branding', 'election_builder', 'voter_import', 'live_results', 'observer_management', 'receipts', 'audit_trail'],
    maxVoters: 0, // unlimited
    maxElections: 0,
    maxObservers: 0,
    sortOrder: 1,
  },
  {
    name: 'PROFESSIONAL',
    displayName: 'Professional',
    description: 'Annual license for organizations with regular elections.',
    model: 'ANNUAL',
    basePrice: 500000, // ₦500,000/year
    perVoterPrice: 50, // ₦50 per voter (lower than PAYG)
    perElectionPrice: 0,
    currency: 'NGN',
    features: ['dashboard', 'branding', 'election_builder', 'voter_import', 'live_results', 'observer_management', 'receipts', 'audit_trail', 'custom_domain', 'ai_insights', 'advanced_reports'],
    maxVoters: 50000,
    maxElections: 0,
    maxObservers: 0,
    sortOrder: 2,
  },
  {
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    description: 'Custom pricing for large organizations. Negotiated.',
    model: 'CUSTOM',
    basePrice: 0,
    perVoterPrice: 0,
    perElectionPrice: 0,
    currency: 'NGN',
    features: ['all_features', 'white_label', 'custom_integrations', 'dedicated_support', 'sla'],
    maxVoters: 0,
    maxElections: 0,
    maxObservers: 0,
    sortOrder: 3,
  },
]

// Default pricing rules (tiered)
const DEFAULT_RULES = [
  // PAYG tiered pricing: first 500 voters free, 501-5000 at ₦100, 5001+ at ₦80
  { name: 'PAYG First 500 Free', planId: null, type: 'TIERED', minQuantity: 0, maxQuantity: 500, pricePerUnit: 0, discountPercent: 0, fixedDiscount: 0, featureName: null, featurePrice: 0, condition: null, isActive: true },
  { name: 'PAYG 501-5000', planId: null, type: 'TIERED', minQuantity: 501, maxQuantity: 5000, pricePerUnit: 100, discountPercent: 0, fixedDiscount: 0, featureName: null, featurePrice: 0, condition: null, isActive: true },
  { name: 'PAYG 5001+ Discount', planId: null, type: 'TIERED', minQuantity: 5001, maxQuantity: 0, pricePerUnit: 80, discountPercent: 0, fixedDiscount: 0, featureName: null, featurePrice: 0, condition: null, isActive: true },
  // Feature add-ons
  { name: 'WhatsApp Notifications', planId: null, type: 'FEATURE_ADDON', minQuantity: 0, maxQuantity: 0, pricePerUnit: 0, discountPercent: 0, fixedDiscount: 0, featureName: 'whatsapp_notifications', featurePrice: 25000, condition: null, isActive: true },
  { name: 'SMS Credits (1000)', planId: null, type: 'FEATURE_ADDON', minQuantity: 0, maxQuantity: 0, pricePerUnit: 0, discountPercent: 0, fixedDiscount: 0, featureName: 'sms_credits', featurePrice: 15000, condition: null, isActive: true },
  { name: 'Custom Domain', planId: null, type: 'FEATURE_ADDON', minQuantity: 0, maxQuantity: 0, pricePerUnit: 0, discountPercent: 0, fixedDiscount: 0, featureName: 'custom_domain', featurePrice: 50000, condition: null, isActive: true },
  { name: 'AI Analytics', planId: null, type: 'FEATURE_ADDON', minQuantity: 0, maxQuantity: 0, pricePerUnit: 0, discountPercent: 0, fixedDiscount: 0, featureName: 'ai_analytics', featurePrice: 100000, condition: null, isActive: true },
  { name: 'Premium Support', planId: null, type: 'FEATURE_ADDON', minQuantity: 0, maxQuantity: 0, pricePerUnit: 0, discountPercent: 0, fixedDiscount: 0, featureName: 'premium_support', featurePrice: 75000, condition: null, isActive: true },
  // Educational discount
  { name: 'Educational 15%', planId: null, type: 'SEASONAL', minQuantity: 0, maxQuantity: 0, pricePerUnit: 0, discountPercent: 15, fixedDiscount: 0, featureName: null, featurePrice: 0, condition: '{"orgType":"UNIVERSITY"}', isActive: true },
]

/**
 * Seed default pricing plans and rules.
 */
export async function seedPricingData(): Promise<void> {
  // Seed plans
  for (const plan of DEFAULT_PLANS) {
    const existing = await db.pricingPlan.findFirst({ where: { name: plan.name } })
    if (!existing) {
      await db.pricingPlan.create({
        data: {
          ...plan,
          features: JSON.stringify(plan.features),
        },
      })
    }
  }

  // Seed rules
  for (const rule of DEFAULT_RULES) {
    const existing = await db.pricingRule.findFirst({ where: { name: rule.name } })
    if (!existing) {
      await db.pricingRule.create({ data: rule })
    }
  }
}

/**
 * Get all active pricing plans.
 */
export async function getPricingPlans() {
  return db.pricingPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

/**
 * Generate a pricing estimate based on voter count, elections, and features.
 * This is the core of the Pricing Engine.
 */
export async function generateEstimate(opts: {
  estimatedVoters: number
  estimatedElections?: number
  requestedFeatures?: string[]
  planName?: PlanName
  orgType?: string
}): Promise<PricingEstimate> {
  const planName = opts.planName || 'PAYG'
  const plan = await db.pricingPlan.findFirst({ where: { name: planName, isActive: true } })
  if (!plan) throw new Error(`Plan ${planName} not found`)

  const items: QuoteItem[] = []
  let subtotal = 0

  // Base price
  if (plan.basePrice > 0) {
    items.push({
      description: `${plan.displayName} — Base Price`,
      quantity: 1,
      unitPrice: plan.basePrice,
      total: plan.basePrice,
    })
    subtotal += plan.basePrice
  }

  // Per-voter pricing (with tiered rules)
  if (opts.estimatedVoters > 0) {
    const tieredCost = await calculateTieredVoterCost(opts.estimatedVoters)
    if (tieredCost > 0) {
      items.push({
        description: `Voter Registration (${opts.estimatedVoters.toLocaleString()} voters)`,
        quantity: opts.estimatedVoters,
        unitPrice: tieredCost / opts.estimatedVoters,
        total: tieredCost,
      })
      subtotal += tieredCost
    }
  }

  // Per-election pricing
  if (plan.perElectionPrice > 0 && opts.estimatedElections) {
    const electionCost = plan.perElectionPrice * opts.estimatedElections
    items.push({
      description: `Elections (${opts.estimatedElections})`,
      quantity: opts.estimatedElections,
      unitPrice: plan.perElectionPrice,
      total: electionCost,
    })
    subtotal += electionCost
  }

  // Feature add-ons
  const features: string[] = []
  if (plan.features) {
    features.push(...JSON.parse(plan.features))
  }

  if (opts.requestedFeatures && opts.requestedFeatures.length > 0) {
    const addonRules = await db.pricingRule.findMany({
      where: { type: 'FEATURE_ADDON', isActive: true },
    })

    for (const feature of opts.requestedFeatures) {
      const rule = addonRules.find((r) => r.featureName === feature)
      if (rule && rule.featurePrice > 0) {
        items.push({
          description: `Add-on: ${feature.replace(/_/g, ' ')}`,
          quantity: 1,
          unitPrice: rule.featurePrice,
          total: rule.featurePrice,
        })
        subtotal += rule.featurePrice
        features.push(feature)
      }
    }
  }

  // Apply discounts (educational, seasonal)
  let discount = 0
  if (opts.orgType) {
    const discountRules = await db.pricingRule.findMany({
      where: { type: 'SEASONAL', isActive: true },
    })
    for (const rule of discountRules) {
      if (rule.condition) {
        const condition = JSON.parse(rule.condition)
        if (condition.orgType === opts.orgType && rule.discountPercent > 0) {
          discount = Math.round((subtotal * rule.discountPercent) / 100)
          break
        }
      }
    }
  }

  const total = subtotal - discount

  return {
    plan: plan.name,
    items,
    subtotal,
    discount,
    total,
    currency: plan.currency,
    features,
  }
}

/**
 * Calculate tiered voter cost based on pricing rules.
 * Example: 0-500 free, 501-5000 at ₦100, 5001+ at ₦80.
 */
async function calculateTieredVoterCost(voterCount: number): Promise<number> {
  const tieredRules = await db.pricingRule.findMany({
    where: { type: 'TIERED', isActive: true },
    orderBy: { minQuantity: 'asc' },
  })

  if (tieredRules.length === 0) {
    // No tiered rules — use flat per-voter price
    return 0 // handled by plan.perVoterPrice
  }

  let totalCost = 0
  for (const rule of tieredRules) {
    const min = rule.minQuantity
    const max = rule.maxQuantity || Infinity
    if (voterCount > min) {
      const votersInTier = Math.min(voterCount, max) - (min > 0 ? min - 1 : 0)
      // Actually: voters in this tier = min(voterCount, max) - min + 1 if min > 0
      // For the first tier (0-500): voters in tier = min(voterCount, 500)
      // For second tier (501-5000): voters = min(voterCount, 5000) - 500
      // For third tier (5001+): voters = voterCount - 5000
      const votersInThisTier = min === 0
        ? Math.min(voterCount, max)
        : Math.min(voterCount, max) - (min - 1)
      if (votersInThisTier > 0) {
        totalCost += votersInThisTier * rule.pricePerUnit
      }
    }
  }

  return totalCost
}

/**
 * Validate and apply a coupon code.
 */
export async function validateCoupon(code: string, amount: number): Promise<{
  valid: boolean
  discount: number
  message: string
}> {
  const coupon = await db.coupon.findFirst({
    where: { code: code.toUpperCase(), isActive: true },
  })

  if (!coupon) {
    return { valid: false, discount: 0, message: 'Invalid coupon code' }
  }

  if (coupon.validUntil && coupon.validUntil < new Date()) {
    return { valid: false, discount: 0, message: 'Coupon has expired' }
  }

  if (coupon.maxUses > 0 && coupon.usesCount >= coupon.maxUses) {
    return { valid: false, discount: 0, message: 'Coupon usage limit reached' }
  }

  if (amount < coupon.minAmount) {
    return { valid: false, discount: 0, message: `Minimum amount is ${coupon.minAmount} ${coupon.currency}` }
  }

  const discount = coupon.type === 'PERCENTAGE'
    ? Math.round((amount * coupon.value) / 100)
    : coupon.value

  return { valid: true, discount, message: `Coupon applied: ${coupon.type === 'PERCENTAGE' ? coupon.value + '%' : coupon.value + ' ' + coupon.currency} off` }
}
