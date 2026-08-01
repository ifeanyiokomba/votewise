'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// VoteWise — Professional Logo Loader
// Concept: a circular-masked cutout of the hero image (diverse people around a
// ballot box) spins into view. As it settles, a gold checkmark "stamps" onto
// the center (the ballot box), then the circular mark shrinks + the VoteWise
// wordmark fades in, and the whole composition fades to reveal the app.
//
// Total visible: ~1.9s. Smooth, cinematic, branded.

const LOAD_DURATION = 1900 // ms

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
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          {/* Soft ambient backdrop glow */}
          <motion.div
            className="pointer-events-none absolute h-[340px] w-[340px] rounded-full bg-primary/8 blur-3xl"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          <div className="relative flex flex-col items-center">
            {/* === Spinning circular hero cutout + stamping checkmark === */}
            <motion.div
              className="relative h-[140px] w-[140px]"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Circular masked hero image — spins 360° */}
              <motion.div
                className="absolute inset-0 overflow-hidden rounded-full ring-4 ring-primary/15 shadow-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
              >
                <img
                  src="/hero-platform.png"
                  alt=""
                  className="h-full w-full scale-125 object-cover"
                  aria-hidden="true"
                />
                {/* Darkening overlay so the checkmark + logo pop */}
                <div className="absolute inset-0 bg-primary/35" />
              </motion.div>

              {/* Gold checkmark — "stamps" onto the center as the image settles */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                initial={{ scale: 0, opacity: 0, rotate: -25 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{
                  delay: 1.0,
                  duration: 0.35,
                  ease: [0.34, 1.56, 0.64, 1], // back-out overshoot = "stamp" feel
                }}
              >
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  {/* Glow halo behind checkmark */}
                  <circle cx="22" cy="22" r="20" fill="#ffffff" fillOpacity="0.18" />
                  <path
                    d="M13 23 L19 29 L31 16"
                    stroke="#ffffff"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </motion.div>

              {/* Stamp impact ring — quick expand on impact */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 2.2, 2.6], opacity: [0.8, 0.3, 0] }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 1.0, times: [0, 0.5, 1] }}
              />
            </motion.div>

            {/* === Brand wordmark — fades in after the stamp === */}
            <motion.div
              className="mt-6 flex flex-col items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 1.25 }}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-foreground">
                  Vote
                </span>
                <span className="font-display text-xl font-bold tracking-tight text-primary">
                  Wise
                </span>
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
