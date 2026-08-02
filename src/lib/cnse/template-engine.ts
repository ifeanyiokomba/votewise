// VoteWise — Chapter 12 Template Engine
//
// Handles template rendering with {{variable}} substitution, multilingual
// support, and a built-in template library.

import { db } from '@/lib/cnse/safe-db'
import type { TemplateInput, TemplateCategory, Channel } from './types'

// Built-in templates — available to all organizations
const BUILTIN_TEMPLATES: Record<string, Omit<TemplateInput, 'organizationId'>> = {
  // Authentication
  'auth-otp-email': {
    name: 'OTP Email',
    category: 'AUTHENTICATION',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Your VoteWise Verification Code',
    body: 'Hello {{firstName}},\n\nYour verification code is: {{otp}}\n\nThis code expires in {{ttl}} minutes.\n\nIf you did not request this code, please ignore this email.\n\nVoteWise',
    variables: ['firstName', 'otp', 'ttl'],
  },
  'auth-otp-sms': {
    name: 'OTP SMS',
    category: 'AUTHENTICATION',
    channel: 'SMS',
    language: 'en',
    body: 'VoteWise: Your code is {{otp}}. Expires in {{ttl}} min. Do not share.',
    variables: ['otp', 'ttl'],
  },
  'auth-otp-whatsapp': {
    name: 'OTP WhatsApp',
    category: 'AUTHENTICATION',
    channel: 'WHATSAPP',
    language: 'en',
    body: 'Hello {{firstName}}! Your VoteWise verification code is: {{otp}}. It expires in {{ttl}} minutes.',
    variables: ['firstName', 'otp', 'ttl'],
  },
  // Election
  'election-starts-now': {
    name: 'Election Starts Now',
    category: 'ELECTION',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Voting is now open: {{electionName}}',
    body: 'Hello {{firstName}},\n\nVoting is now open for {{electionName}}.\n\nThe election closes on {{endTime}}.\n\nClick here to vote: {{voteLink}}\n\nVoteWise',
    variables: ['firstName', 'electionName', 'endTime', 'voteLink'],
  },
  'election-reminder': {
    name: 'Election Reminder',
    category: 'ELECTION',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Reminder: {{electionName}} starts in {{timeUntil}}',
    body: 'Hello {{firstName}},\n\nThis is a reminder that {{electionName}} starts in {{timeUntil}}.\n\nVoting opens: {{startTime}}\nVoting closes: {{endTime}}\n\nVoteWise',
    variables: ['firstName', 'electionName', 'timeUntil', 'startTime', 'endTime'],
  },
  'voting-closes-soon': {
    name: 'Voting Closes Soon',
    category: 'ELECTION',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Last chance to vote: {{electionName}}',
    body: 'Hello {{firstName}},\n\nVoting for {{electionName}} closes in {{timeRemaining}}.\n\nIf you haven\'t voted yet, please do so now: {{voteLink}}\n\nVoteWise',
    variables: ['firstName', 'electionName', 'timeRemaining', 'voteLink'],
  },
  // Results
  'results-published': {
    name: 'Results Published',
    category: 'RESULTS',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Results published: {{electionName}}',
    body: 'Hello {{firstName}},\n\nThe results for {{electionName}} have been published.\n\nView results: {{resultsLink}}\n\nThank you for participating.\n\nVoteWise',
    variables: ['firstName', 'electionName', 'resultsLink'],
  },
  // Support
  'support-ticket-created': {
    name: 'Support Ticket Created',
    category: 'SUPPORT',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Support ticket #{{ticketId}} created',
    body: 'Hello {{firstName}},\n\nYour support ticket has been created:\n\nSubject: {{ticketSubject}}\nTicket ID: {{ticketId}}\n\nWe will respond within 24 hours.\n\nVoteWise',
    variables: ['firstName', 'ticketId', 'ticketSubject'],
  },
  'support-ticket-updated': {
    name: 'Support Ticket Updated',
    category: 'SUPPORT',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Update on ticket #{{ticketId}}',
    body: 'Hello {{firstName}},\n\nThere is an update on your support ticket #{{ticketId}}.\n\nStatus: {{ticketStatus}}\n\nView ticket: {{ticketLink}}\n\nVoteWise',
    variables: ['firstName', 'ticketId', 'ticketStatus', 'ticketLink'],
  },
  // Security
  'security-incident': {
    name: 'Security Incident Alert',
    category: 'SECURITY',
    channel: 'EMAIL',
    language: 'en',
    subject: 'Security alert: {{incidentTitle}}',
    body: 'A security incident was detected:\n\nIncident: {{incidentTitle}}\nSeverity: {{severity}}\nRisk Score: {{riskScore}}\n\nDescription: {{description}}\n\nPlease review immediately.\n\nVoteWise Security',
    variables: ['incidentTitle', 'severity', 'riskScore', 'description'],
  },
}

