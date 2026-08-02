// VoteWise — Chapter 12 Provider Abstraction
//
// Provider-agnostic delivery system. Each channel (EMAIL, SMS, WhatsApp,
// In-App) has a provider that implements the DeliveryProvider interface.
// New providers can be added without modifying existing code.
//
// In sandbox, all providers are no-ops (log to console).
// In production, these dispatch to Resend (email), Termii (SMS/WhatsApp), etc.

import type { Channel, MessageStatus } from './types'

export interface DeliveryRequest {
  to: string
  subject?: string
  body: string
  metadata?: Record<string, any>
}

export interface DeliveryResult {
  success: boolean
  status: MessageStatus
  externalId?: string
  error?: string
}

export interface DeliveryProvider {
  channel: Channel
  send(req: DeliveryRequest): Promise<DeliveryResult>
}

// ---------------------------------------------------------------------------
// Email Provider (Resend in production, console.log in sandbox)
// ---------------------------------------------------------------------------

class EmailProvider implements DeliveryProvider {
  channel: Channel = 'EMAIL'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      // In production: use Resend or SendGrid
      // const { Resend } = await import('resend')
      // const resend = new Resend(process.env.RESEND_API_KEY)
      // const result = await resend.emails.send({ from: ..., to: req.to, subject: req.subject, html: req.body })

      console.log(`[EMAIL] To: ${req.to} | Subject: ${req.subject || '(no subject)'}`)
      return { success: true, status: 'DELIVERED', externalId: `email_${Date.now()}` }
    } catch (e: any) {
      return { success: false, status: 'FAILED', error: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// SMS Provider (Termii in production)
// ---------------------------------------------------------------------------

class SmsProvider implements DeliveryProvider {
  channel: Channel = 'SMS'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      // In production: use Termii or Twilio
      console.log(`[SMS] To: ${req.to} | Body: ${req.body.slice(0, 50)}...`)
      return { success: true, status: 'DELIVERED', externalId: `sms_${Date.now()}` }
    } catch (e: any) {
      return { success: false, status: 'FAILED', error: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// WhatsApp Provider (Termii/WhatsApp Business API in production)
// ---------------------------------------------------------------------------

class WhatsAppProvider implements DeliveryProvider {
  channel: Channel = 'WHATSAPP'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      console.log(`[WHATSAPP] To: ${req.to} | Body: ${req.body.slice(0, 50)}...`)
      return { success: true, status: 'DELIVERED', externalId: `wa_${Date.now()}` }
    } catch (e: any) {
      return { success: false, status: 'FAILED', error: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// In-App Provider (creates a Notification record)
// ---------------------------------------------------------------------------

class InAppProvider implements DeliveryProvider {
  channel: Channel = 'IN_APP'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      // In-app notifications are stored in the Notification table
      // The actual create is handled by the communication engine
      console.log(`[IN_APP] To: ${req.to} | Subject: ${req.subject || '(notification)'}`)
      return { success: true, status: 'DELIVERED', externalId: `inapp_${Date.now()}` }
    } catch (e: any) {
      return { success: false, status: 'FAILED', error: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const providers = new Map<Channel, DeliveryProvider>([
  ['EMAIL', new EmailProvider()],
  ['SMS', new SmsProvider()],
  ['WHATSAPP', new WhatsAppProvider()],
  ['IN_APP', new InAppProvider()],
])

/**
 * Get the provider for a channel.
 */
export function getProvider(channel: Channel): DeliveryProvider | undefined {
  return providers.get(channel)
}

/**
 * Register a new provider (for extensibility — future channels like
 * Telegram, Slack, Push, Voice can be added without modifying existing code).
 */
export function registerProvider(channel: Channel, provider: DeliveryProvider): void {
  providers.set(channel, provider)
}

/**
 * Get all registered channels.
 */
export function getRegisteredChannels(): Channel[] {
  return Array.from(providers.keys())
}
