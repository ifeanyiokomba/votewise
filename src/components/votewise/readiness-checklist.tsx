'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2, Circle, Lock, Zap, Building2, Shield, Vote, Users,
  Trophy, Eye, Palette, CreditCard, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ChecklistItem {
  label: string
  icon: any
  status: 'done' | 'partial' | 'pending'
  pct?: number
  required: boolean
  detail?: string
}

export function ReadinessChecklist({ data }: { data: any }) {
  const stats = data?.stats || {}
  const org = data?.organization || {}

  const items: ChecklistItem[] = [
    { label: 'Organization Setup', icon: Building2, status: 'done', required: true, detail: 'Name, branding, domain configured' },
    { label: 'Organization Structure', icon: Shield, status: stats.totalUnits > 0 ? 'done' : 'pending', required: false, detail: stats.totalUnits > 0 ? `${stats.totalUnits} units created` : 'Optional — skip for single-org elections' },
    { label: 'Election Created', icon: Vote, status: stats.totalElections > 0 ? 'done' : 'pending', required: true, detail: stats.totalElections > 0 ? `${stats.totalElections} elections` : 'Create your first election' },
    { label: 'Voters Imported', icon: Users, status: stats.totalVoters > 0 ? 'done' : 'pending', required: true, detail: stats.totalVoters > 0 ? `${stats.totalVoters.toLocaleString()} voters` : 'Import your voter register' },
    { label: 'Candidates Added', icon: Trophy, status: 'pending', required: true, detail: 'Add candidates to positions' },
    { label: 'Observers Assigned', icon: Eye, status: stats.observerCount > 0 ? 'done' : 'pending', required: false, detail: stats.observerCount > 0 ? `${stats.observerCount} observers` : 'Optional but recommended' },
    { label: 'Branding Complete', icon: Palette, status: org.logoUrl ? 'done' : 'pending', required: false, detail: org.logoUrl ? 'Logo uploaded' : 'Optional — upload your logo' },
    { label: 'Subscription Paid', icon: CreditCard, status: org.status === 'ACTIVE' ? 'done' : 'pending', required: true, detail: org.status === 'ACTIVE' ? 'Active subscription' : 'Pay to go live (₦500/voter)' },
  ]

  const requiredItems = items.filter((i) => i.required)
  const completedRequired = requiredItems.filter((i) => i.status === 'done').length
  const allRequiredDone = completedRequired === requiredItems.length
  const overallPct = Math.round((items.filter((i) => i.status === 'done').length / items.length) * 100)

  return (
    <Card className="votewise-card-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Election Readiness</CardTitle>
          <Badge variant={allRequiredDone ? 'default' : 'secondary'} className="gap-1">
            {allRequiredDone ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {completedRequired}/{requiredItems.length} required
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overall progress */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium text-primary">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>

        {/* Checklist items */}
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
              <div className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', item.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                {item.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.required ? <Badge variant="outline" className="text-[9px] text-destructive">Required</Badge> : <Badge variant="outline" className="text-[9px]">Optional</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Go Live gate */}
        <div className={cn('rounded-lg border-2 p-4 transition-all', allRequiredDone ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-muted bg-muted/30')}>
          <div className="flex items-center gap-3">
            {allRequiredDone ? (
              <Zap className="h-8 w-8 text-emerald-600" />
            ) : (
              <Lock className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="font-display text-sm font-bold">{allRequiredDone ? 'Ready to Go Live!' : 'Go Live Locked'}</div>
              <div className="text-xs text-muted-foreground">
                {allRequiredDone
                  ? 'All required steps are complete. Click to publish your election.'
                  : `Complete ${requiredItems.length - completedRequired} more required step${requiredItems.length - completedRequired > 1 ? 's' : ''} to go live.`}
              </div>
            </div>
            <Button disabled={!allRequiredDone} className={cn('gap-2', allRequiredDone && 'bg-emerald-600 hover:bg-emerald-700')}>
              {allRequiredDone ? <Zap className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {allRequiredDone ? 'Go Live' : 'Locked'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
