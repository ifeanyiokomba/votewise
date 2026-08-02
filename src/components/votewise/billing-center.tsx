'use client'

// =============================================================================
// VoteWise — BSPCM Billing Center
// Chapter 14 — Billing, Subscriptions, Payments & Commercial Management UI
// =============================================================================
// 4 tabs: Overview · Invoices · Quotes · Negotiations
// Palette: emerald / gold / amber / zinc / red ONLY — no indigo, no blue.
// All amounts formatted as ₦X,XXX,XXX (Nigerian Naira).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, LayoutDashboard, FileText, MessageSquare, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, Clock, XCircle, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wallet, Calendar, Zap, Plus, Send, ExternalLink, Banknote,
  ShieldCheck, Tag, Receipt, Building2, Users, Vote, Sparkles, ChevronRight,
  Hash, AlertTriangle, Info, Coins, Handshake, MessageCircle,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const CHART = {
  emerald: '#10b981',
  amber: '#f59e0b',
  gold: '#d4a017',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  red: '#ef4444',
}

// ---------------------------------------------------------------------------
// Types — mirror BSPCM backend
// ---------------------------------------------------------------------------

interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  items: QuoteItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discountAmount: number
  grandTotal: number
  amountPaid: number
  currency: string
  status: string
  dueDate: string
  paidAt: string | null
  sentAt: string | null
  paymentMethod?: string | null
  paymentReference?: string | null
  createdAt: string
}

interface Quote {
  id: string
  quoteNumber: string
  items: QuoteItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discountPercent: number
  discountAmount: number
  grandTotal: number
  currency: string
  validUntil: string
  status: string
  estimatedVoters?: number | null
  estimatedElections?: number | null
  requestedFeatures?: string | null
  createdAt: string
}

interface Payment {
  id: string
  paymentReference: string
  invoiceId?: string | null
  amount: number
  currency: string
  gateway: string
  status: string
  initiatedAt: string
  verifiedAt?: string | null
  failedAt?: string | null
  failureReason?: string | null
  customerEmail?: string | null
  customerName?: string | null
  createdAt: string
}

interface NegotiationThreadEntry {
  author: string
  message: string
  timestamp: string
  role: 'ORG' | 'ADMIN'
}

interface Negotiation {
  id: string
  organizationId: string
  organizationName?: string | null
  requestType: string
  message: string
  proposedAmount?: number | null
  currency: string
  voterCount?: number | null
  electionCount?: number | null
  orgType?: string | null
  status: string
  thread: NegotiationThreadEntry[]
  agreedAmount?: number | null
  assignedToName?: string | null
  resolvedByName?: string | null
  resolvedAt?: string | null
  createdAt: string
}

interface PricingPlan {
  id: string
  name: string
  displayName: string
  description?: string | null
  model: string
  basePrice: number
  perVoterPrice: number
  perElectionPrice: number
  currency: string
  features: string[]
  maxVoters: number
  maxElections: number
  maxObservers: number
  sortOrder: number
}

