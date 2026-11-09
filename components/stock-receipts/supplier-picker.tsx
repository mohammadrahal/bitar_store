'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { PhoneInput } from '@/components/shared/phone-input'
import { useActiveSuppliers, useCreateSupplier } from '@/hooks/use-suppliers'
import { validateSupplier } from '@/services/suppliers.service'
import type { ApiSupplier } from '@/lib/api/types'

/**
 * Who sent the delivery, picked from `GET /suppliers`.
 *
 * The supplier used to be free text, so the same company arrived as "Al Amin",
 * "al amin textiles" and "AlAmin Tex", and nothing could total a year of
 * deliveries from any of them. Now it is a record, and this picker is how one
 * is chosen.
 *
 * A supplier that is not on the list is added **here**, with one request, and
 * is selected straight away: a first delivery from a new company is the normal
 * case, and sending someone to an admin screen and back to type two fields
 * would lose the receipt they were in the middle of.
 */
export function SupplierPicker({
  value,
  onChange,
}: {
  /** The chosen supplier, or `null` before one is picked. */
  value: ApiSupplier | null
  onChange: (supplier: ApiSupplier | null) => void
}) {
  const suppliers = useActiveSuppliers()
  const create = useCreateSupplier()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const rows = suppliers.data ?? []
  /* A supplier switched off after this receipt was started is still the right
     answer for it, so the chosen one is always a chip even if it is not listed. */
  const chips = value && !rows.some((row) => row.id === value.id) ? [value, ...rows] : rows

  const submit = () => {
    const problem = validateSupplier({ name, phone })
    if (problem) {
      setError(problem)
      return
    }
    const taken = chips.find((row) => row.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (taken) {
      setError(`${taken.name} is already on the list. Pick it above.`)
      return
    }
    setError(null)
    create.mutate(
      { name, phone },
      {
        onSuccess: (supplier) => {
          onChange(supplier)
          setName('')
          setPhone('')
          setAdding(false)
        },
      },
    )
  }

  return (
    <>
      {suppliers.isPending ? (
        <p className="field-hint">Loading suppliers…</p>
      ) : chips.length > 0 ? (
        <div className="chip-row" role="group" aria-label="Suppliers">
          {chips.map((supplier) => {
            const chosen = supplier.id === value?.id
            return (
              <button
                key={supplier.id}
                type="button"
                className="chip chip-lg"
                aria-pressed={chosen}
                title={supplier.phone ?? supplier.name}
                onClick={() => onChange(chosen ? null : supplier)}
              >
                {supplier.name}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="field-hint">No suppliers yet. Add the one who sent this delivery.</p>
      )}

      {adding ? (
        <div className="stack gap-sm">
          <div className="inline-add">
            <Field label="Supplier name" error={error ?? undefined}>
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
                placeholder="Al Amin Textiles"
                autoFocus
              />
            </Field>
            <button type="button" className="btn btn-primary" disabled={create.isPending} onClick={submit}>
              <Plus size={16} aria-hidden="true" />
              {create.isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={create.isPending}
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
            >
              Cancel
            </button>
          </div>
          <Field label="Phone" hint="Who to call about this delivery. Required.">
            <PhoneInput value={phone} onChange={setPhone} disabled={create.isPending} />
          </Field>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden="true" />
          New supplier
        </button>
      )}
    </>
  )
}
