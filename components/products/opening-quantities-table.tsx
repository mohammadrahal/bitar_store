'use client'

import { comboKey } from '@/schemas/product.schema'

/**
 * Counted units per variant, placed at one location when the model is saved.
 * The server opens a SKU once, and a brand-new SKU has never moved, so this is
 * the one moment a model can be given stock without a separate count.
 */
export function OpeningQuantitiesTable({
  combos,
  quantities,
  onChange,
  disabled,
}: {
  combos: { color: string; size: string }[]
  quantities: Record<string, number>
  onChange: (next: Record<string, number>) => void
  disabled?: boolean
}) {
  if (combos.length === 0) return <p className="muted">Pick colors and sizes to count them in.</p>

  const setQuantity = (key: string, text: string) => {
    const next = { ...quantities }
    const parsed = Math.floor(Number(text))
    if (text === '' || !Number.isFinite(parsed) || parsed <= 0) delete next[key]
    else next[key] = parsed
    onChange(next)
  }

  return (
    <div className="table-wrap opening-grid">
      <table className="variant-grid">
        <caption className="sr-only">Opening units per variant. Leave blank to place none.</caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            <th scope="col">Units</th>
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
                    step="1"
                    inputMode="numeric"
                    className="tabular"
                    value={quantities[key] ?? ''}
                    placeholder="0"
                    disabled={disabled}
                    onChange={(event) => setQuantity(key, event.target.value)}
                    aria-label={`Opening units of ${color} / ${size}`}
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
