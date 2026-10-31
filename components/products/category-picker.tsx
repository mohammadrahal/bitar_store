'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { useCategories } from '@/hooks/use-products'

/**
 * One category per model. The chips are what the catalog already uses; a new
 * one is typed in and comes into being with the first model that carries it,
 * since the API has no category of its own.
 */
export function CategoryPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (category: string) => void
  error?: string
}) {
  const { data: categories, isPending } = useCategories()
  const [name, setName] = useState('')
  const [issue, setIssue] = useState<string | null>(null)

  const known = categories ?? []
  /* A category typed here is not in the catalog yet, so it is shown alongside. */
  const options = value && !known.some((entry) => entry === value) ? [...known, value] : known

  const submit = () => {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setIssue('A category needs at least 2 characters')
      return
    }
    /* Snap to the spelling already in use, so the catalog never grows two of
       the same category in different cases. */
    const existing = known.find((entry) => entry.toLowerCase() === trimmed.toLowerCase())
    setIssue(null)
    onChange(existing ?? trimmed)
    setName('')
  }

  return (
    <>
      {options.length > 0 && (
        <div className="chip-row" role="group" aria-label="Category">
          {options.map((category) => (
            <button
              key={category}
              type="button"
              className="chip chip-lg"
              aria-pressed={value === category}
              onClick={() => onChange(category)}
            >
              {category}
            </button>
          ))}
        </div>
      )}
      {isPending && options.length === 0 && <p className="muted">Loading categories…</p>}
      <div className="inline-add">
        <Field label="Add a category" error={issue ?? error}>
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
            placeholder="Dresses"
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
