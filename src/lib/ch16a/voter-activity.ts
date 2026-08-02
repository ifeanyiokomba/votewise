// VoteWise — Chapter 16A: Voter Activity Timeline
//
// Spec: "Create a real-time voter activity timeline that records every step
// from portal access to vote completion without exposing ballot choices."
//
// Every voter action is logged to VoterActivityLog. This module provides
// query helpers for the per-voter timeline + the real-time election monitor.

import { db } from '@/lib/db'

export type VoterAction =
  | 'PORTAL_VISIT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'VERIFY_MATRIC'
  | 'ELIGIBILITY_CHECK'
  | 'SEND_OTP'
  | 'OTP_SENT_SMS'
  | 'OTP_SENT_EMAIL'
  | 'OTP_SENT_WHATSAPP'
  | 'VERIFY_OTP'
  | 'OTP_VERIFIED'
  | 'OTP_FAILED'
  | 'ACCREDIT'
  | 'VOTING_STARTED'
  | 'VOTE_CAST'
  | 'VOTE_RECORDED'
  | 'SESSION_EXPIRED'
  | 'SESSION_UNLOCKED'
  | 'OTP_RESEND_BY_ADMIN'
  | 'SUPPORT_MESSAGE'
  | 'FLAG'
  | 'UNFLAG'

export async function logVoterActivity(input: {
  voterId?: string
  actionById?: string
  action: VoterAction | string
  details?: Record<string, any>
  ipAddress?: string
  deviceLabel?: string
}) {
  return db.voterActivityLog.create({
    data: {
      voterId: input.voterId || null,
      actionById: input.actionById || null,
      action: input.action,
      details: input.details ? JSON.stringify(input.details) : null,
      ipAddress: input.ipAddress || null,
      deviceLabel: input.deviceLabel || null,
    },
  }).catch(() => null)
}

// ---------------------------------------------------------------------------
// Per-voter timeline
// ---------------------------------------------------------------------------

export async function getVoterTimeline(voterId: string, limit = 50) {
  const logs = await db.voterActivityLog.findMany({
    where: { voterId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Enrich with human-readable labels
  return logs.reverse().map((l) => ({
    ...l,
    label: ACTION_LABELS[l.action] || l.action,
    icon: ACTION_ICONS[l.action] || 'Activity',
    details: l.details ? JSON.parse(l.details) : null,
  }))
}

// ---------------------------------------------------------------------------
// Real-time election monitor
// ---------------------------------------------------------------------------

export async function getElectionMonitor(organizationId: string, electionId?: string) {
  const since = new Date(Date.now() - 30 * 60 * 1000) // last 30 min

  const [
    portalVisits,
    logins,
    otpSent,
    otpVerified,
    otpFailed,
    votingStarted,
    votesRecorded,
    sessionExpired,
    recentActivity,
  ] = await Promise.all([
    db.voterActivityLog.count({ where: { action: 'PORTAL_VISIT', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: 'LOGIN', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: { in: ['SEND_OTP', 'OTP_SENT_SMS', 'OTP_SENT_EMAIL', 'OTP_SENT_WHATSAPP'] }, createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: 'OTP_VERIFIED', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: 'OTP_FAILED', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: 'VOTING_STARTED', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: 'VOTE_RECORDED', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.count({ where: { action: 'SESSION_EXPIRED', createdAt: { gte: since } } }).catch(() => 0),
    db.voterActivityLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, voterId: true, action: true, ipAddress: true, deviceLabel: true, createdAt: true },
    }).catch(() => []),
  ])

  return {
    last30Min: {
      portalVisits,
      logins,
      otpSent,
      otpVerified,
      otpFailed,
      votingStarted,
      votesRecorded,
      sessionExpired,
    },
    recentActivity: recentActivity.map((a) => ({
      ...a,
      label: ACTION_LABELS[a.action] || a.action,
    })),
  }
}

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  PORTAL_VISIT: 'Visited Portal',
  LOGIN: 'Logged In',
  LOGOUT: 'Logged Out',
  VERIFY_MATRIC: 'Identity Verified',
  ELIGIBILITY_CHECK: 'Eligibility Checked',
  SEND_OTP: 'OTVP Generated',
  OTP_SENT_SMS: 'SMS Sent',
  OTP_SENT_EMAIL: 'Email Sent',
  OTP_SENT_WHATSAPP: 'WhatsApp Sent',
  VERIFY_OTP: 'OTVP Verification Attempted',
  OTP_VERIFIED: 'OTVP Verified',
  OTP_FAILED: 'OTVP Verification Failed',
  ACCREDIT: 'Accredited',
  VOTING_STARTED: 'Voting Started',
  VOTE_CAST: 'Vote Cast',
  VOTE_RECORDED: 'Vote Successfully Recorded',
  SESSION_EXPIRED: 'Session Expired',
  SESSION_UNLOCKED: 'Session Unlocked',
  OTP_RESEND_BY_ADMIN: 'OTVP Resent by Admin',
  SUPPORT_MESSAGE: 'Support Message Sent',
  FLAG: 'Flagged',
  UNFLAG: 'Unflagged',
}

const ACTION_ICONS: Record<string, string> = {
  PORTAL_VISIT: 'Globe',
  LOGIN: 'LogIn',
  LOGOUT: 'LogOut',
  VERIFY_MATRIC: 'BadgeCheck',
  SEND_OTP: 'Key',
  OTP_SENT_SMS: 'MessageSquare',
  OTP_SENT_EMAIL: 'Mail',
  OTP_SENT_WHATSAPP: 'MessageCircle',
  OTP_VERIFIED: 'ShieldCheck',
  OTP_FAILED: 'XCircle',
  VOTE_RECORDED: 'CheckCircle2',
  SESSION_EXPIRED: 'Clock',
  VOTING_STARTED: 'Vote',
}
