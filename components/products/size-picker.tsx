'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { SIZE_SYSTEMS } from '@/lib/sizes'
import { sizeNameSchema } from '@/schemas/product.schema'
import type { SizeSystem } from '@/types'

const SYSTEMS = Object.entries(SIZE_SYSTEMS) as [SizeSystem, { label: string; sizes: string[] }][]

function extrasOf(presets: string[], ...lists: string[][]) {
  const known = new Set(presets)
  const extras: string[] = []
  for (const list of lists) {
    for (const size of list) {
      if (!known.has(size) && !extras.includes(size)) extras.push(size)
    }
  }
  return extras
}

/** Letter, numeric and one-size are views of the same list. Switching does not drop what is already picked. */
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
  const presets = SIZE_SYSTEMS[system].sizes
  const extras = extrasOf(presets, sizes, locked)
  const shown = [...presets, ...extras]
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggle = (size: string) => {
    if (locked.includes(size)) return
    onChange(sizes.includes(size) ? sizes.filter((entry) => entry !== size) : [...sizes, size])
  }

  const addCustom = () => {
    const parsed = sizeNameSchema.safeParse(draft)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the size')
      return
    }
    const name = parsed.data
    const listed = [...presets, ...sizes, ...locked]
    if (listed.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
      setError('That size is already listed')
      return
    }
    setError(null)
    setDraft('')
    setAdding(false)
    onChange([...sizes, name])
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
                setAdding(false)
                setDraft('')
                setError(null)
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}
      <div className="chip-row" role="group" aria-label="Sizes">
        {shown.map((size) => {
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
        <button
          type="button"
          className="chip chip-lg"
          aria-pressed={adding}
          aria-expanded={adding}
          aria-controls="custom-size-add"
          onClick={() => {
            setAdding((open) => !open)
            setError(null)
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Custom
        </button>
      </div>
      {adding && (
        <div className="inline-add" id="custom-size-add">
          <Field label="Custom size" error={error ?? undefined}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addCustom()
                }
              }}
              autoComplete="off"
              placeholder="XXL"
              autoFocus
            />
          </Field>
          <button type="button" className="btn btn-secondary" onClick={addCustom}>
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
      )}
    </>
  )
}
