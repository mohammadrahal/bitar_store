'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { EASE, ITEM_DURATION, STAGGER_LIMIT, STAGGER_STEP } from '@/components/motion/transition'

/**
 * Rows stagger in on the first paint of a dataset only. A background refetch or
 * a narrowing filter keeps the same tbody mounted, so rows arriving after the
 * entrance window has passed are rendered without an animation of their own.
 */
const SettledContext = createContext(false)

/* The longest the entrance can run: the capped stagger plus one row. */
const ENTER_WINDOW_MS = (STAGGER_LIMIT * STAGGER_STEP + ITEM_DURATION) * 1000

const body: Variants = { hidden: {}, show: {} }

const row: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: ITEM_DURATION,
      ease: EASE,
      /* A long table would otherwise crawl: only the first screenful waits. */
      delay: index < STAGGER_LIMIT ? index * STAGGER_STEP : 0,
    },
  }),
}

/**
 * A tbody whose rows arrive in sequence. `dataset` names which set of rows is
 * on screen — the branch and page, never the rows themselves — and the
 * entrance replays only when that name changes.
 */
export function MotionTbody({
  dataset = 'initial',
  className,
  children,
}: {
  dataset?: string
  className?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    setSettled(false)
    const timer = setTimeout(() => setSettled(true), ENTER_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [dataset])

  return (
    <SettledContext.Provider value={settled || Boolean(reduce)}>
      <motion.tbody
        key={dataset}
        className={className}
        variants={body}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {children}
      </motion.tbody>
    </SettledContext.Provider>
  )
}

/** A table row that fades up in its turn. `index` is its place in the list. */
export function MotionTr({
  index = 0,
  children,
  ...props
}: React.ComponentProps<typeof motion.tr> & { index?: number }) {
  const settled = useContext(SettledContext)
  return (
    <motion.tr variants={row} custom={index} initial={settled ? false : undefined} {...props}>
      {children}
    </motion.tr>
  )
}
