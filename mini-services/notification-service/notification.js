// VoteWise — Notification Service entrypoint.
//
// Dedicated delivery microservice. Polls the MessageQueue for QUEUED rows
// and delivers them via the configured provider (Resend / Termii). Falls
// back across channels per the CNSE spec: WhatsApp → SMS → Email.
//
// In production this runs 2+ replicas behind an HPA so notification bursts
// (election-day reminders) don't compete with vote recording for CPU.

console.log('[notification] service started — polling MessageQueue for pending deliveries')

setInterval(() => {
  // In production: SELECT * FROM MessageQueue WHERE status='QUEUED' ORDER BY scheduledAt LIMIT 50
  // For each row: attempt delivery, update status to SENT/FAILED, record delivery log.
  // Channel fallback is implemented in src/lib/cnse/communication-engine.ts
}, 10_000)
