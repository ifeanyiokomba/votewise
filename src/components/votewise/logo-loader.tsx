'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// VoteWise — Minimal Logo Loader
// Clean, professional, fast. The logo draws itself in, holds briefly, fades out.
// Total visible: ~1.3s. No wordmark, no progress bar, no pulse ring — just the mark.

const LOAD_DURATION = 1300 // ms

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
          <motion.svg
            width="72"
            height="72"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.08, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Green rounded square */}
            <rect x="6" y="6" width="108" height="108" rx="28" fill="#15803d" />
            {/* Slot */}
            <rect x="48" y="44" width="24" height="6" rx="3" fill="#b45309" />
            {/* Gold ballot box */}
            <path
              d="M40 56 H80 V82 Q80 86 76 86 H44 Q40 86 40 82 Z"
              fill="#d97706"
            />
            {/* White checkmark — draws itself */}
            <motion.path
              d="M50 70 L58 78 L72 62"
              stroke="#ffffff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: 'easeInOut', delay: 0.25 }}
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
