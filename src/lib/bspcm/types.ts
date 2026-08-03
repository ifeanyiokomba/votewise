// VoteWise — Chapter 14 BSPCM Types

export type PricingModel = 'PER_ELECTION' | 'PER_VOTER' | 'ANNUAL' | 'CUSTOM'
export type PlanName = 'FREE' | 'PAYG' | 'PROFESSIONAL' | 'ENTERPRISE' | 'GOVERNMENT' | 'WHITE_LABEL'
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED'
export type PaymentStatus = 'INITIATED' | 'PROCESSING' | 'VERIFIED' | 'FAILED' | 'REFUNDED'
export type PaymentGateway = 'PAYSTACK' | 'BANK_TRANSFER'
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'
export type NegotiationStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'COUNTER_OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
export type RefundStatus = 'REQUESTED' | 'REVIEWED' | 'APPROVED' | 'PROCESSED' | 'COMPLETED' | 'REJECTED'
export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT'
export type AddOnFeature = 'EXTRA_SMS' | 'EXTRA_WHATSAPP' | 'PREMIUM_SUPPORT' | 'CUSTOM_DOMAIN' | 'AI_INSIGHTS' | 'ADVANCED_REPORTS' | 'ADDITIONAL_STORAGE'

export interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface QuoteInput {
  organizationId?: string
  organizationName?: string
  estimatedVoters?: number
  estimatedElections?: number
  requestedFeatures?: string[]
  planName?: PlanName
  couponCode?: string
  notes?: string
}

export interface QuoteResult {
  id: string
  quoteNumber: string
  items: QuoteItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discountPercent: number
  discountAmount: number
  grandTotal: number
  currency: string
  validUntil: string
  status: string
}

export interface PricingEstimate {
  plan: string
  items: QuoteItem[]
  subtotal: number
  discount: number
  total: number
  currency: string
  features: string[]
}

export interface GoLiveValidation {
  checks: Array<{ name: string; passed: boolean; message?: string }>
  canGoLive: boolean
  estimate?: PricingEstimate
}

export interface RevenueDashboard {
  monthlyRevenue: number
  annualRevenue: number
  mrr: number // monthly recurring revenue
  arr: number // annual recurring revenue
  pendingPayments: number
  outstandingInvoices: number
  activeSubscriptions: number
  expiringSubscriptions: number
  refunds: number
  revenueTimeline: Array<{ month: string; revenue: number }>
  topOrganizations: Array<{ id: string; name: string; revenue: number; plan: string }>
}
