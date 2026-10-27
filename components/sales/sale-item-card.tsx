'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { QtyStepper } from '@/components/sales/qty-stepper'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useStockPicker } from '@/hooks/use-inventory'
import { formatPrice } from '@/lib/format'
import { compareSizes } from '@/lib/sizes'
import type { VariantOption } from '@/types'

/**
 * Pick a model, then a color and a size. Sizes with nothing available here
 * are shown but disabled, and the quantity can never pass what is available.
 */
export function SaleItemCard({
  branchId,
  inCart,
  onAdd,
}: {
  branchId: string
  /** Units of each variant already on the sale, so the cap accounts for them. */
  inCart: Record<string, number>
  onAdd: (option: VariantOption, quantity: number) => void
}) {
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input)
  const { data, isPending, isError } = useStockPicker(branchId, search, 80)
  const [productId, setProductId] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [size, setSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const models = useMemo(() => {
    const seen = new Map<string, VariantOption>()
    for (const option of data ?? []) if (!seen.has(option.productId)) seen.set(option.productId, option)
    return [...seen.values()].slice(0, 8)
  }, [data])
  const options = (data ?? []).filter((option) => option.productId === productId)
  const colors = [...new Set(options.map((option) => option.color))]
  const sizes = [...new Set(options.filter((option) => option.color === color).map((option) => option.size))].sort(compareSizes)
  const leftOf = (option: VariantOption) => Math.max(0, (option.available ?? 0) - (inCart[option.variantId] ?? 0))
  const chosen = options.find((option) => option.color === color && option.size === size)
  const left = chosen ? leftOf(chosen) : 0

  const pickModel = (id: string) => {
    setProductId(id)
    setColor(null)
    setSize(null)
    setQuantity(1)
  }

  return (
    <section className="sale-card" aria-label="Add an item">
      <div className="search-field">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search model, code or SKU" aria-label="Search models" />
      </div>
      {isPending ? (
        <p className="muted">Loading models…</p>
      ) : isError ? (
        <p className="field-error">Models could not be loaded. Check the connection and try again.</p>
      ) : models.length === 0 ? (
        <p className="muted">No active models match.</p>
      ) : (
        <div className="chip-row" role="group" aria-label="Model">
          {models.map((model) => (
            <button key={model.productId} type="button" className="chip chip-lg" aria-pressed={model.productId === productId} onClick={() => pickModel(model.productId)}>
              {model.productName}
            </button>
          ))}
        </div>
      )}

      {productId && (
        <div className="chip-row" role="group" aria-label="Color">
          {colors.map((entry) => (
            <button key={entry} type="button" className="chip chip-lg" aria-pressed={entry === color} onClick={() => { setColor(entry); setSize(null); setQuantity(1) }}>
              {entry}
            </button>
          ))}
        </div>
      )}
      {color && (
        <div className="chip-row" role="group" aria-label="Size">
          {sizes.map((entry) => {
            const option = options.find((candidate) => candidate.color === color && candidate.size === entry)
            const none = !option || leftOf(option) === 0
            return (
              <button key={entry} type="button" className="chip chip-lg tabular" aria-pressed={entry === size} disabled={none} onClick={() => { setSize(entry); setQuantity(1) }}>
                {entry}
                {none && <span className="chip-count">none here</span>}
              </button>
            )
          })}
        </div>
      )}

      {chosen && left > 0 && (
        <>
          <div className="sale-card-head">
            <span>
              <strong>{chosen.productName}</strong>
              <small className="tabular">{chosen.color} / {chosen.size} · {chosen.sku}</small>
            </span>
            <span className="sale-price">{formatPrice(chosen.sellPrice)}</span>
          </div>
          <QtyStepper value={Math.min(quantity, left)} max={left} onChange={setQuantity} label="Quantity" />
          <button
            type="button"
            className="btn btn-dashed"
            onClick={() => {
              onAdd(chosen, Math.min(quantity, left))
              setSize(null)
              setQuantity(1)
            }}
          >
            Add to sale
          </button>
        </>
      )}
    </section>
  )
}
