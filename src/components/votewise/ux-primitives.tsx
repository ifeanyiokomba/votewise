'use client'

import { motion } from 'framer-motion'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// =========================================================================
// VoteWise v2 — Premium UX Primitives
// Reusable skeleton loaders, empty states, and feedback components
// inspired by Termii's restrained, professional SaaS aesthetic.
// =========================================================================

// --- Premium Spinner with pulsing ring ---
export function PremiumSpinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sz = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Loader2 className={cn('animate-spin text-primary', sz)} />
        <div className={cn('absolute inset-0 animate-ping rounded-full bg-primary/20', sz)} />
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}

// --- Full-page loading state ---
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <PremiumSpinner size="lg" label={label} />
    </div>
  )
}

// --- Card skeleton — mimics a stat card layout ---
export function StatCardSkeleton() {
  return (
    <div className="vw-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

// --- List row skeleton ---
export function ListRowSkeleton({ avatar = true }: { avatar?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      {avatar && <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />}
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
    </div>
  )
}

// --- Card with header skeleton ---
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="vw-card">
      <div className="flex items-center justify-between border-b border-border p-5 pb-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-6 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2 p-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Grid skeleton (for dashboard layouts) ---
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
        </div>
        <div className="space-y-6">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={2} />
        </div>
      </div>
    </div>
  )
}

// --- Empty state — premium with icon, title, description, and CTA ---
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/8 text-primary ring-1 ring-primary/10">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-display text-base font-medium">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {(action || (actionLabel && onAction)) && (
        <div className="mt-5">
          {action || (
            <Button size="sm" onClick={onAction} className="gap-1.5">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// --- Error state — premium with icon, title, description, and retry ---
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="mt-4 font-display text-base font-medium">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-5 gap-1.5">
          {retryLabel}
        </Button>
      )}
    </motion.div>
  )
}

// --- Success state — premium with animated check ---
export function SuccessState({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/40"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <motion.polyline
            points="20 6 9 17 4 12"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          />
        </svg>
      </motion.div>
      <h3 className="mt-4 font-display text-base font-medium">
        {title}<span className="vw-dot">.</span>
      </h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  )
}

// --- Section header with eyebrow label ---
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <div className="vw-eyebrow mb-2">{eyebrow}</div>}
        <h2 className="font-display text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
          {title}<span className="vw-dot">.</span>
        </h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// --- Inline loading dots (for chat / typing indicators) ---
export function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  )
}
