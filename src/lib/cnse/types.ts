// VoteWise — Chapter 12 CNSE Types

export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP'
export type MessagePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type MessageStatus = 'QUEUED' | 'SENDING' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'FAILED' | 'RETRYING'
export type TemplateCategory = 'AUTHENTICATION' | 'ELECTION' | 'RESULTS' | 'SUPPORT' | 'BILLING' | 'SECURITY' | 'SYSTEM' | 'MARKETING'

export interface SendMessageInput {
  organizationId?: string
  electionId?: string
  recipientId?: string
  recipientName?: string
  recipientAddress?: string
  channel: Channel
  fallbackChannels?: Channel[]
  category: TemplateCategory
  priority?: MessagePriority
  subject?: string
  body: string
  templateId?: string
  scheduledAt?: Date
  metadata?: Record<string, any>
}

export interface TemplateInput {
  organizationId?: string
  name: string
  category: TemplateCategory
  channel: Channel
  language?: string
  subject?: string
  body: string
  variables?: string[]
}

export interface DeliveryStats {
  total: number
  queued: number
  delivered: number
  opened: number
  clicked: number
  failed: number
  deliveryRate: number
  openRate: number
  clickRate: number
}

export interface CommunicationTimelineEntry {
  id: string
  type: 'MESSAGE' | 'NOTIFICATION' | 'TICKET' | 'ANNOUNCEMENT' | 'REMINDER' | 'EMERGENCY'
  channel?: string
  category?: string
  title: string
  description: string
  recipient?: string
  status?: string
  timestamp: string
}
