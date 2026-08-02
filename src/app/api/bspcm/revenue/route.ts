import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/revenue — Platform revenue dashboard (super admin only)
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || auth.role !== 'SUPER_ADMIN') {
    return errorJson('Unauthorized — platform admin only', 401)
  }

  const [
    totalInvoices, paidInvoices, pendingInvoices, overdueInvoices,
    totalPayments, verifiedPayments, activeSubscriptions, expiringSubscriptions,
    refunds, allInvoices,
  ] = await Promise.all([
    db.invoice.count(),
    db.invoice.count({ where: { status: 'PAID' } }),
    db.invoice.count({ where: { status: { in: ['SENT', 'PARTIALLY_PAID'] } } }),
    db.invoice.count({ where: { status: 'OVERDUE' } }),
    db.payment.count(),
    db.payment.findMany({ where: { status: 'VERIFIED' }, select: { amount: true, currency: true, createdAt: true, organizationId: true } }),
    db.organizationSubscription.count({ where: { status: 'ACTIVE' } }),
    db.organizationSubscription.count({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.refund.count({ where: { status: { in: ['REQUESTED', 'APPROVED', 'PROCESSED'] } } }),
    db.invoice.findMany({
      where: { status: 'PAID' },
      select: { grandTotal: true, amountPaid: true, currency: true, createdAt: true, organizationId: true, organizationName: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ])

  // Calculate revenue
  const monthlyRevenue = verifiedPayments
    .filter((p) => p.createdAt > new Date(new Date().setDate(1)))
    .reduce((sum, p) => sum + p.amount, 0)
  const annualRevenue = verifiedPayments
    .filter((p) => p.createdAt > new Date(new Date().setMonth(0, 1)))
    .reduce((sum, p) => sum + p.amount, 0)
  const mrr = verifiedPayments
    .filter((p) => p.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, p) => sum + p.amount, 0)
  const arr = mrr * 12

  // Revenue timeline (last 12 months)
  const revenueTimeline: Array<{ month: string; revenue: number }> = []
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() - i + 1, 1)
    const monthRevenue = verifiedPayments
      .filter((p) => p.createdAt >= monthStart && p.createdAt < monthEnd)
      .reduce((sum, p) => sum + p.amount, 0)
    revenueTimeline.push({ month: monthStart.toISOString().slice(0, 7), revenue: monthRevenue })
  }

  // Top organizations by revenue
  const orgRevenue: Record<string, { name: string; revenue: number; count: number }> = {}
  for (const inv of allInvoices) {
    if (!orgRevenue[inv.organizationId]) {
      orgRevenue[inv.organizationId] = { name: inv.organizationName || 'Unknown', revenue: 0, count: 0 }
    }
    orgRevenue[inv.organizationId].revenue += inv.amountPaid
    orgRevenue[inv.organizationId].count++
  }
  const topOrganizations = Object.entries(orgRevenue)
    .map(([id, data]) => ({ id, name: data.name, revenue: data.revenue, plan: 'PAYG' }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return json({
    monthlyRevenue,
    annualRevenue,
    mrr,
    arr,
    pendingPayments: pendingInvoices,
    outstandingInvoices: pendingInvoices + overdueInvoices,
    activeSubscriptions,
    expiringSubscriptions,
    refunds,
    revenueTimeline,
    topOrganizations,
    totalInvoices,
    paidInvoices,
  })
}
