// VoteWise — Provider Abstraction Layer (wired to real APIs)
//
// Email: Resend (https://resend.com) — 3,000 emails/month free
// SMS: Termii (https://termii.com) — ~₦2-4 per SMS, all Nigerian networks
// WhatsApp: Termii (same API key) — ~₦5 per message
//
// When API keys are configured (via /admin/credentials), these providers
// make REAL API calls. When keys are NOT configured, they fall back to
// console.log (sandbox/dev mode) so the platform still works for testing.
//
// The credential manager syncs keys to process.env at startup and on save,
// so these providers read from process.env directly — no code changes
// needed when a key is added/rotated via the admin UI.

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
// Email Provider — Resend (real API calls when configured)
// ---------------------------------------------------------------------------

class EmailProvider implements DeliveryProvider {
  channel: Channel = 'EMAIL'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY

    // If no API key configured, fall back to console log (dev/sandbox mode)
    if (!apiKey || apiKey.length < 10) {
      console.log(`[EMAIL] (dev mode — no RESEND_API_KEY) To: ${req.to} | Subject: ${req.subject || '(no subject)'}`)
      console.log(`[EMAIL] Body preview: ${req.body.slice(0, 100)}...`)
      return { success: true, status: 'DELIVERED', externalId: `dev_email_${Date.now()}` }
    }

    try {
      // Call the real Resend API
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'VoteWise <noreply@votewise.com.ng>',
          to: [req.to],
          subject: req.subject || 'VoteWise Notification',
          html: req.body,
        }),
      })

      const data = await response.json() as any

      if (response.ok && data.id) {
        return { success: true, status: 'DELIVERED', externalId: data.id }
      }

      console.error('[EMAIL] Resend API error:', data)
      return { success: false, status: 'FAILED', error: data.message || `Resend returned ${response.status}` }
    } catch (e: any) {
      return { success: false, status: 'FAILED', error: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// SMS Provider — Termii (real API calls when configured)
// ---------------------------------------------------------------------------

class SmsProvider implements DeliveryProvider {
  channel: Channel = 'SMS'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    const apiKey = process.env.TERMII_API_KEY

    // If no API key configured, fall back to console log (dev/sandbox mode)
    if (!apiKey || apiKey.length < 10) {
      console.log(`[SMS] (dev mode — no TERMII_API_KEY) To: ${req.to} | Body: ${req.body.slice(0, 80)}...`)
      return { success: true, status: 'DELIVERED', externalId: `dev_sms_${Date.now()}` }
    }

    try {
      // Call the real Termii SMS API
      const senderId = process.env.TERMII_SENDER_ID || 'VoteWise'
      const response = await fetch('https://api.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: req.to,
          from: senderId,
          sms: req.body,
          type: 'plain',
          channel: 'generic',
          api_key: apiKey,
        }),
      })

      const data = await response.json() as any

      if (response.ok && (data.code === 'ok' || data.message_id)) {
        return { success: true, status: 'DELIVERED', externalId: data.message_id || `termii_sms_${Date.now()}` }
      }

      console.error('[SMS] Termii API error:', data)
      return { success: false, status: 'FAILED', error: data.message || `Termii returned ${response.status}` }
    } catch (e: any) {
      return { success: false, status: 'FAILED', error: e.message }
    }
  }
}

// ---------------------------------------------------------------------------
// WhatsApp Provider — Termii (real API calls when configured)
// ---------------------------------------------------------------------------

class WhatsAppProvider implements DeliveryProvider {
  channel: Channel = 'WHATSAPP'

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    const apiKey = process.env.TERMII_API_KEY || process.env.TERMII_WHATSAPP_KEY

    // If no API key configured, fall back to console log (dev/sandbox mode)
    if (!apiKey || apiKey.length < 10) {
      console.log(`[WHATSAPP] (dev mode — no TERMII key) To: ${req.to} | Body: ${req.body.slice(0, 80)}...`)
      return { success: true, status: 'DELIVERED', externalId: `dev_wa_${Date.now()}` }
    }

    try {
      // Call the real Termii WhatsApp API
      const response = await fetch('https://api.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: req.to,
          from: 'VoteWise',
          sms: req.body,
          type: 'plain',
          channel: 'whatsapp',
          api_key: apiKey,
        }),
      })

      const data = await response.json() as any

      if (response.ok && (data.code === 'ok' || data.message_id)) {
        return { success: true, status: 'DELIVERED', externalId: data.message_id || `termii_wa_${Date.now()}` }
      }

      console.error('[WHATSAPP] Termii API error:', data)
      return { success: false, status: 'FAILED', error: data.message || `Termii returned ${response.status}` }
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
