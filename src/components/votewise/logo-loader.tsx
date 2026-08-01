'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// VoteWise — Transformative Logo Loader
// Shown during initial app load. Animation sequence:
//  1. Green rounded square scales up from center (spring)
//  2. Gold ballot box fades + scales in
//  3. Slot appears on top of the box
//  4. White checkmark draws itself (SVG path animation)
//  5. Pulse ring expands outward
//  6. "VoteWise" wordmark + tagline fade in
//  7. Progress bar fills
//  8. Entire loader fades out + scales up, revealing the app

const LOAD_DURATION = 2800 // ms — total visible time before fade-out

export function LogoLoader({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, LOAD_DURATION)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Subtle radial glow behind the logo */}
          <motion.div
            className="pointer-events-none absolute h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          <div className="relative flex flex-col items-center">
            {/* === Animated Logo SVG === */}
            <motion.svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
              className="relative z-10"
            >
              {/* 1. Green rounded square background */}
              <motion.rect
                x="6" y="6" width="108" height="108" rx="28"
                fill="#15803d"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
                style={{ transformOrigin: '60px 60px' }}
              />
              {/* Subtle inner gradient overlay for depth */}
              <motion.rect
                x="6" y="6" width="108" height="108" rx="28"
                fill="url(#bgGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              />
              <defs>
                <linearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* 2. Slot on top of ballot box */}
              <motion.rect
                x="48" y="44" width="24" height="6" rx="3"
                fill="#b45309"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.55 }}
              />

              {/* 3. Gold ballot box body */}
              <motion.path
                d="M40 56 H80 V82 Q80 86 76 86 H44 Q40 86 40 82 Z"
                fill="#d97706"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.5 }}
                style={{ transformOrigin: '60px 86px' }}
              />
              {/* Ballot box inner shadow line for depth */}
              <motion.path
                d="M40 56 H80"
                stroke="#92400e"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.7 }}
              />

              {/* 4. White checkmark — draws itself (path animation) */}
              <motion.path
                d="M50 70 L58 78 L72 62"
                stroke="#ffffff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { duration: 0.6, ease: 'easeInOut', delay: 0.85 },
                  opacity: { duration: 0.1, delay: 0.85 },
                }}
              />
            </motion.svg>

            {/* 5. Expanding pulse ring */}
            <motion.div
              className="pointer-events-none absolute left-1/2 top-[60px] h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-2 border-primary/40"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: [1, 1.8, 2.4], opacity: [0.6, 0.2, 0] }}
              transition={{ duration: 1.6, ease: 'easeOut', delay: 1, times: [0, 0.6, 1] }}
            />

            {/* 6. Wordmark + tagline */}
            <motion.div
              className="mt-7 flex flex-col items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 1.2 }}
            >
              <div className="flex items-center gap-0.5">
                {'VoteWise'.split('').map((ch, i) => (
                  <motion.span
                    key={i}
                    className="font-display text-2xl font-bold tracking-tight text-foreground"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut', delay: 1.2 + i * 0.04 }}
                  >
                    {ch}
                  </motion.span>
                ))}
              </div>
              <motion.p
                className="mt-1 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.6 }}
              >
                Election Platform
              </motion.p>
            </motion.div>

            {/* 7. Progress bar */}
            <motion.div
              className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.4 }}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.3, ease: 'easeInOut', delay: 1.4 }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
