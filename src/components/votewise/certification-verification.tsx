'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck, ShieldX, Loader2, CheckCircle2, XCircle, Award,
  FileCheck, Users, BarChart3, Lock, Download, ArrowLeft, Copy, Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface Seal {
  certificationId: string
  electionId: string
  electionName: string
  organizationName: string | null
  status: string
  integrityScore: number
  votesVerified: number
  auditLogsComplete: boolean
  observerReportsComplete: boolean
  securityIncidents: string
  certifiedBy: string
  certifiedAt: string
  signatureValid: boolean
  revokedAt: string | null
  revokeReason: string | null
}

export function CertificationVerification({ certificationId }: { certificationId: string }) {
  const [seal, setSeal] = useState<Seal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.tqasgrVerifyCertification(certificationId)
      .then((d: any) => {
        if (d.error) {
          setNotFound(true)
        } else {
          setSeal(d.seal)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [certificationId])

  function copyId() {
    navigator.clipboard.writeText(certificationId)
    setCopied(true)
    toast.success('Certification ID copied')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-500/15">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="font-display text-2xl font-bold">Certification Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No certification exists with ID <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{certificationId}</code>.
            Please check the ID and try again.
          </p>
          <Link href="/">
            <Button variant="outline" className="mt-6 gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to VoteWise
            </Button>
          </Link>
        </motion.div>
      </div>
    )
  }

  if (!seal) return null

  const isRevoked = seal.status === 'REVOKED'
  const isCertified = seal.status === 'CERTIFIED' && seal.signatureValid

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Back link */}
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to VoteWise
        </Link>

        {/* Main certificate card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className={cn(
            'votewise-card-glow overflow-hidden border-2',
            isCertified ? 'border-emerald-500/30' : 'border-red-500/30',
          )}>
            {/* Header band */}
            <div className={cn(
              'flex items-center justify-between px-6 py-4',
              isCertified
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white'
                : 'bg-gradient-to-r from-red-600 to-red-700 text-white',
            )}>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                <span className="font-display text-sm font-bold uppercase tracking-wider">VoteWise Certification</span>
              </div>
              {isCertified ? (
                <Badge className="bg-white/20 text-white">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                </Badge>
              ) : (
                <Badge className="bg-white/20 text-white">
                  <XCircle className="mr-1 h-3 w-3" /> Revoked
                </Badge>
              )}
            </div>

            <CardContent className="p-6 sm:p-8">
              {/* Status icon + title */}
              <div className="mb-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className={cn(
                    'mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full',
                    isCertified ? 'bg-emerald-500/15' : 'bg-red-500/15',
                  )}
                >
                  {isCertified ? (
                    <ShieldCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldX className="h-10 w-10 text-red-600 dark:text-red-400" />
                  )}
                </motion.div>
                <h1 className="font-display text-2xl font-bold">
                  {isCertified ? 'Election Certified' : 'Certification Revoked'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isCertified
                    ? 'This election has been independently verified by the VoteWise platform.'
                    : 'This certification has been revoked.'}
                </p>
              </div>

              {/* Certification ID */}
              <div className="mb-6 flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Certification ID</div>
                  <div className="font-mono text-sm font-semibold">{seal.certificationId}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={copyId} className="gap-1.5 text-xs">
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {/* Election details */}
              <div className="mb-6 space-y-3">
                <DetailRow icon={Users} label="Organization" value={seal.organizationName || '—'} />
                <DetailRow icon={FileCheck} label="Election" value={seal.electionName} />
                <DetailRow icon={Award} label="Certified By" value={seal.certifiedBy} />
                <DetailRow
                  icon={CheckCircle2}
                  label="Certified At"
                  value={new Date(seal.certifiedAt).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}
                />
              </div>

              {/* Integrity metrics */}
              <div className="mb-6 grid grid-cols-2 gap-3">
                <MetricCard
                  icon={BarChart3}
                  label="Integrity Score"
                  value={`${seal.integrityScore.toFixed(2)}%`}
                  color="emerald"
                />
                <MetricCard
                  icon={Users}
                  label="Votes Verified"
                  value={seal.votesVerified.toLocaleString()}
                  color="emerald"
                />
              </div>

              {/* Verification checks */}
              <div className="mb-6 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification Checks</div>
                <CheckRow label="Audit logs complete" passed={seal.auditLogsComplete} />
                <CheckRow label="Observer reports complete" passed={seal.observerReportsComplete} />
                <CheckRow label="Security incidents" passed={seal.securityIncidents === 'None Critical'} value={seal.securityIncidents} />
                <CheckRow label="Digital signature valid" passed={seal.signatureValid} />
              </div>

              {/* Revocation notice */}
              {isRevoked && seal.revokeReason && (
                <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Revocation Reason</div>
                  <p className="mt-1 text-sm text-foreground">{seal.revokeReason}</p>
                  {seal.revokedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revoked on {new Date(seal.revokedAt).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Signed with HMAC-SHA256
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Download className="h-3 w-3" /> Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Verification info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center text-xs text-muted-foreground"
        >
          <p>
            This certification can be verified at any time by visiting{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">votewise.com.ng/certify/{seal.certificationId}</code>
          </p>
          <p className="mt-1">VoteWise — Africa's Most Trusted Election Management Platform</p>
        </motion.div>
      </div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-right text-sm font-medium">{value}</div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className={cn(
      'rounded-lg border p-4 text-center',
      color === 'emerald' && 'border-emerald-500/20 bg-emerald-500/5',
    )}>
      <Icon className="mx-auto mb-1 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

function CheckRow({ label, passed, value }: { label: string; passed: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </div>
    </div>
  )
}
