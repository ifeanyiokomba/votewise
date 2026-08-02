'use client'

// =============================================================================
// VoteWise — BSPCM Public Cost Estimator
// Chapter 14 — Billing, Subscriptions, Payments & Commercial Management
// =============================================================================
// Public pricing calculator embedded on the homepage. Lets any visitor plug in
// their voter count, election count, organization type, and desired add-on
// features, and instantly see an itemised cost estimate — formatted in ₦.
//
// Calls the public POST /api/bspcm/estimate endpoint (no auth required).
// Palette: emerald / gold / amber / zinc / red ONLY — no indigo, no blue.
// =============================================================================

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator, Loader2, Sparkles, ArrowRight, CheckCircle2, AlertCircle,
  ShieldCheck, Users, Vote, Layers, ChevronRight, RefreshCw, MessageSquare,
  Building2, GraduationCap, Briefcase, Users2, Church, Heart, Landmark,
  Tag, Receipt, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Static config — feature catalog & org types (mirrors BSPCM pricing rules)
// ---------------------------------------------------------------------------

interface FeatureOption {
  id: string         // matches the featureName in PricingRule table
  label: string
  description: string
  icon: any
  priceHint: string
}

const FEATURES: FeatureOption[] = [
  {
    id: 'whatsapp_notifications',
    label: 'WhatsApp Notifications',
    description: 'Send OTPs, reminders, and announcements via WhatsApp.',
    icon: MessageSquare,
    priceHint: '₦25,000',
  },
  {
    id: 'sms_credits',
    label: 'SMS Credits (1,000)',
    description: 'Bulk SMS for voter OTPs and election-day reminders.',
    icon: ShieldCheck,
    priceHint: '₦15,000',
  },
  {
    id: 'custom_domain',
    label: 'Custom Domain',
    description: 'Host your election on vote.yourorg.org instead of a subdomain.',
    icon: Building2,
    priceHint: '₦50,000',
  },
  {
    id: 'ai_analytics',
    label: 'AI Analytics',
    description: 'Predictive turnout modelling, anomaly detection, and insights.',
    icon: TrendingUp,
    priceHint: '₦100,000',
  },
  {
    id: 'premium_support',
    label: 'Premium Support',
    description: 'Priority 24/7 support with a dedicated account manager.',
    icon: CheckCircle2,
    priceHint: '₦75,000',
  },
]

const ORG_TYPES = [
  { id: 'UNIVERSITY', label: 'University', icon: GraduationCap, hint: '15% educational discount' },
  { id: 'COMPANY', label: 'Company', icon: Briefcase, hint: 'Standard pricing' },
  { id: 'ASSOCIATION', label: 'Association', icon: Users2, hint: 'Standard pricing' },
  { id: 'CHURCH', label: 'Church', icon: Church, hint: 'Standard pricing' },
  { id: 'NGO', label: 'NGO', icon: Heart, hint: 'Standard pricing' },
  { id: 'GOVERNMENT', label: 'Government', icon: Landmark, hint: 'Standard pricing' },
]

// ---------------------------------------------------------------------------
// Types — mirror BSPCM PricingEstimate (src/lib/bspcm/types.ts)
// ---------------------------------------------------------------------------

interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface EstimateResult {
  plan: string
  items: QuoteItem[]
  subtotal: number
  discount: number
  total: number
  currency: string
  features: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNaira(amount: number): string {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-NG')
}

// Map a feature id (e.g. "whatsapp_notifications") to a friendly label.
function featureLabel(id: string): string {
  const f = FEATURES.find((x) => x.id === id)
  return f ? f.label : id.replace(/_/g, ' ')
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CostEstimator() {
  const { setView } = useApp()
  const [voters, setVoters] = useState<number>(1000)
  const [elections, setElections] = useState<number>(1)
  const [orgType, setOrgType] = useState<string>('UNIVERSITY')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleFeature(id: string) {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function calculate() {
    if (voters < 10) {
      toast.error('Please enter at least 10 voters.')
      return
    }
    setBusy(true)
    setError(null)
    setEstimate(null)
    try {
      const result = await api.bspmEstimate({
        estimatedVoters: voters,
        estimatedElections: elections,
        requestedFeatures: selectedFeatures,
        orgType,
      })
      setEstimate(result as EstimateResult)
      toast.success('Estimate ready.')
    } catch (e: any) {
      setError(e?.message || 'Failed to generate estimate. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setEstimate(null)
    setError(null)
  }

  const isEducational = orgType === 'UNIVERSITY'

  return (
    <section
      id="cost-estimator"
      className="border-b border-border/60 bg-gradient-to-b from-accent/5 via-primary/5 to-background scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        {/* ---------- Header ---------- */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <Badge variant="secondary" className="mb-3 gap-1">
            <Calculator className="h-3.5 w-3.5" /> BSPCM Pricing Engine
          </Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Estimate Your{' '}
            <span className="text-primary">Election Cost</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Transparent, tiered pricing — plug in your voter count, election count,
            and desired add-ons. Universities automatically receive a 15% educational
            discount. No commitment, no signup required.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
          {/* ---------- Inputs (left, 3 cols) ---------- */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-3"
          >
            <Card className="votewise-card-glow h-full">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" /> Configure Your Estimate
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Drag the slider or type a value. All amounts in Nigerian Naira (₦).
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voter count */}
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="voters" className="flex items-center gap-1.5 text-sm font-medium">
                      <Users className="h-4 w-4 text-primary" /> Number of Voters
                    </Label>
                    <span className="font-mono text-sm font-bold tabular-nums text-primary">
                      {formatNumber(voters)}
                    </span>
                  </div>
                  <Slider
                    id="voters"
                    value={[voters]}
                    onValueChange={(v) => setVoters(v[0])}
                    min={10}
                    max={100000}
                    step={10}
                    className="py-1"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={10}
                      max={100000}
                      value={voters}
                      onChange={(e) => {
                        const v = parseInt(e.target.value || '0', 10)
                        if (!Number.isNaN(v)) setVoters(Math.max(10, Math.min(100000, v)))
                      }}
                      className="font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">10 – 100,000</span>
                  </div>
                </div>

                <Separator />

                {/* Elections count */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="elections" className="flex items-center gap-1.5 text-sm font-medium">
                      <Vote className="h-4 w-4 text-primary" /> Number of Elections
                    </Label>
                    <Input
                      id="elections"
                      type="number"
                      min={1}
                      max={100}
                      value={elections}
                      onChange={(e) => {
                        const v = parseInt(e.target.value || '1', 10)
                        if (!Number.isNaN(v)) setElections(Math.max(1, Math.min(100, v)))
                      }}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Default: 1 election.</p>
                  </div>

                  {/* Org type */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-primary" /> Organization Type
                    </Label>
                    <Select value={orgType} onValueChange={setOrgType}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_TYPES.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            <span className="flex items-center gap-2">
                              <o.icon className="h-4 w-4" /> {o.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isEducational && (
                      <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Tag className="h-3 w-3" /> 15% educational discount applied
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Feature add-ons */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Layers className="h-4 w-4 text-primary" /> Optional Add-ons
                  </Label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {FEATURES.map((f) => {
                      const checked = selectedFeatures.includes(f.id)
                      return (
                        <label
                          key={f.id}
                          htmlFor={`feat-${f.id}`}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all',
                            checked
                              ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border/60 bg-card hover:border-primary/30 hover:bg-muted/30',
                          )}
                        >
                          <Checkbox
                            id={`feat-${f.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleFeature(f.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <f.icon className="h-4 w-4 shrink-0 text-primary" />
                              <span className="text-sm font-medium">{f.label}</span>
                            </div>
                            <p className="mt-1 text-xs leading-snug text-muted-foreground">{f.description}</p>
                            <span className="mt-1 inline-block font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              +{f.priceHint}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Calculate button */}
                <div className="pt-2">
                  <Button
                    onClick={calculate}
                    disabled={busy}
                    size="lg"
                    className="w-full gap-2"
                  >
                    {busy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Calculator className="h-5 w-5" />
                    )}
                    {busy ? 'Calculating…' : 'Calculate Cost'}
                  </Button>
                  {estimate && (
                    <Button
                      onClick={reset}
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full gap-1.5 text-muted-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reset &amp; recalculate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ---------- Results (right, 2 cols) ---------- */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2"
          >
            <Card className="votewise-card-glow sticky top-24 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" /> Your Estimate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {/* Loading state */}
                  {busy && !estimate && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                    >
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Crunching the numbers…</p>
                    </motion.div>
                  )}

                  {/* Error state */}
                  {error && !busy && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Estimate failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                      <Button
                        onClick={calculate}
                        variant="outline"
                        className="mt-3 w-full gap-2"
                      >
                        <RefreshCw className="h-4 w-4" /> Try again
                      </Button>
                    </motion.div>
                  )}

                  {/* Empty state */}
                  {!estimate && !busy && !error && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center gap-4 py-12 text-center"
                    >
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <Calculator className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Your estimate will appear here.</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Configure your election on the left, then click <strong>Calculate Cost</strong>.
                        </p>
                      </div>
                      <div className="grid w-full grid-cols-3 gap-2 pt-2 text-center">
                        <MiniMetric icon={Users} label="Voters" value={formatNumber(voters)} />
                        <MiniMetric icon={Vote} label="Elections" value={String(elections)} />
                        <MiniMetric
                          icon={Layers}
                          label="Add-ons"
                          value={String(selectedFeatures.length)}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Result */}
                  {estimate && !busy && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {/* Plan badge */}
                      <div className="flex items-center justify-between">
                        <Badge className="bg-primary/10 text-primary gap-1">
                          <Sparkles className="h-3 w-3" /> {estimate.plan} plan
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {estimate.currency}
                        </Badge>
                      </div>

                      {/* Line items */}
                      <div className="votewise-scroll max-h-64 overflow-y-auto rounded-lg border border-border/60">
                        <Table>
                          <TableHeader className="sticky top-0 bg-card">
                            <TableRow className="text-[10px] uppercase tracking-wider">
                              <TableHead className="h-8 px-2 py-1.5">Description</TableHead>
                              <TableHead className="h-8 px-2 py-1.5 text-right">Qty</TableHead>
                              <TableHead className="h-8 px-2 py-1.5 text-right">Unit</TableHead>
                              <TableHead className="h-8 px-2 py-1.5 text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {estimate.items.map((item, i) => (
                              <TableRow key={i} className="text-xs">
                                <TableCell className="px-2 py-1.5 font-medium">
                                  {item.description}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                                  {formatNumber(item.quantity)}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                                  {formatNaira(item.unitPrice)}
                                </TableCell>
                                <TableCell className="px-2 py-1.5 text-right font-mono tabular-nums font-semibold">
                                  {formatNaira(item.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Totals */}
                      <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-mono tabular-nums">{formatNaira(estimate.subtotal)}</span>
                        </div>
                        {estimate.discount > 0 && (
                          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" /> Educational discount (15%)
                            </span>
                            <span className="font-mono tabular-nums">−{formatNaira(estimate.discount)}</span>
                          </div>
                        )}
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Grand Total</span>
                          <span className="font-mono text-lg font-bold tabular-nums text-primary">
                            {formatNaira(estimate.total)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Excludes 7.5% VAT (applied at invoicing).
                        </p>
                      </div>

                      {/* Included features */}
                      {estimate.features && estimate.features.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {estimate.features.slice(0, 8).map((f) => (
                            <Badge key={f} variant="secondary" className="text-[10px] gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                              {featureLabel(f)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Disclaimer */}
                      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-xs">
                          This is an estimate. Final pricing may vary based on your specific needs,
                          including volume discounts, custom integrations, and negotiated terms.
                        </AlertDescription>
                      </Alert>

                      {/* CTAs */}
                      <div className="grid gap-2 pt-1">
                        <Button
                          onClick={() => setView('signup')}
                          className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                          <Sparkles className="h-4 w-4" /> Register to Get Started
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => setView('signup')}
                          variant="outline"
                          className="w-full gap-2"
                        >
                          <MessageSquare className="h-4 w-4" /> Request Custom Pricing
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Mini metric chip (empty state)
// ---------------------------------------------------------------------------

function MiniMetric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
      <div className="mt-1 font-mono text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}
