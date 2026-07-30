'use client'

import { cn } from '@/lib/utils'

// A simple SVG donut chart showing vote share between candidates.
export function VoteShareDonut({ candidates, size = 120 }: { candidates: any[]; size?: number }) {
  const total = candidates.reduce((a: number, c: any) => a + (c.votes || 0), 0)
  if (total === 0) return null

  const radius = size / 2 - 10
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  const colours = [
    'oklch(0.42 0.11 158)',  // emerald (primary)
    'oklch(0.78 0.13 85)',   // gold (accent)
    'oklch(0.55 0.16 250)',  // blue
    'oklch(0.62 0.2 25)',    // terracotta
    'oklch(0.7 0.15 145)',   // sage
    'oklch(0.6 0.18 300)',   // purple
  ]

  // Compute cumulative offsets without mutation using reduce.
  const candidatesTop = candidates.slice(0, 6)
  const segments = candidatesTop.reduce<{ items: any[]; offset: number }>(
    (acc, c, i) => {
      const votes = (c as any).votes || 0
      const pct = votes / total
      const dash = pct * circumference
      const seg = {
        id: (c as any).id,
        name: (c as any).fullName,
        votes,
        pct: Math.round(pct * 1000) / 10,
        colour: colours[i % colours.length],
        dashArray: `${dash} ${circumference - dash}`,
        dashOffset: -acc.offset,
      }
      return { items: [...acc.items, seg], offset: acc.offset + dash }
    },
    { items: [], offset: 0 }
  ).items

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          {/* Segments */}
          {segments.map((s) => (
            <circle
              key={s.id}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.colour}
              strokeWidth="8"
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-bold">{total}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">votes</span>
        </div>
      </div>
      {/* Legend */}
      <div className="min-w-0 flex-1 space-y-1">
        {segments.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.colour }} />
            <span className="truncate">{s.name}</span>
            <span className="ml-auto shrink-0 font-mono text-muted-foreground">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
