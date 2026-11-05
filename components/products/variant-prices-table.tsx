'use client'

import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { comboKey } from '@/schemas/product.schema'

/**
 * A price per variant, for the models whose sizes do not all sell for the same
 * amount. Blank keeps the model's default. Nothing here places stock: a new
 * model starts at zero everywhere and is stocked through an opening count or a
 * supplier receipt (BL-01).
 */
export function VariantPricesTable({
  combos,
  prices,
  costs,
  defaultPrice,
  defaultCost,
  onPriceChange,
  onCostChange,
}: {
  combos: { color: string; size: string }[]
  prices: Record<string, number>
  costs?: Record<string, number>
  /** Used for any variant that has not been given its own price. */
  defaultPrice: number
  defaultCost?: number
  onPriceChange: (next: Record<string, number>) => void
  onCostChange?: (next: Record<string, number>) => void
}) {
  const showCosts = Boolean(onCostChange && defaultCost !== undefined)

  const setPrice = (key: string, text: string) => {
    const next = { ...prices }
    if (text === '') delete next[key]
    else next[key] = Number(text)
    onPriceChange(next)
  }

  const setCost = (key: string, text: string) => {
    if (!onCostChange) return
    const next = { ...(costs ?? {}) }
    if (text === '') delete next[key]
    else next[key] = Number(text)
    onCostChange(next)
  }

  const pagination = usePagination(combos, 20)

  if (combos.length === 0) return <p className="muted">Pick colors and sizes to set prices.</p>

  return (
    <>
    <div className="table-wrap opening-grid">
      <table className="variant-grid">
        <caption className="sr-only">
          {showCosts ? 'Cost and sell price per variant.' : 'Sell price per variant. Leave blank to use the model price.'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            {showCosts ? <th scope="col">Cost</th> : null}
            <th scope="col">Sell price</th>
          </tr>
        </thead>
        <tbody>
          {pagination.visible.map(({ color, size }) => {
            const key = comboKey(color, size)
            return (
              <tr key={key}>
                <th scope="row">
                  {color} / {size}
                </th>
                {showCosts ? (
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="tabular"
                      value={costs?.[key] ?? (Number.isFinite(defaultCost) && defaultCost! > 0 ? defaultCost : '')}
                      placeholder="0"
                      onChange={(event) => setCost(key, event.target.value)}
                      aria-label={`Unit cost of ${color} / ${size}`}
                    />
                  </td>
                ) : null}
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="tabular"
                    value={prices[key] ?? (Number.isFinite(defaultPrice) && defaultPrice > 0 ? defaultPrice : '')}
                    placeholder="0"
                    onChange={(event) => setPrice(key, event.target.value)}
                    aria-label={`Sell price of ${color} / ${size}`}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    <Pagination
      page={pagination.page}
      pageCount={pagination.pageCount}
      total={pagination.total}
      pageSize={pagination.pageSize}
      onPage={pagination.setPage}
    />
    </>
  )
}
