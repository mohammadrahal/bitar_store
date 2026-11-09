'use client'

import type { LucideIcon } from 'lucide-react'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'

export type StepperStep = {
  id: number
  title: string
  icon?: LucideIcon
}

export function Stepper({
  value,
  onValueChange,
  steps,
  className,
  disabled,
  'aria-label': ariaLabel = 'Progress',
}: {
  value: number
  onValueChange?: (step: number) => void
  steps: StepperStep[]
  className?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  const interactive = Boolean(onValueChange) && !disabled

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('stepper-root', className)}
    >
      {steps.map((step, index) => {
        const Icon = step.icon
        const isCurrent = value === step.id
        const isComplete = value > step.id
        const isFuture = value < step.id

        const node = (
          <>
            {interactive ? (
              <button
                type="button"
                className={cn('stepper-node', isComplete && 'stepper-node--complete', isCurrent && 'stepper-node--current', isFuture && 'stepper-node--future')}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.title}${isComplete ? ', completed' : isCurrent ? ', current step' : ', not started'}`}
                disabled={disabled}
                onClick={() => onValueChange?.(step.id)}
              >
                <span className="stepper-node-circle" aria-hidden="true">
                  {Icon ? <Icon className="stepper-node-icon" strokeWidth={2} aria-hidden="true" /> : null}
                </span>
                <span className="stepper-node-title">{step.title}</span>
              </button>
            ) : (
              <div
                className={cn('stepper-node', isComplete && 'stepper-node--complete', isCurrent && 'stepper-node--current', isFuture && 'stepper-node--future')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="stepper-node-circle" aria-hidden="true">
                  {Icon ? <Icon className="stepper-node-icon" strokeWidth={2} aria-hidden="true" /> : null}
                </span>
                <span className="stepper-node-title">{step.title}</span>
              </div>
            )}
          </>
        )

        return (
          <Fragment key={step.id}>
            {node}
            {index < steps.length - 1 ? (
              <div
                className="stepper-connector"
                data-complete={isComplete ? 'true' : 'false'}
                aria-hidden="true"
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