interface WorkspaceMeta {
  organization: {
    name: string
    subdomain: string
    plan?: string
    status?: string
    voterQuota?: number
    category?: string
    paidUntil?: string | null
  }
  stats?: any
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNaira(amount: number): string {
  return '₦' + Math.round(amount || 0).toLocaleString('en-NG')
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-NG')
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'short', day: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-NG', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ---------------------------------------------------------------------------
// Status style maps (emerald / gold / amber / zinc / red only — NO blue)
// ---------------------------------------------------------------------------

const INVOICE_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  DRAFT: { label: 'Draft', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300', icon: FileText },
  SENT: { label: 'Sent', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Send },
  PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  PARTIALLY_PAID: { label: 'Partial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Clock },
  OVERDUE: { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: AlertCircle },
  CANCELLED: { label: 'Cancelled', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400', icon: XCircle },
  REFUNDED: { label: 'Refunded', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400', icon: ArrowDownRight },
}

const QUOTE_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  DRAFT: { label: 'Draft', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300', icon: FileText },
  SENT: { label: 'Sent', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Send },
  ACCEPTED: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: XCircle },
  EXPIRED: { label: 'Expired', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400', icon: Clock },
  CONVERTED: { label: 'Converted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: ArrowUpRight },
}

const PAYMENT_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  INITIATED: { label: 'Initiated', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Clock },
  PROCESSING: { label: 'Processing', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Loader2 },
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  FAILED: { label: 'Failed', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: XCircle },
  REFUNDED: { label: 'Refunded', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400', icon: ArrowDownRight },
}

const NEGOTIATION_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  REQUESTED: { label: 'Requested', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Send },
  UNDER_REVIEW: { label: 'Under Review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Eye },
  COUNTER_OFFERED: { label: 'Counter Offer', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Handshake },
  ACCEPTED: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: XCircle },
  EXPIRED: { label: 'Expired', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400', icon: Clock },
}

const GATEWAYS = [
  { id: 'PAYSTACK', label: 'Paystack', hint: 'Primary · Nigeria', accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { id: 'FLUTTERWAVE', label: 'Flutterwave', hint: 'Pan-African', accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { id: 'STRIPE', label: 'Stripe', hint: 'International', accent: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' },
] as const

// Need to import Eye for UNDER_REVIEW
import { Eye } from 'lucide-react'

const QUOTE_FEATURES = [
  { id: 'whatsapp_notifications', label: 'WhatsApp Notifications', priceHint: '₦25,000' },
  { id: 'sms_credits', label: 'SMS Credits (1,000)', priceHint: '₦15,000' },
  { id: 'custom_domain', label: 'Custom Domain', priceHint: '₦50,000' },
  { id: 'ai_analytics', label: 'AI Analytics', priceHint: '₦100,000' },
  { id: 'premium_support', label: 'Premium Support', priceHint: '₦75,000' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BillingCenter({ subdomain }: { subdomain?: string }) {
  const [tab, setTab] = useState<'overview' | 'invoices' | 'quotes' | 'negotiations'>('overview')
  const [workspace, setWorkspace] = useState<WorkspaceMeta | null>(null)
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [gateways, setGateways] = useState<string[]>([])
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const [ws, pl, inv, qu, pay, neg] = await Promise.all([
        api.workspaceDashboard(subdomain).catch(() => null),
        api.bspmGetPricing().catch(() => ({ plans: [] })),
        api.bspmGetInvoices('', subdomain).catch(() => ({ invoices: [] })),
        api.bspmGetQuotes(subdomain).catch(() => ({ quotes: [] })),
        api.bspmGetPayments(subdomain).catch(() => ({ payments: [], gateways: [] })),
        api.bspmGetNegotiations(subdomain).catch(() => ({ negotiations: [] })),
      ])
      setWorkspace(ws as any)
      setPlans((pl as any)?.plans || [])
      setInvoices((inv as any)?.invoices || [])
      setQuotes((qu as any)?.quotes || [])
      setPayments((pay as any)?.payments || [])
      setGateways((pay as any)?.gateways || [])
      setNegotiations((neg as any)?.negotiations || [])
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load billing center')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, refreshTick])

  if (loading && !workspace) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading billing center…</p>
        </div>
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Billing Unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button onClick={load} className="mt-4 gap-2"><RefreshCw className="h-4 w-4" /> Retry</Button>
      </div>
    )
  }

  const org = workspace?.organization

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* ---------- Header ---------- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <Card className="votewise-card-glow overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold sm:text-3xl">Billing Center</h1>
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                    <Coins className="h-3 w-3" /> BSPCM Engine
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Manage your subscription, invoices, quotes, and custom-pricing negotiations.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2">
                <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setRefreshTick((t) => t + 1)}
                  aria-label="Auto-refreshing"
                >
                  <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs">Live</span>
                </Button>
              </div>
              {subdomain && (
                <Badge variant="secondary" className="font-mono text-[10px]">{subdomain}.votewise.com.ng</Badge>
              )}
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---------- Tabs ---------- */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <div className="votewise-scroll mb-6 overflow-x-auto">
          <TabsList className="flex w-max gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <FileText className="h-4 w-4" /> Invoices
              {invoices.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{invoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-1.5">
              <Receipt className="h-4 w-4" /> Quotes
              {quotes.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{quotes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="negotiations" className="gap-1.5">
              <MessageCircle className="h-4 w-4" /> Negotiations
              {negotiations.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{negotiations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab
            org={org}
            invoices={invoices}
            payments={payments}
            gateways={gateways}
            plans={plans}
            onUpgrade={() => setTab('quotes')}
            subdomain={subdomain}
          />
        </TabsContent>
        <TabsContent value="invoices" className="mt-0">
          <InvoicesTab invoices={invoices} subdomain={subdomain} onChanged={load} />
        </TabsContent>
        <TabsContent value="quotes" className="mt-0">
          <QuotesTab quotes={quotes} plans={plans} subdomain={subdomain} onChanged={load} />
        </TabsContent>
        <TabsContent value="negotiations" className="mt-0">
          <NegotiationsTab negotiations={negotiations} subdomain={subdomain} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===========================================================================
// TAB 1 — Overview (subscription status + payment summary)
// ===========================================================================

function OverviewTab({
  org, invoices, payments, gateways, plans, onUpgrade, subdomain,
}: {
  org: any
  invoices: Invoice[]
  payments: Payment[]
  gateways: string[]
  plans: PricingPlan[]
  onUpgrade: () => void
  subdomain?: string
}) {
  const totalPaid = payments
    .filter((p) => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + p.amount, 0)
  const outstanding = invoices
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID')
    .reduce((sum, i) => sum + (i.grandTotal - i.amountPaid), 0)
  const activeSub = org?.status === 'ACTIVE'
  const paidUntil = org?.paidUntil ? new Date(org.paidUntil) : null
  const expiringSoon = paidUntil
    ? (paidUntil.getTime() - Date.now()) < 14 * 86_400_000
    : false

  const planLabel = org?.plan || 'PAYG'
  const planInfo = plans.find((p) => p.name === planLabel)

  const recentPayments = payments.slice(0, 10)
  const voterQuota = org?.voterQuota || 0
  // We don't have votersUsed on the org object here; show quota only.

  const stats = [
    { icon: Wallet, label: 'Total Paid', value: formatNaira(totalPaid), accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', trend: 'up' as const },
    { icon: AlertCircle, label: 'Outstanding', value: formatNaira(outstanding), accent: outstanding > 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300', trend: outstanding > 0 ? 'down' as const : undefined },
    { icon: CheckCircle2, label: 'Active Subscription', value: activeSub ? 'Yes' : 'No', accent: activeSub ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { icon: Clock, label: 'Expiring Soon', value: expiringSoon ? 'Within 14 days' : 'No', accent: expiringSoon ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300' },
  ]

  return (
    <div className="space-y-6">
      {/* ---- Subscription + plan cards ---- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current plan (spans 2) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-2"
        >
          <Card className="votewise-card-glow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Current Plan
                </CardTitle>
                <Badge className={cn(activeSub ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300')}>
                  {org?.status || 'TRIAL'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-3xl font-bold">{planInfo?.displayName || planLabel}</span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {planInfo?.model || 'PAYG'}
                </Badge>
              </div>
              {planInfo?.description && (
                <p className="text-sm text-muted-foreground">{planInfo.description}</p>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <PlanStat icon={Calendar} label="Period" value={paidUntil ? `Until ${formatDate(paidUntil.toISOString())}` : '—'} />
                <PlanStat icon={Users} label="Voter Quota" value={voterQuota > 0 ? formatNumber(voterQuota) : 'Unlimited'} />
                <PlanStat icon={Vote} label="Elections" value={planInfo?.maxElections && planInfo.maxElections > 0 ? `Max ${planInfo.maxElections}` : 'Unlimited'} />
              </div>

              {voterQuota > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Voter quota usage</span>
                    <span className="font-mono">0 / {formatNumber(voterQuota)}</span>
                  </div>
                  <Progress value={0} className="h-2 [&_[data-slot=progress-indicator]]:bg-primary" />
                </div>
              )}

              {planInfo?.features && planInfo.features.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Included features</div>
                  <div className="flex flex-wrap gap-1.5">
                    {planInfo.features.slice(0, 8).map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                        {f.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button onClick={onUpgrade} size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Zap className="h-3.5 w-3.5" /> Upgrade Plan
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> View Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment methods */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" /> Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(gateways.length > 0 ? gateways : GATEWAYS.map((g) => g.id)).map((gId) => {
                const g = GATEWAYS.find((x) => x.id === gId)
                if (!g) return null
                return (
                  <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                    <div className={cn('grid h-9 w-9 place-items-center rounded-lg', g.accent)}>
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-[10px] text-muted-foreground">{g.hint}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Active
                    </Badge>
                  </div>
                )
              })}
              <Separator />
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  All payments are processed through secure, PCI-compliant gateways.
                  We never store your card details.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ---- Stat cards (4) ---- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('grid h-9 w-9 place-items-center rounded-lg', s.accent)}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  {s.trend === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-600" aria-label="up" />}
                  {s.trend === 'down' && <ArrowDownRight className="h-4 w-4 text-amber-600" aria-label="down" />}
                </div>
                <div className="mt-3">
                  <div className="font-display text-lg font-bold leading-tight sm:text-xl">{s.value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ---- Recent payments ---- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Recent Payments
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">Last 10</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No payments yet.</p>
                <p className="text-xs text-muted-foreground">Pay an invoice to see your payment history here.</p>
              </div>
            ) : (
              <div className="votewise-scroll max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow className="text-[10px] uppercase tracking-wider">
                      <TableHead className="h-9">Reference</TableHead>
                      <TableHead className="h-9">Date</TableHead>
                      <TableHead className="h-9">Gateway</TableHead>
                      <TableHead className="h-9 text-right">Amount</TableHead>
                      <TableHead className="h-9 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((p) => {
                      const style = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.INITIATED
                      const Icon = style.icon
                      return (
                        <TableRow key={p.id} className="text-xs">
                          <TableCell className="font-mono">{p.paymentReference}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(p.initiatedAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{p.gateway}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums">
                            {formatNaira(p.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={cn('text-[10px] gap-1', style.cls)}>
                              <Icon className="h-3 w-3" /> {style.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function PlanStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

// ===========================================================================
// TAB 2 — Invoices
// ===========================================================================

function InvoicesTab({
  invoices, subdomain, onChanged,
}: {
  invoices: Invoice[]
  subdomain?: string
  onChanged: () => void
}) {
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [payDialog, setPayDialog] = useState<Invoice | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return invoices
    if (filter === 'outstanding') {
      return invoices.filter((i) => ['SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(i.status))
    }
    return invoices.filter((i) => i.status === filter.toUpperCase())
  }, [invoices, filter])

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'outstanding', label: 'Outstanding' },
  ]

  return (
    <div className="space-y-6">
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Invoices
              </CardTitle>
              <p className="text-sm text-muted-foreground">View, track, and pay your invoices.</p>
            </div>
            <div className="votewise-scroll flex gap-1 overflow-x-auto">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={filter === f.key ? 'default' : 'outline'}
                  onClick={() => setFilter(f.key)}
                  className="shrink-0 text-xs"
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium">No invoices found.</p>
              <p className="text-xs text-muted-foreground">
                Generate a quote in the Quotes tab and accept it to create an invoice.
              </p>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="text-[10px] uppercase tracking-wider">
                    <TableHead className="h-9">Invoice #</TableHead>
                    <TableHead className="h-9">Date</TableHead>
                    <TableHead className="h-9">Due</TableHead>
                    <TableHead className="h-9 text-right">Amount</TableHead>
                    <TableHead className="h-9 text-right">Status</TableHead>
                    <TableHead className="h-9 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const style = INVOICE_STATUS[inv.status] || INVOICE_STATUS.DRAFT
                    const Icon = style.icon
                    const canPay = ['SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(inv.status)
                    return (
                      <TableRow key={inv.id} className="text-xs cursor-pointer hover:bg-muted/30" onClick={() => setSelected(inv)}>
                        <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatNaira(inv.grandTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn('text-[10px] gap-1', style.cls)}>
                            <Icon className="h-3 w-3" /> {style.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canPay ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-[10px] h-7"
                              onClick={(e) => { e.stopPropagation(); setPayDialog(inv) }}
                            >
                              <CreditCard className="h-3 w-3" /> Pay Now
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-[10px] h-7"
                              onClick={(e) => { e.stopPropagation(); setSelected(inv) }}
                            >
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Invoice {selected.invoiceNumber}
                </DialogTitle>
                <DialogDescription>
                  Issued {formatDate(selected.createdAt)} · Due {formatDate(selected.dueDate)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status + meta */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('gap-1', (INVOICE_STATUS[selected.status] || INVOICE_STATUS.DRAFT).cls)}>
                    {(INVOICE_STATUS[selected.status] || INVOICE_STATUS.DRAFT).label}
                  </Badge>
                  {selected.paymentMethod && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CreditCard className="h-3 w-3" /> {selected.paymentMethod}
                    </Badge>
                  )}
                  {selected.paymentReference && (
                    <Badge variant="outline" className="text-[10px] font-mono gap-1">
                      <Hash className="h-3 w-3" /> {selected.paymentReference}
                    </Badge>
                  )}
                  {selected.paidAt && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Paid {formatDate(selected.paidAt)}
                    </Badge>
                  )}
                </div>

                {/* Line items */}
                <div className="rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px] uppercase tracking-wider">
                        <TableHead className="h-8">Description</TableHead>
                        <TableHead className="h-8 text-right">Qty</TableHead>
                        <TableHead className="h-8 text-right">Unit</TableHead>
                        <TableHead className="h-8 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.items.map((item, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                            {formatNumber(item.quantity)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                            {formatNaira(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold">
                            {formatNaira(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono tabular-nums">{formatNaira(selected.subtotal)}</span>
                  </div>
                  {selected.discountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> Discount</span>
                      <span className="font-mono tabular-nums">−{formatNaira(selected.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">VAT ({selected.taxRate}%)</span>
                    <span className="font-mono tabular-nums">{formatNaira(selected.taxAmount)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Grand Total</span>
                    <span className="font-mono font-bold tabular-nums text-primary">{formatNaira(selected.grandTotal)}</span>
                  </div>
                  {selected.amountPaid > 0 && selected.amountPaid < selected.grandTotal && (
                    <>
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                        <span>Paid</span>
                        <span className="font-mono tabular-nums">{formatNaira(selected.amountPaid)}</span>
                      </div>
                      <div className="flex items-center justify-between font-semibold text-amber-700 dark:text-amber-300">
                        <span>Balance Due</span>
                        <span className="font-mono tabular-nums">{formatNaira(selected.grandTotal - selected.amountPaid)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Pay button */}
                {['SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(selected.status) && (
                  <Button
                    onClick={() => { setPayDialog(selected); setSelected(null) }}
                    className="w-full gap-2"
                  >
                    <CreditCard className="h-4 w-4" /> Pay {formatNaira(selected.grandTotal - selected.amountPaid)} Now
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <PayDialog
        invoice={payDialog}
        subdomain={subdomain}
        onClose={() => setPayDialog(null)}
        onPaid={() => { setPayDialog(null); onChanged() }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pay Dialog — gateway selector + initiate + verify
// ---------------------------------------------------------------------------

function PayDialog({
  invoice, subdomain, onClose, onPaid,
}: {
  invoice: Invoice | null
  subdomain?: string
  onClose: () => void
  onPaid: () => void
}) {
  const [gateway, setGateway] = useState<string>('PAYSTACK')
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [paymentRef, setPaymentRef] = useState<string | null>(null)

  async function initiate() {
    if (!invoice) return
    setBusy(true)
    setResult(null)
    try {
      const r: any = await api.bspmInitiatePayment({ invoiceId: invoice.id, gateway }, subdomain)
      setResult(r)
      setPaymentRef(r.reference)
      toast.success('Payment initiated. Verify to complete.')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to initiate payment')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (!paymentRef) return
    setVerifying(true)
    try {
      const r: any = await api.bspmVerifyPayment({ reference: paymentRef, gateway })
      if (r.verified) {
        toast.success('Payment verified! Invoice marked as paid.')
        onPaid()
      } else {
        toast.error(r.message || 'Payment verification failed.')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Payment verification failed.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Pay Invoice {invoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription>
                Amount due: <strong className="text-foreground">{formatNaira(invoice.grandTotal - invoice.amountPaid)}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!result && (
                <>
                  <div className="space-y-2">
                    <Label>Select a payment gateway</Label>
                    <div className="grid gap-2">
                      {GATEWAYS.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGateway(g.id)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                            gateway === g.id
                              ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border/60 hover:border-primary/30',
                          )}
                        >
                          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', g.accent)}>
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{g.label}</div>
                            <div className="text-[10px] text-muted-foreground">{g.hint}</div>
                          </div>
                          {gateway === g.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={initiate} disabled={busy} className="w-full gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {busy ? 'Initiating…' : `Pay ${formatNaira(invoice.grandTotal - invoice.amountPaid)}`}
                  </Button>
                </>
              )}

              {result && (
                <div className="space-y-3">
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle>Payment initiated</AlertTitle>
                    <AlertDescription className="text-xs">
                      Reference: <span className="font-mono">{result.reference}</span>
                    </AlertDescription>
                  </Alert>
                  {result.authorizationUrl && (
                    <a
                      href={result.authorizationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 p-3 text-xs font-medium text-primary hover:bg-primary/5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open gateway checkout
                    </a>
                  )}
                  <Button onClick={verify} disabled={verifying} className="w-full gap-2">
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {verifying ? 'Verifying…' : 'I have completed payment — Verify'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose} className="w-full">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 3 — Quotes
// ===========================================================================

function QuotesTab({
  quotes, plans, subdomain, onChanged,
}: {
  quotes: Quote[]
  plans: PricingPlan[]
  subdomain?: string
  onChanged: () => void
}) {
  const [genOpen, setGenOpen] = useState(false)
  const [selected, setSelected] = useState<Quote | null>(null)

  return (
    <div className="space-y-6">
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Quotes
              </CardTitle>
              <p className="text-sm text-muted-foreground">Generate a quotation for your upcoming election.</p>
            </div>
            <Button onClick={() => setGenOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Generate New Quote
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium">No quotes yet.</p>
              <p className="text-xs text-muted-foreground">
                Click <strong>Generate New Quote</strong> to get started.
              </p>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="text-[10px] uppercase tracking-wider">
                    <TableHead className="h-9">Quote #</TableHead>
                    <TableHead className="h-9">Date</TableHead>
                    <TableHead className="h-9">Valid Until</TableHead>
                    <TableHead className="h-9 text-right">Total</TableHead>
                    <TableHead className="h-9 text-right">Status</TableHead>
                    <TableHead className="h-9 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => {
                    const style = QUOTE_STATUS[q.status] || QUOTE_STATUS.DRAFT
                    const Icon = style.icon
                    return (
                      <TableRow key={q.id} className="text-xs cursor-pointer hover:bg-muted/30" onClick={() => setSelected(q)}>
                        <TableCell className="font-mono font-medium">{q.quoteNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(q.validUntil)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatNaira(q.grandTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn('text-[10px] gap-1', style.cls)}>
                            <Icon className="h-3 w-3" /> {style.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-[10px] h-7"
                            onClick={(e) => { e.stopPropagation(); setSelected(q) }}
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate quote dialog */}
      <GenerateQuoteDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        plans={plans}
        subdomain={subdomain}
        onGenerated={() => { setGenOpen(false); onChanged() }}
      />

      {/* Quote detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" /> Quote {selected.quoteNumber}
                </DialogTitle>
                <DialogDescription>
                  Created {formatDate(selected.createdAt)} · Valid until {formatDate(selected.validUntil)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('gap-1', (QUOTE_STATUS[selected.status] || QUOTE_STATUS.DRAFT).cls)}>
                    {(QUOTE_STATUS[selected.status] || QUOTE_STATUS.DRAFT).label}
                  </Badge>
                  {selected.estimatedVoters != null && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Users className="h-3 w-3" /> {formatNumber(selected.estimatedVoters)} voters
                    </Badge>
                  )}
                  {selected.estimatedElections != null && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Vote className="h-3 w-3" /> {selected.estimatedElections} elections
                    </Badge>
                  )}
                  {selected.discountAmount > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 dark:text-emerald-400">
                      <Tag className="h-3 w-3" /> {selected.discountPercent}% discount
                    </Badge>
                  )}
                </div>

                {/* Line items */}
                <div className="rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px] uppercase tracking-wider">
                        <TableHead className="h-8">Description</TableHead>
                        <TableHead className="h-8 text-right">Qty</TableHead>
                        <TableHead className="h-8 text-right">Unit</TableHead>
                        <TableHead className="h-8 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.items.map((item, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                            {formatNumber(item.quantity)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                            {formatNaira(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold">
                            {formatNaira(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono tabular-nums">{formatNaira(selected.subtotal)}</span>
                  </div>
                  {selected.discountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> Discount</span>
                      <span className="font-mono tabular-nums">−{formatNaira(selected.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">VAT ({selected.taxRate}%)</span>
                    <span className="font-mono tabular-nums">{formatNaira(selected.taxAmount)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Grand Total</span>
                    <span className="font-mono font-bold tabular-nums text-primary">{formatNaira(selected.grandTotal)}</span>
                  </div>
                </div>

                {selected.status === 'ACCEPTED' && (
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle>Quote accepted</AlertTitle>
                    <AlertDescription className="text-xs">
                      This quote has been accepted and converted to an invoice. Check the Invoices tab.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GenerateQuoteDialog({
  open, onOpenChange, plans, subdomain, onGenerated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  plans: PricingPlan[]
  subdomain?: string
  onGenerated: () => void
}) {
  const [voters, setVoters] = useState<number>(1000)
  const [elections, setElections] = useState<number>(1)
  const [planName, setPlanName] = useState<string>('PAYG')
  const [features, setFeatures] = useState<string[]>([])
  const [notes, setNotes] = useState<string>('')
  const [busy, setBusy] = useState(false)

  function toggleFeature(id: string) {
    setFeatures((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function generate() {
    setBusy(true)
    try {
      await api.bspmGenerateQuote({
        estimatedVoters: voters,
        estimatedElections: elections,
        requestedFeatures: features,
        planName,
        notes,
      }, subdomain)
      toast.success('Quote generated successfully.')
      // Reset form
      setVoters(1000)
      setElections(1)
      setFeatures([])
      setNotes('')
      onGenerated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate quote')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Generate New Quote
          </DialogTitle>
          <DialogDescription>
            Configure your election parameters and add-ons. A formal quote will be generated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan selector */}
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planName} onValueChange={setPlanName}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.length > 0 ? plans.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.displayName} — {p.description?.slice(0, 50) || p.model}
                  </SelectItem>
                )) : (
                  <>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PAYG">Pay As You Go</SelectItem>
                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Voters slider */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Number of Voters</Label>
              <span className="font-mono text-sm font-bold text-primary">{formatNumber(voters)}</span>
            </div>
            <Slider value={[voters]} onValueChange={(v) => setVoters(v[0])} min={10} max={100000} step={10} />
          </div>

          {/* Elections */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Vote className="h-4 w-4" /> Number of Elections</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={elections}
              onChange={(e) => {
                const v = parseInt(e.target.value || '1', 10)
                if (!Number.isNaN(v)) setElections(Math.max(1, Math.min(100, v)))
              }}
              className="font-mono"
            />
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Add-ons (optional)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUOTE_FEATURES.map((f) => {
                const checked = features.includes(f.id)
                return (
                  <label
                    key={f.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition-all',
                      checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60 hover:border-primary/30',
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleFeature(f.id)} className="mt-0.5" />
                    <div>
                      <div className="font-medium">{f.label}</div>
                      <div className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">{f.priceHint}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="quote-notes">Notes (optional)</Label>
            <Textarea
              id="quote-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific requirements or context for this quote…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={generate} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {busy ? 'Generating…' : 'Generate Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 4 — Negotiations
// ===========================================================================

function NegotiationsTab({
  negotiations, subdomain, onChanged,
}: {
  negotiations: Negotiation[]
  subdomain?: string
  onChanged: () => void
}) {
  const [reqOpen, setReqOpen] = useState(false)
  const [selected, setSelected] = useState<Negotiation | null>(null)

  return (
    <div className="space-y-6">
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Custom Pricing Negotiations
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Need a tailored plan? Request custom pricing for large voter counts, multi-year commitments, or enterprise needs.
              </p>
            </div>
            <Button onClick={() => setReqOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Request Custom Pricing
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {negotiations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Handshake className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium">No negotiations yet.</p>
              <p className="text-xs text-muted-foreground">
                Click <strong>Request Custom Pricing</strong> to start a conversation with our sales team.
              </p>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="text-[10px] uppercase tracking-wider">
                    <TableHead className="h-9">Type</TableHead>
                    <TableHead className="h-9">Date</TableHead>
                    <TableHead className="h-9 text-right">Proposed</TableHead>
                    <TableHead className="h-9 text-right">Agreed</TableHead>
                    <TableHead className="h-9 text-right">Status</TableHead>
                    <TableHead className="h-9 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negotiations.map((n) => {
                    const style = NEGOTIATION_STATUS[n.status] || NEGOTIATION_STATUS.REQUESTED
                    const Icon = style.icon
                    return (
                      <TableRow key={n.id} className="text-xs cursor-pointer hover:bg-muted/30" onClick={() => setSelected(n)}>
                        <TableCell className="font-medium">
                          {n.requestType.replace(/_/g, ' ').toLowerCase()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(n.createdAt)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {n.proposedAmount ? formatNaira(n.proposedAmount) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">
                          {n.agreedAmount ? formatNaira(n.agreedAmount) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn('text-[10px] gap-1', style.cls)}>
                            <Icon className="h-3 w-3" /> {style.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-[10px] h-7"
                            onClick={(e) => { e.stopPropagation(); setSelected(n) }}
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request negotiation dialog */}
      <RequestNegotiationDialog
        open={reqOpen}
        onOpenChange={setReqOpen}
        subdomain={subdomain}
        onRequested={() => { setReqOpen(false); onChanged() }}
      />

      {/* Negotiation detail dialog with thread */}
      <NegotiationDetailDialog
        negotiation={selected}
        subdomain={subdomain}
        onClose={() => setSelected(null)}
        onChanged={onChanged}
      />
    </div>
  )
}

function RequestNegotiationDialog({
  open, onOpenChange, subdomain, onRequested,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subdomain?: string
  onRequested: () => void
}) {
  const [message, setMessage] = useState('')
  const [voterCount, setVoterCount] = useState<number>(5000)
  const [orgType, setOrgType] = useState<string>('UNIVERSITY')
  const [proposedAmount, setProposedAmount] = useState<string>('')
  const [requestType, setRequestType] = useState<string>('CUSTOM_PRICING')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!message.trim()) {
      toast.error('Please enter a message describing your request.')
      return
    }
    setBusy(true)
    try {
      await api.bspmRequestNegotiation({
        message,
        voterCount,
        orgType,
        proposedAmount: proposedAmount ? parseFloat(proposedAmount) : null,
        requestType,
      }, subdomain)
      toast.success('Custom pricing request submitted. Our team will respond within 24 hours.')
      setMessage('')
      setProposedAmount('')
      onRequested()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" /> Request Custom Pricing
          </DialogTitle>
          <DialogDescription>
            Tell us about your needs. Our team will review and respond within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request type */}
          <div className="space-y-2">
            <Label>Request Type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOM_PRICING">Custom Pricing</SelectItem>
                <SelectItem value="VOLUME_DISCOUNT">Volume Discount</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise Plan</SelectItem>
                <SelectItem value="GOVERNMENT">Government Plan</SelectItem>
                <SelectItem value="WHITE_LABEL">White Label</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Voter count + org type */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Estimated Voters</Label>
              <Input
                type="number"
                min={1}
                value={voterCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value || '0', 10)
                  if (!Number.isNaN(v)) setVoterCount(Math.max(1, v))
                }}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Organization Type</Label>
              <Select value={orgType} onValueChange={setOrgType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIVERSITY">University</SelectItem>
                  <SelectItem value="COMPANY">Company</SelectItem>
                  <SelectItem value="ASSOCIATION">Association</SelectItem>
                  <SelectItem value="CHURCH">Church</SelectItem>
                  <SelectItem value="NGO">NGO</SelectItem>
                  <SelectItem value="GOVERNMENT">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Proposed amount */}
          <div className="space-y-2">
            <Label>Proposed Amount (optional, ₦)</Label>
            <Input
              type="number"
              min={0}
              value={proposedAmount}
              onChange={(e) => setProposedAmount(e.target.value)}
              placeholder="e.g. 250000"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The amount you&apos;re willing to pay (annual or per election). Leave blank if unsure.
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="neg-message">Message <span className="text-destructive">*</span></Label>
            <Textarea
              id="neg-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your election needs, expected voter count, timeline, multi-year commitments, or any specific requirements…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NegotiationDetailDialog({
  negotiation, subdomain, onClose, onChanged,
}: {
  negotiation: Negotiation | null
  subdomain?: string
  onClose: () => void
  onChanged: () => void
}) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  async function addMessage() {
    if (!negotiation || !reply.trim()) return
    setBusy(true)
    try {
      await api.bspmUpdateNegotiation(negotiation.id, {
        action: 'add_message',
        message: reply,
      }, subdomain)
      toast.success('Message added.')
      setReply('')
      onChanged()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add message')
    } finally {
      setBusy(false)
    }
  }

  if (!negotiation) return null
  const style = NEGOTIATION_STATUS[negotiation.status] || NEGOTIATION_STATUS.REQUESTED
  const Icon = style.icon

  return (
    <Dialog open={!!negotiation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Negotiation Thread
          </DialogTitle>
          <DialogDescription>
            Opened {formatDateTime(negotiation.createdAt)} · {negotiation.requestType.replace(/_/g, ' ').toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status + meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('gap-1', style.cls)}>
              <Icon className="h-3 w-3" /> {style.label}
            </Badge>
            {negotiation.voterCount && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Users className="h-3 w-3" /> {formatNumber(negotiation.voterCount)} voters
              </Badge>
            )}
            {negotiation.orgType && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Building2 className="h-3 w-3" /> {negotiation.orgType}
              </Badge>
            )}
            {negotiation.proposedAmount && (
              <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                <Wallet className="h-3 w-3" /> Proposed {formatNaira(negotiation.proposedAmount)}
              </Badge>
            )}
            {negotiation.agreedAmount && (
              <Badge variant="outline" className="text-[10px] gap-1 font-mono text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Agreed {formatNaira(negotiation.agreedAmount)}
              </Badge>
            )}
            {negotiation.assignedToName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <ShieldCheck className="h-3 w-3" /> {negotiation.assignedToName}
              </Badge>
            )}
          </div>

          {/* Original request */}
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Original Request</span>
              <span>{relativeTime(negotiation.createdAt)}</span>
            </div>
            <p className="text-sm leading-relaxed">{negotiation.message}</p>
          </div>

          {/* Thread */}
          {negotiation.thread && negotiation.thread.length > 1 && (
            <div className="votewise-scroll max-h-64 space-y-3 overflow-y-auto">
              {negotiation.thread.slice(1).map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg border p-3',
                    entry.role === 'ADMIN'
                      ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                      : 'border-border/60 bg-card',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 font-medium">
                      {entry.role === 'ADMIN' ? (
                        <><ShieldCheck className="h-3 w-3 text-emerald-600" /> VoteWise Team</>
                      ) : (
                        <><Building2 className="h-3 w-3 text-primary" /> {entry.author}</>
                      )}
                    </span>
                    <span className="text-muted-foreground">{relativeTime(entry.timestamp)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{entry.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add message (only if not resolved) */}
          {!['ACCEPTED', 'REJECTED', 'EXPIRED'].includes(negotiation.status) && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <Label htmlFor="neg-reply">Add a message</Label>
              <Textarea
                id="neg-reply"
                rows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addMessage()
                }}
              />
              <Button onClick={addMessage} disabled={busy || !reply.trim()} size="sm" className="gap-1.5">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {busy ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          )}

          {/* Resolution banner */}
          {['ACCEPTED', 'REJECTED'].includes(negotiation.status) && negotiation.resolvedAt && (
            <Alert className={cn(
              negotiation.status === 'ACCEPTED'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100',
            )}>
              {negotiation.status === 'ACCEPTED' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertTitle>
                {negotiation.status === 'ACCEPTED' ? 'Request Accepted' : 'Request Rejected'}
              </AlertTitle>
              <AlertDescription className="text-xs">
                Resolved {formatDateTime(negotiation.resolvedAt)} by {negotiation.resolvedByName || 'the VoteWise team'}.
                {negotiation.status === 'ACCEPTED' && negotiation.agreedAmount && (
                  <> Agreed amount: <strong>{formatNaira(negotiation.agreedAmount)}</strong>.</>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
