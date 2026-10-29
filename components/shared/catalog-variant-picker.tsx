'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { SearchInput } from '@/components/shared/search-input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { queryKeys } from '@/lib/query-keys'
import { searchVariants } from '@/services/products.service'
import type { VariantOption } from '@/types'

const LIMIT = 8

/**
 * Catalog variants with no regard for what is in stock, for the flows that are
 * about stock a location does not have: a replenishment request, a supplier
 * receipt. Use `VariantPicker` where availability has to cap the quantity.
 */
export function CatalogVariantPicker({
  excluded,
  onPick,
  label = 'Search variants to add',
}: {
  excluded: string[]
  onPick: (option: VariantOption) => void
  label?: string
}) {
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input)
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.products.variants(`${search}|${LIMIT}`),
    queryFn: () => searchVariants(search, LIMIT),
  })

  return (
    <div className="stack">
      <SearchInput
        className="search-field--full"
        value={input}
        onChange={setInput}
        placeholder="Search model, code, SKU, color or size"
        aria-label={label}
      />
      {isPending ? (
        <p className="muted">Searching…</p>
      ) : isError ? (
        <p className="field-error">Variants could not be loaded.</p>
      ) : data.length === 0 ? (
        <p className="muted">No active variants match.</p>
      ) : (
        <ul className="picker-list" aria-label="Matching variants">
          {data.map((option) => {
            const added = excluded.includes(option.variantId)
            return (
              <li key={option.variantId} className="picker-row">
                <span>
                  <strong>
                    {option.productName} {option.color} / {option.size}
                  </strong>
                  <small className="tabular">{option.sku}</small>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={added}
                  onClick={() => onPick(option)}
                  aria-label={`Add ${option.productName} ${option.color} / ${option.size}`}
                >
                  <Plus size={14} aria-hidden="true" />
                  {added ? 'Added' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
