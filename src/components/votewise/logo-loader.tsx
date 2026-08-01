'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// VoteWise — "The Morph" Logo Loader
// A sophisticated transformation: a circle (community) morphs into the rounded
// square brand mark, the ballot box draws in, a light shimmer sweeps across,
// and the checkmark completes the verification. Clean, premium, ~1.7s.

const LOAD_DURATION = 1700 // ms

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
          {/* Ambient soft glow */}
          <motion.div
            className="pointer-events-none absolute h-[300px] w-[300px] rounded-full bg-primary/8 blur-3xl"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />

          <div className="relative flex flex-col items-center">
            {/* === The Morphing Mark === */}
            <div className="relative h-[96px] w-[96px]">
              {/* Circle → Rounded Square morph via borderRadius + slight rotate */}
              <motion.div
                className="absolute inset-0 bg-primary shadow-xl"
                style={{ borderRadius: '50%' }}
                initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  rotate: 0,
                  borderRadius: '24%',
                }}
                transition={{
                  scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.3 },
                  rotate: { duration: 0.6, ease: 'easeOut' },
                  borderRadius: { duration: 0.55, ease: [0.4, 0, 0.2, 1], delay: 0.25 },
                }}
              />

              {/* Inner depth gradient (fades in after morph) */}
              <motion.div
                className="absolute inset-0 rounded-[24px]"
                style={{
                  background: 'linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.12) 100%)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.55 }}
              />

              {/* Ballot box slot + body (draw in after morph settles) */}
              <motion.svg
                width="96"
                height="96"
                viewBox="0 0 120 120"
                fill="none"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.65 }}
              >
                {/* Slot */}
                <motion.rect
                  x="48" y="44" width="24" height="6" rx="3"
                  fill="#b45309"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: 0.7 }}
                />
                {/* Gold ballot box body */}
                <motion.path
                  d="M40 56 H80 V82 Q80 86 76 86 H44 Q40 86 40 82 Z"
                  fill="#d97706"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut', delay: 0.75 }}
                  style={{ transformOrigin: '60px 86px' }}
                />
              </motion.svg>

              {/* White checkmark — draws itself (the verification moment) */}
              <motion.svg
                width="96"
                height="96"
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
                    pathLength: { duration: 0.4, ease: 'easeInOut', delay: 1.0 },
                    opacity: { duration: 0.1, delay: 1.0 },
                  }}
                />
              </motion.svg>

              {/* Diagonal shimmer sweep across the mark */}
              <motion.div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 1.15 }}
              >
                <motion.div
                  className="absolute -inset-y-4 -left-1/3 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  initial={{ x: '-20%' }}
                  animate={{ x: '320%' }}
                  transition={{ duration: 0.6, ease: 'easeInOut', delay: 1.15 }}
                />
              </motion.div>
            </div>

            {/* === Brand wordmark === */}
            <motion.div
              className="mt-6 flex flex-col items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 1.3 }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-display text-lg font-bold tracking-tight text-foreground">Vote</span>
                <span className="font-display text-lg font-bold tracking-tight text-primary">Wise</span>
              </div>
              <motion.p
                className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.3em] text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.45 }}
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
