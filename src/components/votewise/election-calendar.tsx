'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Vote, AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover'
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface CalendarElection {
  id: string
  name: string
  status?: string
  startTime: string | Date
  endTime: string | Date
  category?: string | null
  electionType?: string | null
  workspace?: { name?: string } | null
}

interface ElectionCalendarProps {
  elections: CalendarElection[]
  subdomain?: string
}

/* ------------------------------------------------------------------ *
 * Status styling — emerald / amber / zinc / dashed palette
 * (NO indigo, NO blue)
 * ------------------------------------------------------------------ */

type StatusKind = 'live' | 'upcoming' | 'completed' | 'draft' | 'cancelled'

interface StatusStyle {
  kind: StatusKind
  label: string
  chipCls: string
  dotCls: string
  pulse: boolean
}

function getStatusStyle(status: string | undefined): StatusStyle {
  const s = (status || 'DRAFT').toUpperCase()
  switch (s) {
    case 'LIVE':
    case 'VOTING':
    case 'OPEN':
      return {
        kind: 'live',
        label: 'Live',
        chipCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/30',
        dotCls: 'bg-emerald-500',
        pulse: true,
      }
    case 'PAUSED':
      return {
        kind: 'live',
        label: 'Paused',
        chipCls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/30',
        dotCls: 'bg-amber-500',
        pulse: false,
      }
    case 'SCHEDULED':
    case 'READY':
    case 'PENDING_REVIEW':
      return {
        kind: 'upcoming',
        label: 'Upcoming',
        chipCls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/30',
        dotCls: 'bg-amber-500',
        pulse: false,
      }
    case 'COMPLETED':
    case 'CERTIFIED':
    case 'ARCHIVED':
      return {
        kind: 'completed',
        label: s === 'ARCHIVED' ? 'Archived' : s === 'CERTIFIED' ? 'Certified' : 'Completed',
        chipCls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300 border-zinc-300/60 dark:border-zinc-500/30',
        dotCls: 'bg-zinc-400',
        pulse: false,
      }
    case 'CANCELLED':
      return {
        kind: 'cancelled',
        label: 'Cancelled',
        chipCls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 border-red-300/60 dark:border-red-500/30',
        dotCls: 'bg-red-500',
        pulse: false,
      }
    case 'DRAFT':
    default:
      return {
        kind: 'draft',
        label: 'Draft',
        chipCls: 'bg-transparent text-muted-foreground border border-dashed border-muted-foreground/40',
        dotCls: 'bg-muted-foreground/50',
        pulse: false,
      }
  }
}

