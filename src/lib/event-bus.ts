// VoteWise — Event Bus (Enterprise Audit Part 4)
//
// Spec: "This requires an event system. User Action → Event Bus → Subscribers
// → Dashboards Update. Example: VOTER_OTVP_VERIFIED → Admin Dashboard,
// Analytics, Fraud Engine, Audit Logger."
//
// A lightweight in-process event bus for real-time event-driven architecture.
// In production, this would be backed by Redis Pub/Sub or a message queue
// (RabbitMQ, SQS). The interface is identical so call sites don't change.

import { logger } from '@/lib/infra/logger'

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type ElectionEventType =
  // Voter events
  | 'VOTER_PORTAL_VISIT'
  | 'VOTER_LOGIN'
  | 'VOTER_LOGOUT'
  | 'VOTER_VERIFY_MATRIC'
  | 'VOTER_OTP_REQUESTED'
  | 'VOTER_OTP_SENT'
  | 'VOTER_OTP_VERIFIED'
  | 'VOTER_OTP_FAILED'
  | 'VOTER_ACCREDITED'
  | 'VOTER_VOTING_STARTED'
  | 'VOTE_CAST'
  | 'VOTE_RECORDED'
  | 'VOTER_SESSION_EXPIRED'
  // Election events
  | 'ELECTION_CREATED'
  | 'ELECTION_UPDATED'
  | 'ELECTION_STATE_CHANGED'
  | 'ELECTION_GO_LIVE'
  | 'ELECTION_PAUSED'
  | 'ELECTION_RESUMED'
  | 'ELECTION_ENDED'
  | 'ELECTION_CERTIFIED'
  | 'ELECTION_ARCHIVED'
  // Candidate events
  | 'CANDIDATE_NOMINATED'
  | 'CANDIDATE_SCREENED'
  | 'CANDIDATE_APPROVED'
  | 'CANDIDATE_DISQUALIFIED'
  | 'CANDIDATE_WITHDRAWN'
  // Fraud events
  | 'FRAUD_DETECTED'
  | 'FRAUD_INCIDENT_RAISED'
  | 'FRAUD_INCIDENT_RESOLVED'
  | 'ELECTION_LOCK_TRIGGERED'
  // Support events
  | 'SUPPORT_CONVERSATION_CREATED'
  | 'SUPPORT_MESSAGE_SENT'
  | 'SUPPORT_CONVERSATION_ASSIGNED'
  | 'SUPPORT_CONVERSATION_ESCALATED'
  | 'SUPPORT_CONVERSATION_RESOLVED'
  // Admin events
  | 'ADMIN_OTP_RESEND'
  | 'ADMIN_SESSION_UNLOCK'
  | 'ADMIN_VOTER_FLAG'
  // System events
  | 'SYSTEM_BACKUP_COMPLETED'
  | 'SYSTEM_DEPLOYMENT'
  | 'SYSTEM_ALERT'

export interface ElectionEvent {
  type: ElectionEventType | string
  organizationId?: string
  electionId?: string
  voterId?: string
  actorId?: string
  actorName?: string
  ipAddress?: string
  data?: Record<string, any>
  timestamp: string
}

// ---------------------------------------------------------------------------
// Event bus implementation
// ---------------------------------------------------------------------------

type EventHandler = (event: ElectionEvent) => void | Promise<void>

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>()
  private wildcardHandlers = new Set<EventHandler>()
  private history: ElectionEvent[] = []
  private maxHistory = 1000

  /**
   * Subscribe to a specific event type.
   */
  on(eventType: ElectionEventType | string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
    // Return unsubscribe function
    return () => this.off(eventType, handler)
  }

  /**
   * Subscribe to ALL events (wildcard).
   */
  onAll(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler)
    return () => this.wildcardHandlers.delete(handler)
  }

  /**
   * Unsubscribe from a specific event type.
   */
  off(eventType: ElectionEventType | string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler)
  }

  /**
   * Emit an event. All subscribers are notified asynchronously.
   */
  async emit(event: Omit<ElectionEvent, 'timestamp'>): Promise<void> {
    const fullEvent: ElectionEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    }

    // Store in history (for debugging + replay)
    this.history.push(fullEvent)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    // Notify specific subscribers
    const specificHandlers = this.handlers.get(event.type)
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          await handler(fullEvent)
        } catch (e: any) {
          logger.error(`[event-bus] handler error for ${event.type}: ${e.message}`, {
            category: 'infrastructure',
            service: 'app',
          })
        }
      }
    }

    // Notify wildcard subscribers
    for (const handler of this.wildcardHandlers) {
      try {
        await handler(fullEvent)
      } catch (e: any) {
        logger.error(`[event-bus] wildcard handler error: ${e.message}`, {
          category: 'infrastructure',
          service: 'app',
        })
      }
    }
  }

  /**
   * Get recent events from history (for debugging + replay).
   */
  getHistory(limit: number = 50, filter?: { type?: string; organizationId?: string }): ElectionEvent[] {
    let events = [...this.history].reverse()
    if (filter?.type) events = events.filter((e) => e.type === filter.type)
    if (filter?.organizationId) events = events.filter((e) => e.organizationId === filter.organizationId)
    return events.slice(0, limit)
  }

  /**
   * Clear history (for testing).
   */
  clearHistory(): void {
    this.history = []
  }
}

// Singleton instance
export const eventBus = new EventBus()

// ---------------------------------------------------------------------------
// Default subscribers — wired on module load
// ---------------------------------------------------------------------------

// 1. Audit logger — logs every event to the audit trail
eventBus.onAll(async (event) => {
  // Only log significant events (not every portal visit)
  const significantEvents = [
    'VOTE_CAST', 'VOTE_RECORDED', 'VOTER_OTP_VERIFIED', 'VOTER_OTP_FAILED',
    'ELECTION_GO_LIVE', 'ELECTION_PAUSED', 'ELECTION_CERTIFIED',
    'FRAUD_DETECTED', 'FRAUD_INCIDENT_RAISED', 'ELECTION_LOCK_TRIGGERED',
    'ADMIN_OTP_RESEND', 'SUPPORT_CONVERSATION_ESCALATED',
  ]
  if (significantEvents.includes(event.type)) {
    logger.audit(`Event: ${event.type}`, {
      category: 'audit',
      metadata: {
        type: event.type,
        organizationId: event.organizationId,
        electionId: event.electionId,
        actorId: event.actorId,
      },
    })
  }
})

// 2. Webhook trigger — emits to registered webhooks (integrates with AIDP)
eventBus.onAll(async (event) => {
  // The AIDP webhook engine subscribes to these events and delivers to
  // registered webhook endpoints. This is handled in src/lib/aidp/webhook-engine.ts
  // via triggerWebhookEvent(). We don't call it here to avoid circular imports —
  // the webhook engine polls the event history instead.
})

// ---------------------------------------------------------------------------
// Convenience helper — emit + log in one call
// ---------------------------------------------------------------------------

export async function emitEvent(
  type: ElectionEventType | string,
  payload: Omit<ElectionEvent, 'type' | 'timestamp'>,
): Promise<void> {
  await eventBus.emit({ type, ...payload })
}
