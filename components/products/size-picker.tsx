'use client'

import { SIZE_SYSTEMS } from '@/lib/sizes'
import type { SizeSystem } from '@/types'

const SYSTEMS = Object.entries(SIZE_SYSTEMS) as [SizeSystem, { label: string; sizes: string[] }][]

/** One size system per model; switching systems clears the picked sizes. */
export function SizePicker({
  system,
  sizes,
  onSystemChange,
  onChange,
  lockSystem = false,
  locked = [],
}: {
  system: SizeSystem
  sizes: string[]
  onSystemChange: (system: SizeSystem) => void
  onChange: (sizes: string[]) => void
  lockSystem?: boolean
  locked?: string[]
}) {
  const options = SIZE_SYSTEMS[system].sizes
  const toggle = (size: string) => {
    const next = sizes.includes(size) ? sizes.filter((entry) => entry !== size) : [...sizes, size]
    onChange(options.filter((option) => next.includes(option)))
  }

  return (
    <>
      {!lockSystem && (
        <div className="segmented" role="radiogroup" aria-label="Size system">
          {SYSTEMS.map(([key, entry]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={key === system}
              className={key === system ? 'active' : ''}
              onClick={() => {
                if (key === system) return
                onSystemChange(key)
                onChange(key === 'one' ? SIZE_SYSTEMS.one.sizes : [])
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}
      <div className="chip-row" role="group" aria-label="Sizes">
        {options.map((size) => {
          const isLocked = locked.includes(size)
          return (
            <button
              key={size}
              type="button"
              className="chip chip-lg tabular"
              aria-pressed={isLocked || sizes.includes(size)}
              disabled={isLocked}
              onClick={() => toggle(size)}
            >
              {size}
            </button>
          )
        })}
      </div>
    </>
  )
}
