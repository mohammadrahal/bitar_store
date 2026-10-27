'use client'

import { Minus, Plus } from 'lucide-react'

/** 44px steppers for a phone. Plus stops at what is available here. */
export function QtyStepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number
  max: number
  onChange: (value: number) => void
  label: string
}) {
  const atCap = value >= max
  return (
    <div className="qty-row">
      <div className="qty-stepper" role="group" aria-label={label}>
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="One fewer">
          <Minus size={18} />
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" onClick={() => onChange(value + 1)} disabled={atCap} aria-label="One more">
          <Plus size={18} />
        </button>
      </div>
      <small className={`qty-hint tabular ${atCap ? 'at-cap' : ''}`}>
        {atCap ? `Only ${max} available` : `${max} available here`}
      </small>
    </div>
  )
}
