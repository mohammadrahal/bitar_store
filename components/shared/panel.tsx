'use client'

import { motion } from 'motion/react'
import { useFadeInProps } from '@/components/motion/fade-in'

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  headingLevel = 2,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** 3 when the panel sits under a section heading of its own. */
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <motion.section className={`panel ${className ?? ''}`} {...useFadeInProps(0.1)}>
      <div className="panel-heading">
        <div>
          <Heading>{title}</Heading>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </motion.section>
  )
}
