'use client'

import { useEffect, useMemo, useState } from 'react'
import { QtyStepper } from '@/components/sales/qty-stepper'
import { SearchInput } from '@/components/shared/search-input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useSaleModels, useSaleVariants } from '@/hooks/use-sale-picker'
import { formatPrice } from '@/lib/format'
import { lineTotal } from '@/lib/money'
import { compareSizes } from '@/lib/sizes'
import type { VariantOption } from '@/types'

/**
 * Pick a model from the catalog, then color and size. Availability comes from
 * `GET /stock` for every SKU on that style — not from a truncated variant search.
 */
export function SaleItemCard({
  branchId,
  inCart,
  onAdd,
  /** Sales and warehouse dispatch cap quantity to sellable at `branchId`. Replenishment only shows counts. */
  availability = 'enforce',
  addLabel = 'Add to sale',
  embedded = false,
}: {
  branchId: string
  inCart: Record<string, number>
  onAdd: (option: VariantOption, quantity: number) => void
  availability?: 'enforce' | 'inform'
  addLabel?: string
  /** Fits inside an invoice sheet instead of a till card. */
  embedded?: boolean
}) {
  const enforceStock = availability === 'enforce'
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input)
  const modelsQuery = useSaleModels(search)
  const [productId, setProductId] = useState<string | null>(null)
  const variantsQuery = useSaleVariants(branchId, productId)
  const [color, setColor] = useState<string | null>(null)
  const [size, setSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const models = modelsQuery.data ?? []
  const options = variantsQuery.data ?? []

  useEffect(() => {
    if (!productId) return
    if (models.some((model) => model.productId === productId)) return
    setProductId(null)
    setColor(null)
    setSize(null)
  }, [models, productId])

  const colors = useMemo(() => [...new Set(options.map((option) => option.color))], [options])
  const sizes = useMemo(
    () => [...new Set(options.filter((option) => option.color === color).map((option) => option.size))].sort(compareSizes),
    [options, color],
  )
  const leftOf = (option: VariantOption) => Math.max(0, (option.available ?? 0) - (inCart[option.variantId] ?? 0))
  const chosen = options.find((option) => option.color === color && option.size === size)
  const left = chosen ? leftOf(chosen) : 0
  const maxQty = enforceStock ? left : 9999
  const qty = chosen ? (enforceStock ? Math.min(quantity, maxQty) : Math.max(1, quantity)) : 0
  const previewTotal = chosen ? lineTotal({ quantity: qty, unitPrice: chosen.sellPrice }) : 0

  const pickModel = (id: string) => {
    setProductId(id)
    setColor(null)
    setSize(null)
    setQuantity(1)
  }

  const sectionClass = embedded ? 'invoice-line-picker' : 'sale-card'

  if (!branchId) {
    return (
      <section className={sectionClass} aria-label="Add an item">
        <p className="muted">Choose the selling location above before adding items.</p>
      </section>
    )
  }

  const loadingModels = modelsQuery.isPending
  const loadingVariants = Boolean(productId && variantsQuery.isPending)

  return (
    <section className={sectionClass} aria-label="Add an item">
      <SearchInput
        className="search-field--full"
        value={input}
        onChange={setInput}
        placeholder="Search model, code or SKU"
        aria-label="Search models"
      />
      {loadingModels ? (
        <p className="muted">Loading models…</p>
      ) : modelsQuery.isError ? (
        <p className="field-error">Models could not be loaded. Check the connection and try again.</p>
      ) : models.length === 0 ? (
        <p className="muted">No active models match.</p>
      ) : (
        <div className="chip-row" role="group" aria-label="Model">
          {models.map((model) => (
            <button
              key={model.productId}
              type="button"
              className="chip chip-lg"
              aria-pressed={model.productId === productId}
              onClick={() => pickModel(model.productId)}
            >
              <span className="chip-code tabular">{model.productCode}</span>
              {model.productName}
            </button>
          ))}
        </div>
      )}

      {productId && loadingVariants && <p className="muted">Loading sizes…</p>}
      {productId && variantsQuery.isError && (
        <p className="field-error">Could not load variants for this model.</p>
      )}

      {productId && !loadingVariants && !variantsQuery.isError && options.length === 0 && (
        <p className="muted">This model has no active sizes yet.</p>
      )}

      {productId && options.length > 0 && (
        <div className="chip-row" role="group" aria-label="Color">
          {colors.map((entry) => (
            <button
              key={entry}
              type="button"
              className="chip chip-lg"
              aria-pressed={entry === color}
              onClick={() => {
                setColor(entry)
                setSize(null)
                setQuantity(1)
              }}
            >
              {entry}
            </button>
          ))}
        </div>
      )}
      {color && (
        <>
          <div className="chip-row" role="group" aria-label="Size">
            {sizes.map((entry) => {
              const option = options.find((candidate) => candidate.color === color && candidate.size === entry)
              const available = option ? leftOf(option) : 0
              const none = !option || (enforceStock && available === 0)
              return (
                <button
                  key={entry}
                  type="button"
                  className="chip chip-lg tabular"
                  aria-pressed={entry === size}
                  disabled={none}
                  onClick={() => {
                    setSize(entry)
                    setQuantity(1)
                  }}
                >
                  {entry}
                  {!option ? (
                    <span className="chip-count">—</span>
                  ) : enforceStock && available === 0 ? (
                    <span className="chip-count">Out of stock</span>
                  ) : (
                    <span className="chip-count">{available} here</span>
                  )}
                </button>
              )
            })}
          </div>
          {enforceStock &&
            sizes.every((entry) => {
              const option = options.find((candidate) => candidate.color === color && candidate.size === entry)
              return !option || leftOf(option) === 0
            }) && (
              <p className="field-hint">
                Counts come from <code>GET /stock</code> for the selected branch (sellable units). If everything is zero
                but you expect stock, check Inventory for that branch or post opening stock — the backend owns these
                numbers, not the browser cache.
              </p>
            )}
          {!enforceStock &&
            sizes.every((entry) => {
              const option = options.find((candidate) => candidate.color === color && candidate.size === entry)
              return option && leftOf(option) === 0
            }) && (
              <p className="field-hint">
                Zero here means your branch has none on hand (from the API). You can still add lines — that is what a
                replenishment request is for.
              </p>
            )}
        </>
      )}

      {chosen && (enforceStock ? left > 0 : true) && (
        <>
          <div className="sale-card-head">
            <span>
              <strong>{chosen.productName}</strong>
              <small className="tabular">
                {chosen.color} / {chosen.size} · {chosen.sku}
              </small>
            </span>
            <span>
              <span className="sale-price" aria-live="polite">
                {formatPrice(previewTotal)}
              </span>
              {qty > 1 && (
                <small className="tabular">
                  {qty} × {formatPrice(chosen.sellPrice)}
                </small>
              )}
            </span>
          </div>
          <QtyStepper value={qty} max={maxQty} onChange={setQuantity} label="Quantity" />
          <button
            type="button"
            className="btn btn-dashed"
            onClick={() => {
              onAdd(chosen, qty)
              setSize(null)
              setQuantity(1)
            }}
          >
            {addLabel}
          </button>
        </>
      )}
    </section>
  )
}
