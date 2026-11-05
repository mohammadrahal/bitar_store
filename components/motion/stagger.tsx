'use client'

import { motion, useReducedMotion, type Variants } from 'motion/react'
import { EASE, ITEM_DURATION, STAGGER_STEP } from '@/components/motion/transition'

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: STAGGER_STEP } } }

/** Exported so a card component can be its own stagger item. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: ITEM_DURATION, ease: EASE } },
}

/**
 * Wraps a short set of cards or tiles that should arrive one after the other.
 * `as="ul"` is for a set that is genuinely a list, so the stagger does not cost
 * the markup its list semantics.
 */
export function StaggerList({
  children,
  className,
  as = 'div',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'ul'
  'aria-label'?: string
}) {
  const reduce = useReducedMotion()
  const shared = {
    className,
    variants: container,
    initial: reduce ? (false as const) : ('hidden' as const),
    animate: 'show' as const,
    'aria-label': ariaLabel,
  }
  if (as === 'ul') return <motion.ul {...shared}>{children}</motion.ul>
  return <motion.div {...shared}>{children}</motion.div>
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  )
}
