'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface BadgeData {
  ready: boolean
  criticalFailures: number
  warnings: number
  checks: Array<{ name: string; status: string; critical: boolean }>
  capacity?: {
    sufficient: boolean
    safeConcurrency: number
    replicas: number
  }
  timestamp: string
}

/**
 * Public Election Readiness Badge — an embeddable widget that shows
 * "Platform Readiness: ✓ Ready" on any page. No auth required.
 *
 * Org admins can place this on their election landing page to build
 * voter confidence that the infrastructure has passed its pre-flight check.
 */
export function ReadinessBadgeWidget({
  voters = 0,
  compact = false,
}: {
  voters?: number
  compact?: boolean
}) {
  const [data, setData] = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [, force] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pihed/readiness/badge${voters ? `?voters=${voters}` : ''}`).then((r) => r.json())
      setData(res)
    } catch {
      /* swallow — badge is non-critical */
    } finally {
      setLoading(false)
    }
  }, [voters])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  // 1s tick for "Xs ago"
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (loading && !data) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', compact && 'inline-flex')}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking platform readiness…
      </div>
    )
  }

  if (!data) return null

  const passedChecks = data.checks.filter((c) => c.status === 'HEALTHY').length
  const totalChecks = data.checks.length
  const lastUpdatedSec = data.timestamp
    ? Math.max(0, Math.floor((Date.now() - new Date(data.timestamp).getTime()) / 1000))
    : 0

  // Compact pill variant
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
          data.ready
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
        )}
      >
        {data.ready ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5" />
        )}
        Platform Readiness: {data.ready ? '✓ Ready' : '✗ Blocked'}
        <span className="text-muted-foreground">· {passedChecks}/{totalChecks}</span>
      </motion.div>
    )
  }

  // Full card variant
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className={cn(
        'votewise-card-glow border-2',
        data.ready
          ? 'border-emerald-500/30'
          : 'border-red-500/30',
      )}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-xl',
              data.ready
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-600 dark:text-red-400',
            )}>
              {data.ready ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold">Platform Readiness</h3>
                <Badge className={cn(
                  'gap-1 text-xs',
                  data.ready
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
                )}>
                  {data.ready ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" /> Blocked
                    </>
                  )}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {passedChecks}/{totalChecks} pre-flight checks passed
                {data.criticalFailures > 0 && (
                  <span className="text-red-600 dark:text-red-400"> · {data.criticalFailures} critical failure(s)</span>
                )}
                {data.capacity && (
                  <span className={cn(
                    'ml-1',
                    data.capacity.sufficient
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400',
                  )}>
                    {' '}· Capacity: {data.capacity.sufficient ? '✓' : '✗'} {data.capacity.replicas} replicas
                  </span>
                )}
              </p>
            </div>
            <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
              <Shield className="ml-auto h-3 w-3 opacity-50" />
              Updated {lastUpdatedSec}s ago
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
