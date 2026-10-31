'use client'

import { motion } from 'motion/react'
import { useFadeInProps } from '@/components/motion/fade-in'

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.section className={`panel ${className ?? ''}`} {...useFadeInProps(0.1)}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </motion.section>
  )
}
