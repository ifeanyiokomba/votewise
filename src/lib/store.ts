'use client'

import { create } from 'zustand'
import { getVoterToken, setVoterToken as persistVoterToken, getAdminToken, setAdminToken as persistAdminToken, getObserverToken, setObserverToken as persistObserverToken } from '@/lib/api'

export type View =
  | 'home'
  | 'verify'
  | 'vote'
  | 'success'
  | 'verify-receipt'
  | 'admin-login'
  | 'admin'
  | 'observer-login'
  | 'observer'

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

  // election meta
  election: any | null
  settings: any | null
  setElection: (e: any) => void
  setSettings: (s: any) => void

  // live results (from socket)
  live: LiveResults | null
  setLive: (l: LiveResults | null) => void

  // voter flow
  voterToken: string | null
  setVoterToken: (t: string | null) => void
  voterProfile: any | null
  setVoterProfile: (p: any | null) => void

  // admin
  adminToken: string | null
  setAdminToken: (t: string | null) => void
  admin: any | null
  setAdmin: (a: any | null) => void

  // observer
  observerToken: string | null
  setObserverToken: (t: string | null) => void
  observer: any | null
  setObserver: (o: any | null) => void

  // receipts (from last cast vote)
  lastReceipts: any[] | null
  setLastReceipts: (r: any[] | null) => void

  // hydrate from localStorage
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

  adminToken: null,
  setAdminToken: (t) => { persistAdminToken(t); set({ adminToken: t }) },
  admin: null,
  setAdmin: (a) => set({ admin: a }),

  observerToken: null,
  setObserverToken: (t) => { persistObserverToken(t); set({ observerToken: t }) },
  observer: null,
  setObserver: (o) => set({ observer: o }),

  lastReceipts: null,
  setLastReceipts: (r) => set({ lastReceipts: r }),

  hydrate: () => {
    set({
      voterToken: getVoterToken(),
      adminToken: getAdminToken(),
      observerToken: getObserverToken(),
    })
  },
}))
