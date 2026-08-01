'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download, FileText, FileSpreadsheet, Printer, Shield, Users, Vote, Award,
  ExternalLink, Copy, Archive, CheckCircle2, Lock, ScrollText, Info, Loader2,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ElectionExportsProps {
  electionId: string
  subdomain?: string
  election?: {
    id: string
    name: string
    status?: string
    startTime?: string
    endTime?: string
  } | null
}

type ExportType = 'results' | 'audit' | 'voters' | 'full'
type ExportFormat = 'csv' | 'json' | 'printable'

interface FormatButton {
  format: ExportFormat
  label: string
  icon: any
}

interface ExportCardDef {
  type: ExportType
  icon: any
  iconTint: string
  title: string
  description: string
  formats: FormatButton[]
  permissionNote: string
  highlight?: boolean
}

// ---------------------------------------------------------------------------
// Card definitions — strictly emerald/gold/amber/red/zinc palette (NO indigo/blue).
// ---------------------------------------------------------------------------

const EXPORT_CARDS: ExportCardDef[] = [
  {
    type: 'results',
    icon: Vote,
    iconTint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    title: 'Results Report',
    description: 'Certified results by position with vote counts, percentages, and winners.',
    formats: [
      { format: 'csv', label: 'CSV', icon: FileSpreadsheet },
      { format: 'json', label: 'JSON', icon: FileText },
      { format: 'printable', label: 'Printable', icon: Printer },
    ],
    permissionNote: 'Requires results.export permission',
    highlight: true,
  },
  {
    type: 'audit',
    icon: Shield,
    iconTint: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    title: 'Audit Trail Export',
    description: 'Complete hash-chained audit log with chain verification status.',
    formats: [
      { format: 'csv', label: 'CSV', icon: FileSpreadsheet },
      { format: 'json', label: 'JSON', icon: FileText },
    ],
    permissionNote: 'Requires audit.export permission',
  },
  {
    type: 'voters',
    icon: Users,
    iconTint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    title: 'Voter Participation Report',
    description: 'Voter registration status and participation (no vote choices).',
    formats: [
      { format: 'csv', label: 'CSV', icon: FileSpreadsheet },
      { format: 'json', label: 'JSON', icon: FileText },
    ],
    permissionNote: 'Requires voter.search permission — never reveals vote choices',
  },
  {
    type: 'full',
    icon: Archive,
    iconTint: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    title: 'Full Election Package',
    description: 'Complete election archive — config, results, verification, audit, participation.',
    formats: [
      { format: 'json', label: 'JSON', icon: FileText },
      { format: 'printable', label: 'Printable', icon: Printer },
    ],
    permissionNote: 'Requires results.export permission — for archival',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ElectionExports({ electionId, subdomain, election }: ElectionExportsProps) {
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [printableUrl, setPrintableUrl] = useState<string | null>(null)

  // Compute the printable URL once. We use api.getPrintableResultSheet which
  // returns a PUBLIC URL — so the link can be copied and shared externally.
  const printableLink = api.getPrintableResultSheet(electionId, subdomain)

  const startBusy = useCallback((key: string) => {
    setBusy((b) => ({ ...b, [key]: true }))
  }, [])
  const stopBusy = useCallback((key: string) => {
    setBusy((b) => ({ ...b, [key]: false }))
  }, [])

  // -------------------------------------------------------------------------
  // Download handlers — for CSV/JSON exports we use the export endpoint,
  // which sets Content-Disposition: attachment → the browser downloads the
  // file. For printable formats we open the URL in a new tab so the user can
  // print or save as PDF using the browser's native print dialog.
  // -------------------------------------------------------------------------
  function handleExport(type: ExportType, format: ExportFormat) {
    const key = `${type}-${format}`
    if (busy[key]) return
    startBusy(key)

    try {
      const url = api.exportElectionData(electionId, type, format, subdomain)

      if (format === 'printable') {
        // Open in a new tab — printable HTML page, not a download.
        window.open(url, '_blank', 'noopener,noreferrer')
        toast.success('Opening printable result sheet in a new tab…')
      } else {
        // CSV / JSON — trigger a download via a hidden anchor with the
        // `download` attribute. The browser sends HttpOnly cookies
        // automatically for same-origin navigations, so auth works.
        const a = document.createElement('a')
        a.href = url
        a.download = ''  // server sets the filename via Content-Disposition
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast.success(`Downloading ${type} report (${format.toUpperCase()})…`)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Export failed')
    } finally {
      // Slight delay to let the request start before clearing the busy state.
      setTimeout(() => stopBusy(key), 600)
    }
  }

  function openPrintableSheet() {
    window.open(printableLink, '_blank', 'noopener,noreferrer')
    toast.success('Opening official result sheet in a new tab…')
  }

  async function copyPrintableLink() {
    try {
      await navigator.clipboard?.writeText(printableLink)
      toast.success('Public link copied — share it with observers.')
    } catch {
      setPrintableUrl(printableLink)
      toast.info('Copy this link manually.', { description: printableLink })
    }
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Download className="h-3 w-3" /> Export &amp; Reports
          </Badge>
          {election?.status && (
            <Badge variant="outline" className="text-[10px]">
              Status: {election.status}
            </Badge>
          )}
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Export &amp; Reports</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Download official results, audit trails, and participation reports in various formats.
        </p>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* Info Alert — what's exported + privacy guarantees */}
      {/* ----------------------------------------------------------------- */}
      <Alert className="border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <Info className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
          What you can export
        </AlertTitle>
        <AlertDescription className="text-emerald-900/80 dark:text-emerald-100/80">
          Every export is org-scoped and permission-gated. Voter participation reports contain registration + voting status only —
          <strong> never vote choices</strong>. Audit exports include the full hash-chained log so chain integrity can be
          independently verified.
        </AlertDescription>
      </Alert>

      {/* ----------------------------------------------------------------- */}
      {/* Export Cards Grid (4 cards) */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {EXPORT_CARDS.map((card, idx) => (
          <motion.div
            key={card.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * (idx + 1) }}
          >
            <Card className={cn(
              'h-full overflow-hidden transition-shadow hover:shadow-md',
              card.highlight && 'ring-1 ring-emerald-400/40',
            )}>
              <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', card.iconTint)}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  {card.highlight && (
                    <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-[9px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Sparkles className="h-2.5 w-2.5" /> Featured
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-3 font-display text-base font-semibold leading-tight sm:text-lg">
                  {card.title}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {card.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="flex flex-wrap gap-2">
                  {card.formats.map((fmt) => {
                    const key = `${card.type}-${fmt.format}`
                    const isBusy = !!busy[key]
                    return (
                      <Button
                        key={fmt.format}
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(card.type, fmt.format)}
                        disabled={isBusy}
                        className="gap-1.5 text-xs"
                        aria-label={`Export ${card.title} as ${fmt.label}`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <fmt.icon className="h-3.5 w-3.5" />
                        )}
                        {fmt.label}
                      </Button>
                    )
                  })}
                </div>
                <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{card.permissionNote}</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Printable Official Result Sheet — prominent CTA */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Card className="votewise-card-glow overflow-hidden border-emerald-500/30">
          <CardHeader className="p-5 sm:p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="font-display text-lg font-bold sm:text-xl">
                    Printable Official Result Sheet
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This is the official certified result sheet that can be printed and posted publicly.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Public — no login required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The printable sheet opens in a new tab with a clean, government-document-style layout. Use your browser's
              <kbd className="mx-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">Ctrl/Cmd + P</kbd>
              to print or save as PDF. It includes the VoteWise header, election metadata, certified results per position
              with winners highlighted, turnout statistics, and the cryptographic audit hash for independent verification.
            </p>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ExternalLink className="h-3 w-3" /> Public Link
                </div>
                <code className="mt-1 block truncate rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-foreground">
                  {printableLink}
                </code>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPrintableLink}
                  className="gap-1.5"
                  aria-label="Copy public printable link"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Link
                </Button>
                <Button
                  onClick={openPrintableSheet}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  aria-label="Open the printable result sheet in a new tab"
                >
                  <Printer className="h-4 w-4" /> Generate Printable Result Sheet
                </Button>
              </div>
            </div>

            {printableUrl && (
              <Alert>
                <ScrollText className="h-4 w-4" />
                <AlertTitle>Manual copy</AlertTitle>
                <AlertDescription className="break-all font-mono text-[11px]">
                  {printableUrl}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <FeatureChip icon={FileText} label="Certified Results" hint="Per position with winners" />
              <FeatureChip icon={Users} label="Turnout Statistics" hint="Eligible, voted, percentage" />
              <FeatureChip icon={Shield} label="Audit Hash" hint="SHA-256 integrity signature" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureChip({ icon: Icon, label, hint }: { icon: any; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </div>
  )
}
