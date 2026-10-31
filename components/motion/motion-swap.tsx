'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SWAP_DURATION } from '@/components/motion/transition'

/**
 * Crossfades one state of a panel into the next — skeleton to rows, rows to an
 * empty state — with `mode="wait"` so the two never sit on top of each other.
 * `state` names what is on screen ('loading', 'ready', 'empty').
 */
export function MotionSwap({
  state,
  className,
  children,
}: {
  state: string
  className?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()

  if (reduce) return <div className={className}>{children}</div>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={state}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: SWAP_DURATION }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
