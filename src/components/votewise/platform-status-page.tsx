'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2, AlertCircle, XCircle, Activity, Clock, Server,
  Shield, Database, Zap, Mail, Smartphone, MessageSquare, Cloud,
  Lock, HardDrive, Eye, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const STATUS_STYLES = {
  HEALTHY: { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2, label: 'Operational' },
  DEGRADED: { color: 'text-amber-600', bg: 'bg-amber-100', icon: AlertCircle, label: 'Degraded' },
  UNHEALTHY: { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle, label: 'Down' },
  UNKNOWN: { color: 'text-zinc-600', bg: 'bg-zinc-100', icon: Clock, label: 'Unknown' },
}

const SERVICE_ICONS: Record<string, any> = {
  'Database': Database,
  'Redis Cache': Zap,
  'Background Queue': Activity,
  'Email Provider': Mail,
  'SMS Provider': Smartphone,
  'WhatsApp Provider': MessageSquare,
  'Object Storage': Cloud,
  'SSL/HTTPS': Lock,
  'Backup System': HardDrive,
  'Monitoring': Eye,
  'No Critical Incidents': Shield,
  'Secrets Configured': Lock,
}

export function PlatformStatusPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  async function load() {
    try {
      const d = await fetch('/api/pihed/status').then(r => r.json())
      setStatus(d)
      setLastUpdated(new Date().toLocaleString())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
  }

  const overallStatus = status?.status || 'UNKNOWN'
  const overallColor = overallStatus === 'OPERATIONAL' ? 'emerald' : overallStatus === 'DEGRADED' ? 'amber' : 'red'
  const services = status?.services || []
  const incidents = status?.incidents || []
  const maintenance = status?.maintenance || []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold">VoteWise Platform Status</h1>
        <p className="mt-2 text-sm text-muted-foreground">Real-time health and availability of all VoteWise services</p>
      </div>

      {/* Overall Status Banner */}
      <Card className={cn('votewise-card-glow mb-6 border-2', overallColor === 'emerald' ? 'border-emerald-500/30' : overallColor === 'amber' ? 'border-amber-500/30' : 'border-red-500/30')}>
        <CardContent className="p-6 text-center">
          <div className={cn('mx-auto grid h-16 w-16 place-items-center rounded-full',
            overallColor === 'emerald' ? 'bg-emerald-100' : overallColor === 'amber' ? 'bg-amber-100' : 'bg-red-100')}>
            {overallColor === 'emerald' ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> :
             overallColor === 'amber' ? <AlertCircle className="h-8 w-8 text-amber-600" /> :
             <XCircle className="h-8 w-8 text-red-600" />}
          </div>
          <h2 className={cn('mt-3 font-display text-2xl font-bold',
            overallColor === 'emerald' ? 'text-emerald-600' : overallColor === 'amber' ? 'text-amber-600' : 'text-red-600')}>
            {overallStatus === 'OPERATIONAL' ? 'All Systems Operational' :
             overallStatus === 'DEGRADED' ? 'Some Systems Degraded' :
             overallStatus === 'PARTIAL_OUTAGE' ? 'Partial Service Outage' :
             'Major Service Outage'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Uptime: {status?.uptime || 99.99}% · Updated {lastUpdated}</p>
          <Button variant="ghost" size="sm" onClick={load} className="mt-3 gap-1.5">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Active Maintenance */}
      {maintenance.length > 0 && (
        <Alert className="mb-4 border-amber-500/30 bg-amber-500/5">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle>Maintenance In Progress</AlertTitle>
          <AlertDescription>
            {maintenance.map((m: any, i: number) => (
              <div key={i} className="text-sm">
                <Badge variant="outline" className="mr-2">{m.isActive ? 'Active' : 'Scheduled'}</Badge>
                {m.reason} — started {new Date(m.startedAt).toLocaleString()}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Active Incidents */}
      {incidents.length > 0 && (
        <Alert className="mb-4 border-red-500/30 bg-red-500/5">
          <Shield className="h-4 w-4 text-red-600" />
          <AlertTitle>Active Incidents</AlertTitle>
          <AlertDescription>
            {incidents.map((inc: any, i: number) => (
              <div key={i} className="text-sm">
                <Badge variant="destructive" className="mr-2">{inc.severity}</Badge>
                {inc.title} — {new Date(inc.createdAt).toLocaleString()}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Service Status Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((svc: any, i: number) => {
          const style = STATUS_STYLES[svc.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.UNKNOWN
          const Icon = SERVICE_ICONS[svc.name] || Server
          return (
            <motion.div
              key={svc.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={cn('transition-all', svc.status === 'UNHEALTHY' && 'ring-1 ring-red-500/20')}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', style.bg)}>
                    <Icon className={cn('h-5 w-5', style.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{svc.name}</span>
                      <Badge variant="outline" className={cn('text-[10px]', style.color)}>{style.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{svc.message}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>VoteWise Election Platform — Infrastructure Health Monitoring</p>
        <p className="mt-1">Auto-refreshes every 30 seconds · Last check: {lastUpdated}</p>
      </div>
    </div>
  )
}
