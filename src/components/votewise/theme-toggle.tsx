'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { Moon, Sun, Monitor, Eye, Type, Zap, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'

/**
 * Enhanced Theme Toggle with Accessibility Options.
 *
 * Per the Enterprise Audit Part 3 spec:
 * "Add: Keyboard navigation, Screen reader labels, High contrast mode,
 * Large text mode, Reduced motion, Color-blind friendly charts,
 * Countdown accessibility, WCAG compliance."
 *
 * This toggle provides:
 * - Light / Dark / System theme
 * - High contrast mode (increased contrast for visually impaired)
 * - Large text mode (font-size scaling)
 * - Reduced motion (disables animations)
 */

// Lazy initializers — read from localStorage once on mount without
// triggering a setState-in-effect lint violation.
function readBool(key: string, fallback: boolean = false): boolean {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) === 'true'
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('vw-reduced-motion')
  if (stored !== null) return stored === 'true'
  // Respect OS prefers-reduced-motion if no explicit user choice
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [highContrast, setHighContrast] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Mount: load preferences (runs once)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighContrast(readBool('vw-high-contrast'))
    setLargeText(readBool('vw-large-text'))
    setReducedMotion(readReducedMotion())
    setMounted(true)
  }, [])

  // Apply high contrast
  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('high-contrast', highContrast)
    localStorage.setItem('vw-high-contrast', String(highContrast))
  }, [highContrast, mounted])

  // Apply large text
  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('large-text', largeText)
    localStorage.setItem('vw-large-text', String(largeText))
  }, [largeText, mounted])

  // Apply reduced motion
  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('reduce-motion', reducedMotion)
    localStorage.setItem('vw-reduced-motion', String(reducedMotion))
  }, [reducedMotion, mounted])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme and accessibility">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2">
          <Sun className="h-4 w-4" /> Light
          {theme === 'light' && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2">
          <Moon className="h-4 w-4" /> Dark
          {theme === 'dark' && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2">
          <Monitor className="h-4 w-4" /> System
          {theme === 'system' && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accessibility</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setHighContrast(!highContrast)} className="gap-2">
          <Eye className="h-4 w-4" /> High Contrast
          {highContrast && <Check className="ml-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLargeText(!largeText)} className="gap-2">
          <Type className="h-4 w-4" /> Large Text
          {largeText && <Check className="ml-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setReducedMotion(!reducedMotion)} className="gap-2">
          <Zap className="h-4 w-4" /> Reduced Motion
          {reducedMotion && <Check className="ml-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
