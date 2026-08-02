// VoteWise — Chapter 14 Quote & Invoice Generator
//
// Generates quotations and invoices from pricing estimates. Quotes are
// downloadable, convertible to invoices, and have expiration dates.

import { db } from '@/lib/db'
import { generateEstimate, validateCoupon } from './pricing-engine'
import type { QuoteInput, QuoteResult, QuoteItem } from './types'

let quoteCounter = 0
let invoiceCounter = 0

async function generateQuoteNumber(): Promise<string> {
  const count = await db.quote.count()
  return `QUO-${String(count + 1).padStart(6, '0')}`
}

async function generateInvoiceNumber(): Promise<string> {
  const count = await db.invoice.count()
  return `INV-${String(count + 1).padStart(6, '0')}`
}

/**
 * Generate a quote from input parameters.
 */
export async function generateQuote(input: QuoteInput): Promise<QuoteResult> {
  const estimate = await generateEstimate({
    estimatedVoters: input.estimatedVoters || 0,
    estimatedElections: input.estimatedElections || 1,
    requestedFeatures: input.requestedFeatures,
    planName: input.planName,
  })

  let discountAmount = 0
  let discountPercent = 0

  // Apply coupon if provided
  if (input.couponCode) {
    const coupon = await validateCoupon(input.couponCode, estimate.subtotal)
    if (coupon.valid) {
      discountAmount = coupon.discount
      discountPercent = Math.round((discountAmount / estimate.subtotal) * 100)
    }
  } else {
    discountAmount = estimate.discount
    discountPercent = estimate.subtotal > 0 ? Math.round((estimate.discount / estimate.subtotal) * 100) : 0
  }

  const subtotal = estimate.subtotal
  const taxRate = 7.5 // 7.5% VAT (Nigeria)
  const taxableAmount = subtotal - discountAmount
  const taxAmount = Math.round(taxableAmount * taxRate) / 100
  const grandTotal = taxableAmount + taxAmount

  const quoteNumber = await generateQuoteNumber()
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const quote = await db.quote.create({
    data: {
      quoteNumber,
      organizationId: input.organizationId || null,
      organizationName: input.organizationName || null,
      items: JSON.stringify(estimate.items),
      subtotal,
      taxRate,
      taxAmount,
      discountPercent,
      discountAmount,
      grandTotal,
      currency: estimate.currency,
      validUntil,
      status: 'DRAFT',
      estimatedVoters: input.estimatedVoters || null,
      estimatedElections: input.estimatedElections || null,
      requestedFeatures: input.requestedFeatures ? JSON.stringify(input.requestedFeatures) : null,
      notes: input.notes || null,
    },
  })

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    items: estimate.items,
    subtotal,
    taxRate,
    taxAmount,
    discountPercent,
    discountAmount,
    grandTotal,
    currency: estimate.currency,
    validUntil: validUntil.toISOString(),
    status: 'DRAFT',
  }
}

/**
 * Convert an accepted quote to an invoice.
 */
export async function convertQuoteToInvoice(quoteId: string, organizationId: string): Promise<string> {
  const quote = await db.quote.findUnique({ where: { id: quoteId } })
  if (!quote) throw new Error('Quote not found')
  if (quote.status !== 'ACCEPTED') throw new Error('Quote must be accepted first')

  const invoiceNumber = await generateInvoiceNumber()
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      organizationId,
      organizationName: quote.organizationName,
      quoteId: quote.id,
      items: quote.items,
      subtotal: quote.subtotal,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      discountAmount: quote.discountAmount,
      grandTotal: quote.grandTotal,
      currency: quote.currency,
      status: 'SENT',
      dueDate,
      sentAt: new Date(),
    },
  })

  await db.quote.update({
    where: { id: quoteId },
    data: { status: 'CONVERTED' },
  })

  return invoice.id
}

/**
 * Create an invoice directly (without a quote).
 */
export async function createInvoice(opts: {
  organizationId: string
  organizationName?: string
  items: QuoteItem[]
  notes?: string
  dueInDays?: number
}): Promise<string> {
  const subtotal = opts.items.reduce((sum, item) => sum + item.total, 0)
  const taxRate = 7.5
  const taxAmount = Math.round(subtotal * taxRate) / 100
  const grandTotal = subtotal + taxAmount
  const invoiceNumber = await generateInvoiceNumber()
  const dueDate = new Date(Date.now() + (opts.dueInDays || 7) * 24 * 60 * 60 * 1000)

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      organizationId: opts.organizationId,
      organizationName: opts.organizationName || null,
      items: JSON.stringify(opts.items),
      subtotal,
      taxRate,
      taxAmount,
      grandTotal,
      currency: 'NGN',
      status: 'SENT',
      dueDate,
      sentAt: new Date(),
      notes: opts.notes || null,
    },
  })

  return invoice.id
}

/**
 * Get quotes for an organization.
 */
export async function getQuotes(organizationId: string) {
  const quotes = await db.quote.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return quotes.map((q) => ({
    ...q,
    items: JSON.parse(q.items),
    validUntil: q.validUntil.toISOString(),
    createdAt: q.createdAt.toISOString(),
  }))
}

/**
 * Get invoices for an organization.
 */
export async function getInvoices(organizationId: string) {
  const invoices = await db.invoice.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return invoices.map((i) => ({
    ...i,
    items: JSON.parse(i.items),
    dueDate: i.dueDate.toISOString(),
    paidAt: i.paidAt?.toISOString() || null,
    sentAt: i.sentAt?.toISOString() || null,
    createdAt: i.createdAt.toISOString(),
  }))
}

/**
 * Get all invoices (platform admin).
 */
export async function getAllInvoices(opts: { status?: string; limit?: number } = {}) {
  const where: any = {}
  if (opts.status) where.status = opts.status
  const limit = opts.limit || 100

  const invoices = await db.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return invoices.map((i) => ({
    ...i,
    items: JSON.parse(i.items),
    dueDate: i.dueDate.toISOString(),
    paidAt: i.paidAt?.toISOString() || null,
    createdAt: i.createdAt.toISOString(),
  }))
}
