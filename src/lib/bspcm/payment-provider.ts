// VoteWise — Chapter 14 Payment Abstraction Layer
//
// Provider-agnostic payment system. Each gateway (Paystack, Flutterwave,
// Stripe) implements the PaymentProvider interface. New gateways can be
// added without modifying existing code.
//
// Payment flow:
//   Initiate → Gateway → Verify → Activate
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
  authorizationUrl?: string // gateway redirect URL
  status: PaymentStatus
  message: string
}

export interface PaymentProvider {
  gateway: PaymentGateway
  initiate(req: PaymentRequest): Promise<PaymentResult>
  verify(reference: string): Promise<PaymentResult>
}

// ---------------------------------------------------------------------------
// Paystack Provider (primary for Nigeria)
// ---------------------------------------------------------------------------

class PaystackProvider implements PaymentProvider {
  gateway: PaymentGateway = 'PAYSTACK'

  async initiate(req: PaymentRequest): Promise<PaymentResult> {
    try {
      // In production: call Paystack API
      // const response = await fetch('https://api.paystack.co/transaction/initialize', {
      //   method: 'POST',
      //   headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email: req.email, amount: req.amount * 100, currency: req.currency, reference, metadata }),
      // })

      const reference = `VW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      console.log(`[PAYSTACK] Initiate: ${reference} for ${req.amount} ${req.currency} (${req.email})`)

      return {
        success: true,
        reference,
        authorizationUrl: `https://checkout.paystack.com/${reference}`,
        status: 'INITIATED',
        message: 'Payment initiated. Redirect to authorization URL.',
      }
    } catch (e: any) {
      return { success: false, reference: '', status: 'FAILED', message: e.message }
    }
  }

  async verify(reference: string): Promise<PaymentResult> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey || secretKey.startsWith('sk_test_') === false && secretKey.length < 10) {
      // Billing is NOT configured with real credentials — reject all verifications.
      // This prevents the mock-verify vulnerability where any reference returns 'VERIFIED'.
      console.warn('[PAYSTACK] Verify REJECTED: PAYSTACK_SECRET_KEY not configured with real credentials.')
      return {
        success: false,
        reference,
        status: 'FAILED',
        message: 'Payment verification is not available. Billing is not configured.',
      }
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      const data = await response.json() as any
      if (data.status && data.data.status === 'success') {
        return { success: true, reference, status: 'VERIFIED', message: 'Payment verified successfully.' }
      }
      return { success: false, reference, status: 'FAILED', message: `Paystack returned: ${data.data?.status || 'unknown'}` }
    } catch (e: any) {
      return { success: false, reference, status: 'FAILED', message: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// Flutterwave Provider
// ---------------------------------------------------------------------------

class FlutterwaveProvider implements PaymentProvider {
  gateway: PaymentGateway = 'FLUTTERWAVE'

  async initiate(req: PaymentRequest): Promise<PaymentResult> {
    const reference = `VW-FLW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    console.log(`[FLUTTERWAVE] Initiate: ${reference} for ${req.amount} ${req.currency}`)
    return {
      success: true,
      reference,
      authorizationUrl: `https://checkout.flutterwave.com/v3/hosted/pay/${reference}`,
      status: 'INITIATED',
      message: 'Payment initiated via Flutterwave.',
    }
  }

  async verify(reference: string): Promise<PaymentResult> {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY
    if (!secretKey || secretKey.length < 10) {
      console.warn('[FLUTTERWAVE] Verify REJECTED: FLUTTERWAVE_SECRET_KEY not configured.')
      return { success: false, reference, status: 'FAILED', message: 'Payment verification is not available. Billing is not configured.' }
    }
    try {
      const response = await fetch(`https://api.flutterwave.com/v3/transactions/${reference}/verify`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      const data = await response.json() as any
      if (data.status === 'success' && data.data?.status === 'successful') {
        return { success: true, reference, status: 'VERIFIED', message: 'Payment verified.' }
      }
      return { success: false, reference, status: 'FAILED', message: `Flutterwave returned: ${data.data?.status || 'unknown'}` }
    } catch (e: any) {
      return { success: false, reference, status: 'FAILED', message: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// Stripe Provider (international)
// ---------------------------------------------------------------------------

class StripeProvider implements PaymentProvider {
  gateway: PaymentGateway = 'STRIPE'

  async initiate(req: PaymentRequest): Promise<PaymentResult> {
    const reference = `VW-STR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    console.log(`[STRIPE] Initiate: ${reference} for ${req.amount} ${req.currency}`)
    return {
      success: true,
      reference,
      authorizationUrl: `https://checkout.stripe.com/pay/${reference}`,
      status: 'INITIATED',
      message: 'Payment initiated via Stripe.',
    }
  }

  async verify(reference: string): Promise<PaymentResult> {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey || !secretKey.startsWith('sk_')) {
      console.warn('[STRIPE] Verify REJECTED: STRIPE_SECRET_KEY not configured.')
      return { success: false, reference, status: 'FAILED', message: 'Payment verification is not available. Billing is not configured.' }
    }
    try {
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      const data = await response.json() as any
      if (data.status === 'succeeded') {
        return { success: true, reference, status: 'VERIFIED', message: 'Payment verified.' }
      }
      return { success: false, reference, status: 'FAILED', message: `Stripe returned: ${data.status || 'unknown'}` }
    } catch (e: any) {
      return { success: false, reference, status: 'FAILED', message: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const providers = new Map<PaymentGateway, PaymentProvider>([
  ['PAYSTACK', new PaystackProvider()],
  ['FLUTTERWAVE', new FlutterwaveProvider()],
  ['STRIPE', new StripeProvider()],
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
 * Initiate a payment for an invoice.
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
  if (!provider) throw new Error(`Gateway ${opts.gateway} not available`)

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
    // Create payment record
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
 * Verify a payment and activate the subscription if successful.
 */
export async function verifyPayment(reference: string, gateway: PaymentGateway): Promise<{
  verified: boolean
  message: string
  invoiceId?: string
}> {
  const payment = await db.payment.findUnique({ where: { paymentReference: reference } })
  if (!payment) return { verified: false, message: 'Payment not found' }

  const provider = getProvider(gateway)
  if (!provider) return { verified: false, message: 'Gateway not available' }

  const result = await provider.verify(reference)

  if (result.success && result.status === 'VERIFIED') {
    // Update payment
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        gatewayResponse: result.message,
      },
    })

    // Update invoice
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

        // If fully paid, activate the subscription
        if (isFullyPaid) {
          await activateSubscription(invoice.organizationId)
        }

        return { verified: true, message: 'Payment verified and invoice marked as paid.', invoiceId: invoice.id }
      }
    }

    return { verified: true, message: 'Payment verified.' }
  }

  // Payment failed
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
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
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
