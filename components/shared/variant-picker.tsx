'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useStockPicker } from '@/hooks/use-inventory'
import type { VariantOption } from '@/types'

/** Search sellable variants at one location. Archived models never appear; nothing above available can be added. */
export function VariantPicker({
  branchId,
  excluded,
  onPick,
  locationLabel = 'here',
}: {
  branchId: string
  excluded: string[]
  onPick: (option: VariantOption) => void
  locationLabel?: string
}) {
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input)
  const { data, isPending, isError } = useStockPicker(branchId, search, 8)

  if (!branchId) return <p className="muted">Pick the sending location first.</p>

  return (
    <div className="stack">
      <div className="search-field">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search model, code, SKU, color or size"
          aria-label="Search variants to add"
        />
      </div>
      {isPending ? (
        <p className="muted">Searching…</p>
      ) : isError ? (
        <p className="field-error">Variants could not be loaded.</p>
      ) : data.length === 0 ? (
        <p className="muted">No active variants match.</p>
      ) : (
        <ul className="picker-list" aria-label="Matching variants">
          {data.map((option) => {
            const available = option.available ?? 0
            const added = excluded.includes(option.variantId)
            return (
              <li key={option.variantId} className="picker-row">
                <span>
                  <strong>
                    {option.productName} {option.color} / {option.size}
                  </strong>
                  <small className="tabular">
                    {option.sku} · {available} available {locationLabel}
                  </small>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={added || available === 0}
                  onClick={() => onPick(option)}
                  aria-label={`Add ${option.productName} ${option.color} / ${option.size}`}
                >
                  <Plus size={14} aria-hidden="true" />
                  {added ? 'Added' : available === 0 ? 'None available' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
