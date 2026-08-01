'use client'

import { useEffect, useState } from 'react'
import {
  Zap, CheckCircle2, XCircle, Clock, TrendingUp, Loader2, ArrowLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function OtvpAnalytics({ subdomain }: { subdomain?: string }) {
  // OTVP analytics dashboard — shows generated, delivered, failed, avg delivery time, retry rate.
  // Data comes from the VotingCredential model (Chapter 3).
  // For now, we show a simulated dashboard structure that will be populated
  // when real OTVP data exists.

  const stats = {
    generated: 0,
    delivered: 0,
    failed: 0,
    avgDelivery: 3, // seconds
    retryRate: 0.2, // percent
    successRate: 0, // percent
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Zap className="h-6 w-6 text-primary" /> OTVP Analytics</h1>
        <p className="text-sm text-muted-foreground">One-Time Voting Password delivery metrics across all elections.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox icon={Zap} label="Generated" value={stats.generated.toLocaleString()} colour="bg-primary/10 text-primary" />
        <StatBox icon={CheckCircle2} label="Delivered" value={stats.delivered.toLocaleString()} colour="bg-emerald-100 text-emerald-700" />
        <StatBox icon={XCircle} label="Failed" value={stats.failed.toLocaleString()} colour="bg-red-100 text-red-700" />
        <StatBox icon={Clock} label="Avg Delivery" value={`${stats.avgDelivery}s`} colour="bg-blue-100 text-blue-700" />
        <StatBox icon={TrendingUp} label="Retry Rate" value={`${stats.retryRate}%`} colour="bg-amber-100 text-amber-700" />
        <StatBox icon={CheckCircle2} label="Success Rate" value={`${stats.successRate}%`} colour="bg-emerald-100 text-emerald-700" />
      </div>

      {/* Delivery by channel */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="font-display text-base">Delivery by Channel</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { channel: 'Email', icon: '✉️', generated: 0, delivered: 0, colour: 'bg-blue-500' },
            { channel: 'SMS', icon: '📱', generated: 0, delivered: 0, colour: 'bg-emerald-500' },
            { channel: 'WhatsApp', icon: '💬', generated: 0, delivered: 0, colour: 'bg-green-500' },
          ].map((ch) => (
            <div key={ch.channel} className="flex items-center gap-3">
              <span className="text-lg">{ch.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{ch.channel}</span>
                  <span className="text-xs text-muted-foreground">{ch.delivered}/{ch.generated} delivered</span>
                </div>
                <Progress value={ch.generated > 0 ? (ch.delivered / ch.generated) * 100 : 0} className="mt-1 h-1.5" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Multi-channel priority configuration */}
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Delivery Priority</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Configure the order of OTVP delivery channels. If the primary channel fails, the system automatically retries on the fallback.</p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1"><span className="text-emerald-600">●</span> Primary: WhatsApp</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="gap-1"><span className="text-blue-600">●</span> Fallback 1: SMS</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="gap-1"><span className="text-muted-foreground">●</span> Fallback 2: Email</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">Automatic retry is enabled. The system waits 30 seconds between retries.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, colour }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn('grid h-8 w-8 place-items-center rounded-lg', colour)}><Icon className="h-4 w-4" /></div>
        <div className="mt-2 font-display text-xl font-bold">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
