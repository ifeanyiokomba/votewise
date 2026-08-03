// VoteWise — Payment Provider (Paystack only)
//
// Paystack is the only payment provider for VoteWise.
// It's the leading Nigerian payment gateway — supports cards, bank transfers,
// USSD, and mobile money. Perfect for Nigerian elections.
//
// Payment flow:
//   Initiate → Paystack → Verify → Activate
//
// Never activate a workspace until payment is VERIFIED.

import { db } from '@/lib/db'
import type { PaymentGateway, PaymentStatus } from './types'

export interface PaymentRequest {
  amount: number
  currency: string
  email: string
  name: string
  invoiceId?: string
  organizationId: string
  metadata?: Record<string, any>
}

export interface PaymentResult {
  success: boolean
  reference: string
  authorizationUrl?: string
  status: PaymentStatus
  message: string
}

export interface PaymentProvider {
  gateway: PaymentGateway
  initiate(req: PaymentRequest): Promise<PaymentResult>
  verify(reference: string): Promise<PaymentResult>
}

// ---------------------------------------------------------------------------
// Paystack Provider (the only payment provider for VoteWise)
// ---------------------------------------------------------------------------

class PaystackProvider implements PaymentProvider {
  gateway: PaymentGateway = 'PAYSTACK'

  async initiate(req: PaymentRequest): Promise<PaymentResult> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey || secretKey.length < 10) {
      return {
        success: false,
        reference: '',
        status: 'FAILED',
        message: 'Paystack is not configured. Set PAYSTACK_SECRET_KEY in the credential manager.',
      }
    }

    try {
      const reference = `VW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: req.email,
          amount: req.amount * 100, // Paystack expects kobo
          currency: req.currency || 'NGN',
          reference,
          metadata: {
            custom_fields: [
              { display_name: 'Organization', variable_name: 'organization', value: req.name },
              { display_name: 'Invoice ID', variable_name: 'invoice_id', value: req.invoiceId || '' },
              ...Object.entries(req.metadata || {}).map(([k, v]) => ({
                display_name: k,
                variable_name: k,
                value: String(v),
              })),
            ],
          },
        }),
      })

      const data = await response.json() as any
      if (data.status && data.data?.authorization_url) {
        return {
          success: true,
          reference: data.data.reference || reference,
          authorizationUrl: data.data.authorization_url,
          status: 'INITIATED',
          message: 'Payment initiated. Redirect to Paystack to complete.',
        }
      }

      return {
        success: false,
        reference,
        status: 'FAILED',
        message: data.message || 'Paystack initialization failed.',
      }
    } catch (e: any) {
      return { success: false, reference: '', status: 'FAILED', message: e.message }
    }
  }

  async verify(reference: string): Promise<PaymentResult> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey || secretKey.length < 10) {
      console.warn('[PAYSTACK] Verify REJECTED: PAYSTACK_SECRET_KEY not configured.')
      return {
        success: false,
        reference,
        status: 'FAILED',
        message: 'Payment verification is not available. Paystack is not configured.',
      }
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      const data = await response.json() as any

      if (data.status && data.data?.status === 'success') {
        return {
          success: true,
          reference,
          status: 'VERIFIED',
          message: 'Payment verified successfully.',
        }
      }

      return {
        success: false,
        reference,
        status: 'FAILED',
        message: `Paystack returned: ${data.data?.status || data.message || 'unknown'}`,
      }
    } catch (e: any) {
      return { success: false, reference, status: 'FAILED', message: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Registry — Paystack only
// ---------------------------------------------------------------------------

const paystackProvider = new PaystackProvider()

const providers = new Map<PaymentGateway, PaymentProvider>([
  ['PAYSTACK', paystackProvider],
])

export function getProvider(gateway: PaymentGateway): PaymentProvider | undefined {
  return providers.get(gateway)
}

export function registerProvider(gateway: PaymentGateway, provider: PaymentProvider): void {
  providers.set(gateway, provider)
}

export function getAvailableGateways(): PaymentGateway[] {
  return Array.from(providers.keys())
}

// ---------------------------------------------------------------------------
// Payment Operations
// ---------------------------------------------------------------------------

/**
 * Initiate a payment for an invoice via Paystack.
 */
export async function initiatePayment(opts: {
  invoiceId: string
  organizationId: string
  gateway: PaymentGateway
  email: string
  name: string
}): Promise<PaymentResult> {
  const invoice = await db.invoice.findUnique({ where: { id: opts.invoiceId } })
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status === 'PAID') throw new Error('Invoice already paid')

  const provider = getProvider(opts.gateway)
  if (!provider) throw new Error(`Gateway ${opts.gateway} not available. Only Paystack is supported.`)

  const result = await provider.initiate({
    amount: invoice.grandTotal - invoice.amountPaid,
    currency: invoice.currency,
    email: opts.email,
    name: opts.name,
    invoiceId: invoice.id,
    organizationId: opts.organizationId,
    metadata: { invoiceNumber: invoice.invoiceNumber },
  })

  if (result.success) {
    await db.payment.create({
      data: {
        paymentReference: result.reference,
        organizationId: opts.organizationId,
        invoiceId: invoice.id,
        amount: invoice.grandTotal - invoice.amountPaid,
        currency: invoice.currency,
        gateway: opts.gateway,
        status: 'INITIATED',
        customerEmail: opts.email,
        customerName: opts.name,
      },
    })
  }

  return result
}

/**
 * Verify a Paystack payment and activate the subscription if successful.
 */
export async function verifyPayment(reference: string, gateway: PaymentGateway): Promise<{
  verified: boolean
  message: string
  invoiceId?: string
}> {
  const payment = await db.payment.findUnique({ where: { paymentReference: reference } })
  if (!payment) return { verified: false, message: 'Payment not found' }

  const provider = getProvider(gateway)
  if (!provider) return { verified: false, message: 'Gateway not available. Only Paystack is supported.' }

  const result = await provider.verify(reference)

  if (result.success && result.status === 'VERIFIED') {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        gatewayResponse: result.message,
      },
    })

    if (payment.invoiceId) {
      const invoice = await db.invoice.findUnique({ where: { id: payment.invoiceId } })
      if (invoice) {
        const newAmountPaid = invoice.amountPaid + payment.amount
        const isFullyPaid = newAmountPaid >= invoice.grandTotal

        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
            amountPaid: newAmountPaid,
            paidAt: isFullyPaid ? new Date() : null,
            paymentMethod: gateway,
            paymentReference: reference,
          },
        })

        if (isFullyPaid) {
          await activateSubscription(invoice.organizationId)
        }

        return { verified: true, message: 'Payment verified and invoice marked as paid.', invoiceId: invoice.id }
      }
    }

    return { verified: true, message: 'Payment verified.' }
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { status: 'FAILED', failedAt: new Date(), failureReason: result.message },
  })

  return { verified: false, message: result.message }
}

/**
 * Activate the organization's subscription after payment.
 */
async function activateSubscription(organizationId: string): Promise<void> {
  const sub = await db.organizationSubscription.findUnique({ where: { organizationId } })
  if (sub) {
    await db.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })
  } else {
    await db.organizationSubscription.create({
      data: {
        organizationId,
        plan: 'PAYG',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })
  }
}

/**
 * Get payment history for an organization.
 */
export async function getPaymentHistory(organizationId: string) {
  const payments = await db.payment.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return payments.map((p) => ({
    ...p,
    initiatedAt: p.initiatedAt.toISOString(),
    verifiedAt: p.verifiedAt?.toISOString() || null,
    failedAt: p.failedAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
  }))
}
