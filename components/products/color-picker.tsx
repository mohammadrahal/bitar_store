'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { colorSchema } from '@/schemas/product.schema'

/**
 * The colours this model comes in. The API stores a colour as a plain string on
 * the SKU, so there is no shared palette: each one is typed in here and the
 * chips are what has been picked so far.
 */
export function ColorPicker({
  value,
  onChange,
  locked = [],
}: {
  value: string[]
  onChange: (colors: string[]) => void
  /** Colours the model already has; shown selected and not removable. */
  locked?: string[]
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const chips = [...new Set([...locked, ...value])]

  const submit = () => {
    const parsed = colorSchema.safeParse({ name })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the colour')
      return
    }
    /* Same colour in another case is the same colour. */
    const taken = chips.find((entry) => entry.toLowerCase() === parsed.data.name.toLowerCase())
    if (taken) {
      setError(`${taken} is already on this model.`)
      return
    }
    setError(null)
    onChange([...value, parsed.data.name])
    setName('')
  }

  return (
    <>
      {chips.length > 0 && (
        <div className="chip-row" role="group" aria-label="Colors">
          {chips.map((color) => {
            const isLocked = locked.includes(color)
            return (
              <button
                key={color}
                type="button"
                className="chip chip-lg"
                aria-pressed
                disabled={isLocked}
                title={isLocked ? `${color} already has variants` : `Remove ${color}`}
                onClick={() => onChange(value.filter((entry) => entry !== color))}
              >
                {color}
              </button>
            )
          })}
        </div>
      )}
      <div className="inline-add">
        <Field label="Add a color" error={error ?? undefined}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
            autoComplete="off"
            placeholder="Terracotta"
          />
        </Field>
        <button type="button" className="btn btn-secondary" onClick={submit}>
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
    </>
  )
}
