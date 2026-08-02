'use client'

import { useEffect, useState } from 'react'
import {
  Mail, MessageSquare, Smartphone, Bell, CheckCircle2, Clock, AlertCircle,
  XCircle, Search, RefreshCw, TrendingUp, Users, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface Delivery {
  id: string
  channel: string
  status: string
  recipientAddress: string | null
  recipientName: string
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  errorCode: string | null
  errorMessage: string | null
  attempts: number
  createdAt: string
}

interface DeliveryStats {
  total: number
  pending: number
  sent: number
  delivered: number
  read: number
  failed: number
}

interface DeliveryStatsResponse {
  totalNotifications: number
  totalRecipients: number
  deliveryRate: number
  readRate: number
  failureRate: number
  byChannel: Record<string, { total: number; delivered: number; read: number; failed: number }>
  recentFailures: Array<{ id: string; channel: string; recipientAddress: string | null; errorCode: string | null; errorMessage: string | null; createdAt: string }>
}

const CHANNEL_ICONS: Record<string, any> = { EMAIL: Mail, SMS: Smartphone, WHATSAPP: MessageSquare, IN_APP: Bell }
const CHANNEL_COLORS: Record<string, string> = { EMAIL: 'bg-emerald-100 text-emerald-700', SMS: 'bg-amber-100 text-amber-700', WHATSAPP: 'bg-amber-100 text-amber-800', IN_APP: 'bg-zinc-100 text-zinc-700' }
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600',
  SENT: 'bg-emerald-100 text-emerald-600',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  READ: 'bg-emerald-600 text-white',
  FAILED: 'bg-red-100 text-red-700',
  BOUNCED: 'bg-red-100 text-red-800',
}

export function NotificationDeliveryTracker({ electionId, notificationId, subdomain, open, onClose }: {
  electionId: string
  notificationId: string
  subdomain?: string
  open: boolean
  onClose: () => void
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [stats, setStats] = useState<DeliveryStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  async function load() {
    setLoading(true)
    try {
      const d = await api.getNotificationDeliveries(electionId, notificationId, subdomain)
      setDeliveries(d.deliveries || [])
      setStats(d.stats || null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && notificationId) load()
  }, [open, notificationId, electionId, subdomain])

  const filtered = deliveries.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
    if (search && !d.recipientName.toLowerCase().includes(search.toLowerCase()) && !d.recipientAddress?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const deliveryRate = stats ? (stats.total > 0 ? Math.round(((stats.delivered + stats.read) / stats.total) * 100) : 0) : 0
  const readRate = stats ? (stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0) : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Delivery Tracking
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-5 gap-2">
              <StatBox label="Total" value={stats.total} icon={Users} color="text-foreground" />
              <StatBox label="Delivered" value={stats.delivered + stats.read} icon={CheckCircle2} color="text-emerald-600" />
              <StatBox label="Read" value={stats.read} icon={CheckCircle2} color="text-emerald-700" />
              <StatBox label="Pending" value={stats.pending + stats.sent} icon={Clock} color="text-amber-600" />
              <StatBox label="Failed" value={stats.failed} icon={XCircle} color="text-red-600" />
            </div>

            {/* Delivery funnel */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Delivery Funnel</span>
                  <span className="text-muted-foreground">{deliveryRate}% delivered · {readRate}% read</span>
                </div>
                <div className="space-y-1.5">
                  <FunnelBar label="Sent" value={stats.total} max={stats.total} color="bg-emerald-300" />
                  <FunnelBar label="Delivered" value={stats.delivered + stats.read} max={stats.total} color="bg-emerald-500" />
                  <FunnelBar label="Read" value={stats.read} max={stats.total} color="bg-emerald-700" />
                </div>
              </CardContent>
            </Card>

            {/* Channel breakdown */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries({ EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp', IN_APP: 'In-App' }).map(([ch, label]) => {
                const Icon = CHANNEL_ICONS[ch]
                const chStats = (stats as any) && (stats as any).byChannel ? (stats as any).byChannel[ch] : { total: 0, delivered: 0, read: 0, failed: 0 }
                return (
                  <Card key={ch} className="p-3 text-center">
                    <div className={cn('mx-auto grid h-8 w-8 place-items-center rounded-lg', CHANNEL_COLORS[ch])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-1 text-xs font-medium">{label}</div>
                    <div className="text-lg font-bold">{chStats?.total || 0}</div>
                    <div className="text-[10px] text-muted-foreground">{chStats?.delivered || 0} delivered</div>
                  </Card>
                )
              })}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search recipients..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
              <div className="flex gap-1 flex-wrap">
                {['ALL', 'PENDING', 'DELIVERED', 'READ', 'FAILED'].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={cn('rounded-md px-2 py-1 text-xs font-medium transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                    {s}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={load} className="ml-auto gap-1">
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
              </Button>
            </div>

            {/* Recipient list */}
            <div className="max-h-[300px] overflow-y-auto space-y-1.5 rounded-lg border border-border/60 p-2">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No deliveries found.</p>
              ) : (
                filtered.map((d, i) => {
                  const Icon = CHANNEL_ICONS[d.channel] || Bell
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-2 rounded-lg border border-border/40 p-2"
                    >
                      <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', CHANNEL_COLORS[d.channel] || 'bg-zinc-100')}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{d.recipientName}</span>
                          <span className="text-xs text-muted-foreground">{d.recipientAddress || '—'}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {d.sentAt ? `Sent ${new Date(d.sentAt).toLocaleString()}` : 'Not sent yet'}
                          {d.readAt && ` · Read ${new Date(d.readAt).toLocaleString()}`}
                          {d.errorMessage && ` · Error: ${d.errorMessage}`}
                        </div>
                      </div>
                      <Badge className={cn('text-[10px]', STATUS_COLORS[d.status] || 'bg-zinc-100 text-zinc-600')}>
                        {d.status}
                      </Badge>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No delivery data available.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="p-3 text-center">
      <Icon className={cn('mx-auto h-4 w-4', color)} />
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </Card>
  )
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs text-muted-foreground">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-xs font-medium tabular-nums">{value} ({Math.round(pct)}%)</span>
    </div>
  )
}

// Aggregate delivery stats card (for the notifications tab)
export function DeliveryStatsCard({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [stats, setStats] = useState<DeliveryStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const d = await api.getNotificationDeliveryStats(electionId, subdomain)
      setStats(d)
    } catch { /* ignore — may have no notifications yet */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [electionId, subdomain])

  if (loading) return <Card><CardContent className="py-4 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>
  if (!stats || stats.totalRecipients === 0) return null

  return (
    <Card className="votewise-card-glow">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Delivery Stats</h3>
          <Button variant="ghost" size="sm" onClick={load} className="gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Refresh</Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totalRecipients}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recipients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.deliveryRate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.readRate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Read</div>
          </div>
          <div className="text-center">
            <div className={cn('text-2xl font-bold', stats.failureRate > 0 ? 'text-red-600' : 'text-emerald-600')}>{stats.failureRate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Failed</div>
          </div>
        </div>
        {stats.recentFailures.length > 0 && (
          <Alert className="mt-3 border-red-500/30 bg-red-500/5">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-xs">
              {stats.recentFailures.length} recent failure{stats.recentFailures.length === 1 ? '' : 's'}. Check delivery details for error messages.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
