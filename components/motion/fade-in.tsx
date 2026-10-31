'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { EASE, FADE_DURATION } from '@/components/motion/transition'

/**
 * The one entrance config, as props, for a surface that has to keep its own
 * tag — a section, a paragraph — instead of being wrapped in a div.
 */
export function useFadeInProps(delay = 0) {
  const reduce = useReducedMotion()
  return {
    initial: reduce ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: FADE_DURATION, ease: EASE, delay },
  }
}

/** A block that fades up on mount. The only entrance used in screens. */
export function FadeIn({ delay = 0, ...props }: HTMLMotionProps<'div'> & { delay?: number }) {
  return <motion.div {...useFadeInProps(delay)} {...props} />
}
