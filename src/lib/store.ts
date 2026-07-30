'use client'

import { create } from 'zustand'
import { getVoterToken, setVoterToken as persistVoterToken } from '@/lib/api'

export type View =
  | 'home'
  | 'verify'
  | 'vote'
  | 'success'
  | 'verify-receipt'
  | 'voter-dashboard'
  | 'compare'
  | 'certificate'
  | 'guide'
  | 'official-login'
  | 'official'
  // Legacy aliases kept for nav compatibility
  | 'admin-login' | 'admin' | 'observer-login' | 'observer'

export interface LiveResults {
  election: any
  settings: any
  positions: any[]
  turnout: { totalVoters: number; voted: number; turnoutPct: number; remaining: number }
  recentActivity?: any[]
  generatedAt?: string
  hidden?: boolean
}

interface AppState {
  view: View
  setView: (v: View) => void

  election: any | null
  settings: any | null
  setElection: (e: any) => void
  setSettings: (s: any) => void

  live: LiveResults | null
  setLive: (l: LiveResults | null) => void

  // Voter (header-token based)
  voterToken: string | null
  setVoterToken: (t: string | null) => void
  voterProfile: any | null
  setVoterProfile: (p: any | null) => void
  accredited: boolean
  setAccredited: (a: boolean) => void

  // Official (cookie-based; we just track the profile client-side)
  official: any | null
  setOfficial: (o: any | null) => void

  lastReceipts: any[] | null
  setLastReceipts: (r: any[] | null) => void

  hydrate: () => void
}

export const useApp = create<AppState>((set) => ({
  view: 'home',
  setView: (v) => set({ view: v }),

  election: null,
  settings: null,
  setElection: (e) => set({ election: e }),
  setSettings: (s) => set({ settings: s }),

  live: null,
  setLive: (l) => set({ live: l }),

  voterToken: null,
  setVoterToken: (t) => { persistVoterToken(t); set({ voterToken: t }) },
  voterProfile: null,
  setVoterProfile: (p) => set({ voterProfile: p }),
  accredited: false,
  setAccredited: (a) => set({ accredited: a }),

  official: null,
  setOfficial: (o) => set({ official: o }),

  lastReceipts: null,
  setLastReceipts: (r) => set({ lastReceipts: r }),

  hydrate: () => {
    set({
      voterToken: getVoterToken(),
    })
  },
}))

// Convenience: normalize legacy view names to v2.
export function resolveView(v: View): View {
  if (v === 'admin-login') return 'official-login'
  if (v === 'admin') return 'official'
  if (v === 'observer-login') return 'official-login'
  if (v === 'observer') return 'official'
  return v
}
