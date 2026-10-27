'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { useAddColor, useColors } from '@/hooks/use-attributes'
import { colorSchema } from '@/schemas/product.schema'

const DEFAULT_HEX = '#8F8C86'

/** Toggle chips for the shared color list, plus an inline add that rejects case-insensitive duplicates. */
export function ColorPicker({
  value,
  onChange,
  locked = [],
}: {
  value: string[]
  onChange: (colors: string[]) => void
  /** Colors the model already has; shown selected and not removable. */
  locked?: string[]
}) {
  const { data: colors, isPending, isError } = useColors()
  const add = useAddColor()
  const [name, setName] = useState('')
  const [hex, setHex] = useState(DEFAULT_HEX)
  const [error, setError] = useState<string | null>(null)

  const toggle = (color: string) =>
    onChange(value.includes(color) ? value.filter((entry) => entry !== color) : [...value, color])

  const submit = () => {
    const parsed = colorSchema.safeParse({ name, hex })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the color')
      return
    }
    setError(null)
    add.mutate(parsed.data, {
      onSuccess: (created) => {
        onChange([...value, created.name])
        setName('')
      },
      onError: (failure: Error) => setError(failure.message),
    })
  }

  if (isPending) return <p className="muted">Loading colors…</p>
  if (isError) return <p className="field-error">Colors could not be loaded. Reload to try again.</p>

  return (
    <>
      <div className="chip-row" role="group" aria-label="Colors">
        {colors.map((color) => {
          const isLocked = locked.includes(color.name)
          return (
            <button
              key={color.name}
              type="button"
              className="chip chip-lg"
              aria-pressed={isLocked || value.includes(color.name)}
              disabled={isLocked}
              onClick={() => toggle(color.name)}
            >
              <span className="swatch" style={{ background: color.hex }} aria-hidden="true" />
              {color.name}
            </button>
          )
        })}
      </div>
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
        <Field label="Shade">
          <input type="color" value={hex} onChange={(event) => setHex(event.target.value)} />
        </Field>
        <button type="button" className="btn btn-secondary" onClick={submit} disabled={add.isPending}>
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
    </>
  )
}