const LEGEND: { kind: StatusKind; label: string; chipCls: string; dotCls: string; pulse: boolean }[] = [
  { kind: 'live',      label: 'Live / Paused',  chipCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-300/60', dotCls: 'bg-emerald-500', pulse: true },
  { kind: 'upcoming',  label: 'Upcoming',       chipCls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-amber-300/60',           dotCls: 'bg-amber-500',  pulse: false },
  { kind: 'completed', label: 'Completed',      chipCls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300 border-zinc-300/60',                 dotCls: 'bg-zinc-400',   pulse: false },
  { kind: 'draft',     label: 'Draft',          chipCls: 'bg-transparent text-muted-foreground border border-dashed border-muted-foreground/40',                 dotCls: 'bg-muted-foreground/50', pulse: false },
]

/* ------------------------------------------------------------------ *
 * Date helpers
 * ------------------------------------------------------------------ */

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay() // 0 = Sunday
  const endPad = 6 - lastDay.getDay()
  const days: Date[] = []
  for (let i = startPad; i > 0; i--) days.push(new Date(year, month, 1 - i))
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  for (let i = 1; i <= endPad; i++) days.push(new Date(year, month + 1, i))
  return days
}

function isElectionOnDay(election: CalendarElection, day: Date): boolean {
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  return start <= endOfDay(day) && end >= startOfDay(day)
}

function fmtRange(start: string | Date, end: string | Date): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const sStr = s.toLocaleDateString(undefined, opts)
  const eStr = e.toLocaleDateString(undefined, opts)
  if (isSameDay(s, e)) return sStr
  if (s.getFullYear() === e.getFullYear()) return `${sStr} → ${eStr}`
  return `${sStr}, ${s.getFullYear()} → ${eStr}, ${e.getFullYear()}`
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function ElectionCalendar({ elections, subdomain }: ElectionCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  })
  const [direction, setDirection] = useState<1 | -1>(1)

  const days = useMemo(
    () => getMonthDays(cursor.year, cursor.month),
    [cursor],
  )

  // Group elections by the days they touch, for quick lookup.
  const electionsByDay = useMemo(() => {
    const map = new Map<string, CalendarElection[]>()
    for (const day of days) {
      const key = day.toISOString()
      const list = elections.filter((e) => isElectionOnDay(e, day))
      if (list.length) map.set(key, list)
    }
    return map
  }, [days, elections])

  // Elections whose start month is the current month (for the list below).
  const monthElections = useMemo(() => {
    return elections
      .filter((e) => {
        const s = new Date(e.startTime)
        return s.getFullYear() === cursor.year && s.getMonth() === cursor.month
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [elections, cursor])

  function goPrev() {
    setDirection(-1)
    setCursor((c) => {
      const m = c.month - 1
      return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m }
    })
  }
  function goNext() {
    setDirection(1)
    setCursor((c) => {
      const m = c.month + 1
      return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m }
    })
  }
  function goToday() {
    setDirection(today.getFullYear() === cursor.year && today.getMonth() === cursor.month ? 1 : (today < new Date(cursor.year, cursor.month, 1) ? 1 : -1))
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
  }

  const monthTitle = `${MONTH_NAMES[cursor.month]} ${cursor.year}`
  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="votewise-card-glow overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-display text-lg font-bold sm:text-xl">
                  Election Calendar
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Visualize all elections across the month.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={goToday}>
                <Calendar className="h-3.5 w-3.5" /> Today
              </Button>
              <div className="ml-1 flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goPrev}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goNext}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar grid card */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Month title row */}
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="font-display text-base font-bold sm:text-lg">
              {monthTitle}
            </h3>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Vote className="h-3 w-3" />
              {monthElections.length} {monthElections.length === 1 ? 'election' : 'elections'} this month
            </Badge>
          </div>

          {/* Horizontal-scroll wrapper for narrow screens */}
          <div className="overflow-x-auto pb-1 votewise-scroll">
            <div className="min-w-[640px]">
              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((w) => (
                  <div
                    key={w}
                    className="rounded-md bg-muted/40 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {w}
                  </div>
                ))}
              </div>

              {/* Days grid with sliding animation on month change */}
              <div className="mt-1.5 grid min-h-[600px] grid-cols-7 gap-1.5">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={`${cursor.year}-${cursor.month}`}
                    custom={direction}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    variants={slideVariants}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="col-span-7 grid grid-cols-7 gap-1.5"
                  >
                    {days.map((day) => (
                      <DayCell
                        key={day.toISOString()}
                        day={day}
                        isToday={isSameDay(day, today)}
                        inMonth={isSameMonth(day, new Date(cursor.year, cursor.month, 1))}
                        elections={electionsByDay.get(day.toISOString()) || []}
                        subdomain={subdomain}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Legend
            </span>
            {LEGEND.map((l) => (
              <div key={l.kind} className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  {l.pulse && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  )}
                  <span className={cn('relative inline-block h-2 w-2 rounded-full', l.dotCls)} />
                </span>
                <span className="text-xs font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current-month election list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
              <Clock className="h-4 w-4 text-primary" />
              Elections in {monthTitle}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">{monthElections.length}</Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {monthElections.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                No elections scheduled in {monthTitle}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try navigating to a different month, or create a new election.
              </p>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border/50 overflow-y-auto votewise-scroll">
              {monthElections.map((e) => {
                const st = getStatusStyle(e.status)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/workspace/elections/${e.id}?org=${subdomain || ''}`
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:px-6"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Vote className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtRange(e.startTime, e.endTime)}
                          </span>
                          {e.electionType && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{e.electionType}</span>
                            </>
                          )}
                          {e.workspace?.name && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{e.workspace.name}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                          st.chipCls,
                        )}
                      >
                        <span className="relative flex h-2 w-2 items-center justify-center">
                          {st.pulse && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                          )}
                          <span className={cn('relative inline-block h-1.5 w-1.5 rounded-full', st.dotCls)} />
                        </span>
                        {st.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Day cell
 * ------------------------------------------------------------------ */

function DayCell({
  day,
  isToday,
  inMonth,
  elections,
  subdomain,
}: {
  day: Date
  isToday: boolean
  inMonth: boolean
  elections: CalendarElection[]
  subdomain?: string
}) {
  const visible = elections.slice(0, 3)
  const hidden = elections.slice(3)
  const hasElections = elections.length > 0

  return (
    <div
      className={cn(
        'group relative flex min-h-[100px] flex-col rounded-lg border border-border/40 p-1.5 transition-colors',
        inMonth ? 'bg-card' : 'bg-muted/20',
        isToday && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background',
        hasElections && 'hover:border-primary/40 hover:shadow-sm',
      )}
    >
      {/* Day number */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-md text-xs tabular-nums',
            isToday
              ? 'bg-primary font-bold text-primary-foreground'
              : inMonth
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground/50',
          )}
        >
          {day.getDate()}
        </span>
        {hasElections && (
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {elections.length}
          </span>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        {visible.map((e) => (
          <ElectionChip key={e.id} election={e} subdomain={subdomain} />
        ))}
        {hidden.length > 0 && (
          <MoreChips day={day} hidden={hidden} subdomain={subdomain} />
        )}
      </div>

      {/* Empty-day hint for accessibility */}
      {!hasElections && (
        <span className="sr-only">No elections on this day.</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Election chip
 * ------------------------------------------------------------------ */

function ElectionChip({
  election,
  subdomain,
}: {
  election: CalendarElection
  subdomain?: string
}) {
  const st = getStatusStyle(election.status)
  const href = `/workspace/elections/${election.id}?org=${subdomain || ''}`
  const name = election.name.length > 18 ? `${election.name.slice(0, 18)}…` : election.name

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          onClick={(ev) => ev.stopPropagation()}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight transition-colors hover:brightness-95',
            st.chipCls,
          )}
        >
          <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
            {st.pulse && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={cn('relative inline-block h-1.5 w-1.5 rounded-full', st.dotCls)} />
          </span>
          <span className="truncate">{name}</span>
        </a>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <div className="space-y-0.5">
          <p className="font-semibold">{election.name}</p>
          <p className="text-[10px] opacity-90">
            <Calendar className="mr-1 inline h-2.5 w-2.5" />
            {fmtRange(election.startTime, election.endTime)}
          </p>
          <p className="text-[10px] opacity-90">Status: {st.label}</p>
          {election.electionType && (
            <p className="text-[10px] opacity-90">Type: {election.electionType}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------------------------------------------ *
 * "+N more" chip → popover with the rest of the day's elections
 * ------------------------------------------------------------------ */

function MoreChips({
  day,
  hidden,
  subdomain,
}: {
  day: Date
  hidden: CalendarElection[]
  subdomain?: string
}) {
  const dateLabel = day.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Show ${hidden.length} more elections on ${dateLabel}`}
        >
          <AlertCircle className="h-2.5 w-2.5" />
          +{hidden.length} more
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-72 p-3"
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold">{dateLabel}</p>
        </div>
        <Separator className="mb-2" />
        <ul className="max-h-64 space-y-1.5 overflow-y-auto votewise-scroll">
          {hidden.map((e) => {
            const st = getStatusStyle(e.status)
            const href = `/workspace/elections/${e.id}?org=${subdomain || ''}`
            return (
              <li key={e.id}>
                <a
                  href={href}
                  className="flex items-start gap-2 rounded-md border border-border/50 p-2 transition-colors hover:bg-muted/40"
                >
                  <span className="relative mt-0.5 flex h-2 w-2 shrink-0 items-center justify-center">
                    {st.pulse && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    )}
                    <span className={cn('relative inline-block h-1.5 w-1.5 rounded-full', st.dotCls)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{e.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {fmtRange(e.startTime, e.endTime)} · {st.label}
                    </p>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
