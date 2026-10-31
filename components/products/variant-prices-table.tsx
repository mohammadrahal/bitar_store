'use client'

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
  defaultPrice,
  onPriceChange,
}: {
  combos: { color: string; size: string }[]
  prices: Record<string, number>
  /** Used for any variant that has not been given its own price. */
  defaultPrice: number
  onPriceChange: (next: Record<string, number>) => void
}) {
  if (combos.length === 0) return <p className="muted">Pick colors and sizes to set prices.</p>

  const setPrice = (key: string, text: string) => {
    const next = { ...prices }
    if (text === '') delete next[key]
    else next[key] = Number(text)
    onPriceChange(next)
  }

  return (
    <div className="table-wrap opening-grid">
      <table className="variant-grid">
        <caption className="sr-only">Sell price per variant. Leave blank to use the model price.</caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {combos.map(({ color, size }) => {
            const key = comboKey(color, size)
            return (
              <tr key={key}>
                <th scope="row">
                  {color} / {size}
                </th>
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
  )
}
