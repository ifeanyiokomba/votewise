'use client'

import { create } from 'zustand'
import { getVoterToken, setVoterToken as persistVoterToken } from '@/lib/api'
import type { Language } from '@/lib/i18n'

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
  | 'about'
  | 'signup'
  | 'official-login'
  | 'official'
  | 'organizations'       // Public organizations directory
  | 'workspace'           // Chapter 2: Organization Workspace dashboard
  | 'onboarding'          // Chapter 6: First-login onboarding wizard
  | 'voter-portal'        // Chapter 8: Self-service voter portal
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
  receiptChannel: string | null
  setReceiptChannel: (c: string | null) => void

  // i18n — current UI language (persisted to localStorage under
  // 'votewise.language'). Defaults to 'en'. Loaded on init by hydrate().
  language: Language
  setLanguage: (lang: Language) => void

  hydrate: () => void
}

const LANGUAGE_STORAGE_KEY = 'votewise.language'

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  try {
    const v = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (v === 'en' || v === 'fr' || v === 'yo' || v === 'ha' || v === 'ig') return v
  } catch {
    // localStorage may be unavailable (private mode, sandbox) — fall back to default.
  }
  return 'en'
}

function writeStoredLanguage(lang: Language) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // ignore write failures (private mode, sandbox)
  }
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
  receiptChannel: null,
  setReceiptChannel: (c) => set({ receiptChannel: c }),

  language: 'en',
  setLanguage: (lang) => {
    writeStoredLanguage(lang)
    set({ language: lang })
  },

  hydrate: () => {
    // Check URL for ?view= param (for redirects from workspace pages)
    let initialView: View | undefined
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const viewParam = params.get('view')
      if (viewParam) {
        initialView = resolveView(viewParam as View)
      }
    }
    set({
      voterToken: getVoterToken(),
      language: readStoredLanguage(),
      ...(initialView ? { view: initialView } : {}),
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
