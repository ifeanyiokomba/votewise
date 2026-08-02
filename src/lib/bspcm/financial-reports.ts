// VoteWise — Chapter 14 Financial Reports
// Generates: Revenue, Invoice, Tax, Payment, Refund, Subscription reports.

import { db } from '@/lib/db'

export type FinancialReportType =
  | 'REVENUE' | 'INVOICE' | 'TAX' | 'PAYMENT' | 'REFUND' | 'SUBSCRIPTION'

export interface FinancialReport {
  type: FinancialReportType
  generatedAt: string
  data: any
  summary: Record<string, number>
}

export async function generateFinancialReport(type: FinancialReportType, opts: {
  organizationId?: string
  dateRange?: { start: Date; end: Date }
}): Promise<FinancialReport> {
  const where: any = {}
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.dateRange) where.createdAt = { gte: opts.dateRange.start, lte: opts.dateRange.end }

  switch (type) {
    case 'REVENUE':
      return generateRevenueReport(where, opts)
    case 'INVOICE':
      return generateInvoiceReport(where, opts)
    case 'TAX':
      return generateTaxReport(where, opts)
    case 'PAYMENT':
      return generatePaymentReport(where, opts)
    case 'REFUND':
      return generateRefundReport(where, opts)
    case 'SUBSCRIPTION':
      return generateSubscriptionReport(opts)
    default:
      throw new Error(`Unknown report type: ${type}`)
  }
}

async function generateRevenueReport(where: any, opts: any): Promise<FinancialReport> {
  const payments = await db.payment.findMany({
    where: { ...where, status: 'VERIFIED' },
    select: { amount: true, currency: true, createdAt: true, gateway: true, organizationId: true },
  })

  const total = payments.reduce((sum, p) => sum + p.amount, 0)
  const byGateway: Record<string, number> = {}
  for (const p of payments) {
    byGateway[p.gateway] = (byGateway[p.gateway] || 0) + p.amount
  }

  // Monthly breakdown
  const byMonth: Record<string, number> = {}
  for (const p of payments) {
    const month = p.createdAt.toISOString().slice(0, 7)
    byMonth[month] = (byMonth[month] || 0) + p.amount
  }

  return {
    type: 'REVENUE',
    generatedAt: new Date().toISOString(),
    data: { payments: payments.length, byGateway, byMonth },
    summary: { totalRevenue: total, transactionCount: payments.length },
  }
}

async function generateInvoiceReport(where: any, opts: any): Promise<FinancialReport> {
  const invoices = await db.invoice.findMany({
    where,
    select: { id: true, invoiceNumber: true, status: true, grandTotal: true, amountPaid: true, dueDate: true, createdAt: true },
  })

  const total = invoices.reduce((sum, i) => sum + i.grandTotal, 0)
  const paid = invoices.reduce((sum, i) => sum + i.amountPaid, 0)
  const outstanding = total - paid

  const byStatus: Record<string, number> = {}
  for (const i of invoices) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1
  }

  return {
    type: 'INVOICE',
    generatedAt: new Date().toISOString(),
    data: { invoices, byStatus },
    summary: { totalInvoiced: total, totalPaid: paid, totalOutstanding: outstanding, invoiceCount: invoices.length },
  }
}

async function generateTaxReport(where: any, opts: any): Promise<FinancialReport> {
  const invoices = await db.invoice.findMany({
    where: { ...where, status: 'PAID' },
    select: { subtotal: true, taxRate: true, taxAmount: true, grandTotal: true, createdAt: true },
  })

  const totalTaxCollected = invoices.reduce((sum, i) => sum + i.taxAmount, 0)
  const totalSubtotal = invoices.reduce((sum, i) => sum + i.subtotal, 0)

  return {
    type: 'TAX',
    generatedAt: new Date().toISOString(),
    data: { invoices },
    summary: { totalTaxCollected, totalSubtotal, averageTaxRate: invoices.length > 0 ? invoices[0].taxRate : 0 },
  }
}

async function generatePaymentReport(where: any, opts: any): Promise<FinancialReport> {
  const payments = await db.payment.findMany({
    where,
    select: { id: true, paymentReference: true, amount: true, currency: true, gateway: true, status: true, createdAt: true, verifiedAt: true, failedAt: true },
  })

  const byStatus: Record<string, number> = {}
  const byGateway: Record<string, number> = {}
  for (const p of payments) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1
    byGateway[p.gateway] = (byGateway[p.gateway] || 0) + 1
  }

  const totalVerified = payments.filter((p) => p.status === 'VERIFIED').reduce((sum, p) => sum + p.amount, 0)
  const totalFailed = payments.filter((p) => p.status === 'FAILED').length

  return {
    type: 'PAYMENT',
    generatedAt: new Date().toISOString(),
    data: { payments, byStatus, byGateway },
    summary: { totalPayments: payments.length, totalVerified, totalFailed, verificationRate: payments.length > 0 ? Math.round((payments.filter(p => p.status === 'VERIFIED').length / payments.length) * 10000) / 100 : 0 },
  }
}

async function generateRefundReport(where: any, opts: any): Promise<FinancialReport> {
  const refunds = await db.refund.findMany({
    where,
    select: { id: true, refundNumber: true, amount: true, currency: true, status: true, reason: true, createdAt: true },
  })

  const totalRefunded = refunds.filter((r) => r.status === 'COMPLETED').reduce((sum, r) => sum + r.amount, 0)
  const pending = refunds.filter((r) => ['REQUESTED', 'REVIEWED', 'APPROVED'].includes(r.status)).length

  return {
    type: 'REFUND',
    generatedAt: new Date().toISOString(),
    data: { refunds },
    summary: { totalRefunds: refunds.length, totalRefunded, pendingRefunds: pending },
  }
}

async function generateSubscriptionReport(opts: any): Promise<FinancialReport> {
  const subs = await db.organizationSubscription.findMany({
    select: { id: true, plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, voterQuota: true, votersUsed: true },
  })

  const byPlan: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  for (const s of subs) {
    byPlan[s.plan] = (byPlan[s.plan] || 0) + 1
    byStatus[s.status] = (byStatus[s.status] || 0) + 1
  }

  const active = subs.filter((s) => s.status === 'ACTIVE').length
  const expiring = subs.filter((s) => s.currentPeriodEnd && s.currentPeriodEnd < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length

  return {
    type: 'SUBSCRIPTION',
    generatedAt: new Date().toISOString(),
    data: { subscriptions: subs, byPlan, byStatus },
    summary: { totalSubscriptions: subs.length, activeSubscriptions: active, expiringSubscriptions: expiring },
  }
}
