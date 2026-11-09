'use client'

import { useEffect, useState } from 'react'
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react'

type AnimatedNumberProps = {
  value: number
  format?: (value: number) => string
  className?: string
}

/**
 * Counts up to `value` on change. Keeps formatted output stable for currency and
 * integers via the optional `format` callback.
 */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(0)
  const [text, setText] = useState(() => (format ? format(0) : '0'))

  useMotionValueEvent(motionValue, 'change', (latest) => {
    setText(format ? format(latest) : String(Math.round(latest)))
  })

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 1.35, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, motionValue])

  return <span className={className}>{text}</span>
}