/**
 * Render a template by substituting {{variables}} with values.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

/**
 * Get a template by ID, falling back to built-in templates.
 */
export async function getTemplate(templateId: string) {
  // Check DB first
  const template = await db.messageTemplate.findUnique({ where: { id: templateId } })
  if (template) return template

  // Check built-in
  const builtin = BUILTIN_TEMPLATES[templateId]
  if (builtin) {
    return {
      id: templateId,
      ...builtin,
      organizationId: null,
      isBuiltIn: true,
      isActive: true,
      variables: JSON.stringify(builtin.variables || []),
    }
  }

  return null
}

/**
 * Get a template by category + channel (+ optional language).
 * Checks org-specific first, then built-in.
 */
export async function findTemplate(opts: {
  organizationId?: string
  category: TemplateCategory
  channel: Channel
  language?: string
}) {
  const lang = opts.language || 'en'

  // Check org-specific
  if (opts.organizationId) {
    const orgTemplate = await db.messageTemplate.findFirst({
      where: {
        organizationId: opts.organizationId,
        category: opts.category,
        channel: opts.channel,
        language: lang,
        isActive: true,
      },
    })
    if (orgTemplate) return orgTemplate
  }

  // Check built-in (null org)
  const builtin = await db.messageTemplate.findFirst({
    where: {
      organizationId: null,
      category: opts.category,
      channel: opts.channel,
      language: lang,
      isActive: true,
    },
  })
  if (builtin) return builtin

  // Fall back to hardcoded built-in templates
  const builtinKey = Object.keys(BUILTIN_TEMPLATES).find((k) => {
    const t = BUILTIN_TEMPLATES[k]
    return t.category === opts.category && t.channel === opts.channel && t.language === lang
  })

  if (builtinKey) {
    return {
      id: builtinKey,
      ...BUILTIN_TEMPLATES[builtinKey],
      organizationId: null,
      isBuiltIn: true,
      isActive: true,
      variables: JSON.stringify(BUILTIN_TEMPLATES[builtinKey].variables || []),
    }
  }

  return null
}

/**
 * Seed built-in templates into the database.
 */
export async function seedBuiltinTemplates(): Promise<number> {
  let count = 0
  for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
    const existing = await db.messageTemplate.findFirst({
      where: { name: template.name, channel: template.channel, language: template.language, organizationId: null },
    })
    if (!existing) {
      await db.messageTemplate.create({
        data: {
          ...template,
          organizationId: null,
          isBuiltIn: true,
          isActive: true,
          variables: JSON.stringify(template.variables || []),
        },
      })
      count++
    }
  }
  return count
}

/**
 * List all templates for an organization (org-specific + built-in).
 */
export async function listTemplates(organizationId: string, category?: string, channel?: string) {
  const where: any = {
    OR: [{ organizationId }, { organizationId: null, isBuiltIn: true }],
    isActive: true,
  }
  if (category) where.category = category
  if (channel) where.channel = channel

  return db.messageTemplate.findMany({
    where,
    orderBy: [{ category: 'asc' }, { channel: 'asc' }, { language: 'asc' }],
  })
}
