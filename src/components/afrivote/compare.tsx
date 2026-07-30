'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  ArrowLeft, Trophy, GraduationCap, FileText, Play, X, Check, Minus,
  Users, Building2, PartyPopper, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function CompareCandidatesView() {
  const { setView } = useApp()
  const [positions, setPositions] = useState<any[]>([])
  const [selectedPosId, setSelectedPosId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPositions().then((d) => {
      setPositions(d.positions)
      if (d.positions.length > 0) setSelectedPosId(d.positions[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const selectedPos = positions.find((p) => p.id === selectedPosId)

  if (loading) {
    return <div className="mx-auto flex max-w-5xl items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Compare Candidates</h1>
          <p className="text-sm text-muted-foreground">Side-by-side comparison of manifestos, parties, and credentials.</p>
        </div>
        <div className="w-full sm:w-72">
          <Select value={selectedPosId} onValueChange={setSelectedPosId}>
            <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedPos && selectedPos.candidates.length > 0 ? (
        <div className="afrivote-scroll overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${selectedPos.candidates.length * 280}px` }}>
            {selectedPos.candidates.map((c: any, i: number) => (
              <CandidateCompareCard key={c.id} c={c} position={selectedPos} rank={i + 1} />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 opacity-30" />
            <p className="mt-3">No candidates to compare for this position.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CandidateCompareCard({ c, position, rank }: { c: any; position: any; rank: number }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const partyColour = c.politicalParty?.colour || '#15803d'
  return (
    <>
      <Card className="flex w-72 shrink-0 flex-col overflow-hidden transition-shadow hover:shadow-lg">
        {/* Photo header */}
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <div className="absolute left-0 top-0 z-10 h-full w-1.5" style={{ backgroundColor: partyColour }} />
          {c.photoUrl ? (
            <Image src={c.photoUrl} alt={c.fullName} fill className="object-cover" sizes="280px" />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground"><GraduationCap className="h-12 w-12" /></div>
          )}
          <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-xs font-bold text-white">
            #{rank}
          </div>
          {c.politicalParty && (
            <div className="absolute left-3 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: partyColour }}>
              {c.politicalParty.acronym}
            </div>
          )}
        </div>
        {/* Body */}
        <CardContent className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-base font-bold leading-tight">{c.fullName}</h3>
          <p className="text-xs text-muted-foreground">{position.title}</p>
          {c.slogan && <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{c.slogan}&rdquo;</p>}

          {/* Quick facts */}
          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs">
            <FactRow icon={GraduationCap} label="Level" value={c.level || '—'} />
            <FactRow icon={Building2} label="Party" value={c.politicalParty?.name || 'Non-partisan'} />
            <FactRow icon={Trophy} label="CGPA" value={c.cgpa ? c.cgpa.toFixed(2) : '—'} />
          </div>

          {/* Manifesto preview */}
          <div className="mt-3 flex-1">
            <p className="line-clamp-3 text-xs text-muted-foreground">{c.manifesto || 'No manifesto provided.'}</p>
          </div>

          <Button size="sm" variant="outline" onClick={() => setDetailOpen(true)} className="mt-3 gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Full Details
          </Button>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
          <DialogTitle className="sr-only">{c.fullName} — Candidate Details</DialogTitle>
          <div className="relative h-40 overflow-hidden">
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${partyColour}dd, ${partyColour}55)` }} />
            <button onClick={() => setDetailOpen(false)} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white hover:bg-black/40">
              <X className="h-4 w-4" />
            </button>
            <div className="relative flex h-full items-center gap-4 p-6">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-4 border-white/30 shadow-lg">
                {c.photoUrl ? <Image src={c.photoUrl} alt={c.fullName} fill className="object-cover" sizes="96px" /> : <div className="grid h-full place-items-center bg-white/20 text-white"><GraduationCap className="h-8 w-8" /></div>}
              </div>
              <div className="min-w-0 flex-1 text-white">
                <h2 className="font-display text-2xl font-bold leading-tight">{c.fullName}</h2>
                <p className="text-sm text-white/85">{position.title}{c.level ? ` · ${c.level} Level` : ''}</p>
                {c.slogan && <p className="mt-1 text-sm italic text-white/90">&ldquo;{c.slogan}&rdquo;</p>}
                {c.politicalParty && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#fff' }} />
                    {c.politicalParty.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="afrivote-scroll max-h-[50vh] overflow-y-auto p-6">
            {c.campaignVideoUrl && (
              <div className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><Play className="h-4 w-4 text-primary" /> Campaign Video</h3>
                <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                  <iframe src={embedUrl(c.campaignVideoUrl)} className="h-full w-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                </div>
              </div>
            )}
            <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Manifesto</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.manifesto || 'No manifesto provided.'}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FactRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function embedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  return url
}
