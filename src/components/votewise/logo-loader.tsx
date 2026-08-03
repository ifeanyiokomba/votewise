'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// VoteWise — "The Morph" v2 — Refined Logo Loader
// A polished transformation: a ringed circle (community) morphs into the
// gradient rounded-square brand mark. An aura pulses during the morph. The
// ballot box draws in with a subtle bounce. The checkmark completes with a
// flash, a richer shimmer sweeps, and the wordmark reveals letter-by-letter.
// Total: ~1.9s. Premium, choreographed.

const LOAD_DURATION = 1900 // ms

// Easing curves
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const
const STAMP_EASE = [0.34, 1.56, 0.64, 1] as const // back-out overshoot

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
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          {/* === Ambient aura — pulses during the morph === */}
          <motion.div
            className="pointer-events-none absolute h-[320px] w-[320px] rounded-full bg-primary/10 blur-3xl"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.9, 0.5, 0.7], scale: [0.5, 1.1, 0.95, 1] }}
            transition={{ duration: 1.6, ease: EASE_OUT_EXPO, times: [0, 0.4, 0.7, 1] }}
          />

          {/* Expanding ring during morph (community → mark) */}
          <motion.div
            className="pointer-events-none absolute h-[100px] w-[100px] rounded-full border border-primary/30"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.6, 2], opacity: [0, 0.5, 0] }}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.1, times: [0, 0.6, 1] }}
          />

          <div className="relative flex flex-col items-center">
            {/* === The Morphing Mark (108px) === */}
            <div className="relative h-[108px] w-[108px]">
              {/* Gradient rounded square — morphs from a circle */}
              <motion.div
                className="absolute inset-0 shadow-2xl"
                style={{
                  borderRadius: '50%',
                  background: 'linear-gradient(155deg, #16a34a 0%, #15803d 55%, #166534 100%)',
                  boxShadow: '0 12px 40px -8px rgba(21, 128, 61, 0.45)',
                }}
                initial={{ scale: 0.35, opacity: 0, rotate: -50 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  rotate: 0,
                  borderRadius: '26%',
                }}
                transition={{
                  scale: { duration: 0.6, ease: EASE_OUT_EXPO },
                  opacity: { duration: 0.3 },
                  rotate: { duration: 0.7, ease: EASE_OUT_EXPO },
                  borderRadius: { duration: 0.6, ease: EASE_IN_OUT, delay: 0.3 },
                }}
              />

              {/* Top highlight (gloss) */}
              <motion.div
                className="absolute inset-x-3 top-3 h-1/3 rounded-[18px]"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              />

              {/* Ballot box slot — slides down + subtle bounce */}
              <motion.div
                className="absolute left-1/2 top-[36%] h-[5px] w-[22%] -translate-x-1/2 rounded-full bg-[#b45309]"
                initial={{ opacity: 0, y: -8, scaleY: 0.5 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                transition={{ duration: 0.4, ease: STAMP_EASE, delay: 0.75 }}
              />

              {/* Gold ballot box body — draws in from bottom */}
              <motion.svg
                width="108"
                height="108"
                viewBox="0 0 120 120"
                fill="none"
                className="absolute inset-0"
              >
                <motion.path
                  d="M40 56 H80 V82 Q80 86 76 86 H44 Q40 86 40 82 Z"
                  fill="url(#boxGrad)"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ duration: 0.4, ease: STAMP_EASE, delay: 0.82 }}
                  style={{ transformOrigin: '60px 86px' }}
                />
                <defs>
                  <linearGradient id="boxGrad" x1="40" y1="56" x2="80" y2="86" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f59e0b" />
                    <stop offset="1" stopColor="#d97706" />
                  </linearGradient>
                </defs>
              </motion.svg>

              {/* White checkmark — draws itself, then flashes */}
              <motion.svg
                width="108"
                height="108"
                viewBox="0 0 120 120"
                fill="none"
                className="absolute inset-0"
              >
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
                    pathLength: { duration: 0.4, ease: 'easeInOut', delay: 1.05 },
                    opacity: { duration: 0.1, delay: 1.05 },
                  }}
                />
              </motion.svg>

              {/* Checkmark completion flash */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-md"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.8, 2.4], opacity: [0, 0.7, 0] }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 1.4, times: [0, 0.5, 1] }}
              />

              {/* Richer shimmer sweep — brighter, wider, later */}
              <motion.div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 1.5 }}
              >
                <motion.div
                  className="absolute -inset-y-6 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                  initial={{ x: '-10%' }}
                  animate={{ x: '360%' }}
                  transition={{ duration: 0.7, ease: EASE_IN_OUT, delay: 1.5 }}
                />
              </motion.div>
            </div>

            {/* === Brand wordmark — letter-by-letter reveal === */}
            <motion.div
              className="mt-7 flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.65 }}
            >
              <div className="flex items-center gap-0.5">
                {'VoteWise'.split('').map((ch, i) => (
                  <motion.span
                    key={i}
                    className={`font-display text-xl font-medium tracking-tight ${i < 4 ? 'text-foreground' : 'text-primary'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE_OUT_EXPO, delay: 1.65 + i * 0.035 }}
                  >
                    {ch}
                  </motion.span>
                ))}
                <motion.span
                  className="vw-dot font-display text-xl font-medium"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: EASE_OUT_EXPO, delay: 2.05 }}
                >
                  .
                </motion.span>
              </div>
              <motion.p
                className="mt-1 text-[9px] font-medium uppercase tracking-[0.32em] text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.95 }}
              >
                Election Platform
              </motion.p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
