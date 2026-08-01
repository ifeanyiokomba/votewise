'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Users, Layers, Network, Globe, Loader2, ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// Public organizations directory — shows all active organizations on VoteWise.
export function OrganizationsView() {
  const { setView } = useApp()
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    api.listOrganizations().then((d) => setOrgs(d.organizations || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = orgs.filter((o) =>
    !q || o.name.toLowerCase().includes(q.toLowerCase()) ||
    (o.category || '').toLowerCase().includes(q.toLowerCase()) ||
    (o.description || '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      <div className="mb-8 text-center">
        <Badge variant="secondary" className="mb-2 gap-1"><Globe className="h-3.5 w-3.5" /> Live Directory</Badge>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Organizations on VoteWise</h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Real organizations running their elections on VoteWise. The system never knows or cares which type they are.
        </p>
      </div>

      <div className="mb-6 flex justify-center">
        <div className="w-full max-w-md">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations…" className="text-center" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">No organizations found.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <Card key={o.id} className="h-full transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  {o.logoUrl ? (
                    <img src={o.logoUrl} alt={o.name} className="h-12 w-12 rounded-xl object-contain" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ backgroundColor: o.primaryColour }}>
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-sm font-semibold">{o.name}</h3>
                    <Badge variant="outline" className="mt-0.5 text-[10px]">{(o.category || 'ORGANIZATION').replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
                {o.description && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{o.description}</p>}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {o._count?.members || 0} members</span>
                  <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {o._count?.workspaces || 0} workspaces</span>
                  <span className="flex items-center gap-1"><Network className="h-3 w-3" /> {o._count?.voterGroups || 0} groups</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <Globe className="h-3 w-3" /> {o.subdomain}.votewise.ng
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Button size="lg" onClick={() => setView('signup')} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Sparkles className="h-5 w-5" /> Register Your Organization
        </Button>
      </div>
    </div>
  )
}
