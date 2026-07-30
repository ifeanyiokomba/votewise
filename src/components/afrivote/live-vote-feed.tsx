'use client'

import { useEffect, useState } from 'react'
import { Vote, Activity, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface FeedItem { id: string; position: string; positionSlug: string; at: string }

export function LiveVoteFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const d = await api.getVoteFeed()
        if (d.feed.length > 0) {
          const prevIds = new Set(feed.map((f) => f.id))
          const fresh = d.feed.filter((f: FeedItem) => !prevIds.has(f.id))
          if (fresh.length > 0 && feed.length > 0) {
            // Mark new items for highlight animation
            setNewIds(new Set(fresh.map((f: FeedItem) => f.id)))
            setTimeout(() => setNewIds(new Set()), 2000)
          }
          setFeed(d.feed)
        }
        setLoading(false)
      } catch {}
    }
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [feed.length])

  function timeAgo(at: string): string {
    const diff = Date.now() - new Date(at).getTime()
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
  }

  return (
    <Card className="afrivote-card-glow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Live Vote Feed
          </CardTitle>
          <Badge className="gap-1 bg-emerald-100 text-emerald-700">
            <span className="afrivote-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {feed.length} recent
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : feed.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Vote className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2">No votes cast yet</p>
          </div>
        ) : (
          <div className="afrivote-scroll max-h-80 space-y-1 overflow-y-auto">
            {feed.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2 transition-colors',
                  newIds.has(item.id) ? 'border-primary bg-primary/10 animate-in fade-in slide-in-from-top-2 duration-500' : 'border-border/40'
                )}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <Vote className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Vote cast</div>
                  <div className="truncate text-xs text-muted-foreground">{item.position}</div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(item.at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
