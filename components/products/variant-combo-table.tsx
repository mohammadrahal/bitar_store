'use client'

import { buildSku, buildVariantCode } from '@/lib/sku'

/** List view of color × size combos (new model), matching the catalog mock. */
export function VariantComboTable({
  combos,
  modelCode,
  isOn,
  onToggle,
  isLocked = () => false,
}: {
  combos: { color: string; size: string }[]
  /** Style code typed on the form; SKU preview uses a placeholder until save assigns one. */
  modelCode: string
  isOn: (color: string, size: string) => boolean
  isLocked?: (color: string, size: string) => boolean
  onToggle: (color: string, size: string) => void
}) {
  if (combos.length === 0) {
    return <p className="muted">Pick at least one color and one size to generate variants.</p>
  }

  const codeBase = modelCode.trim() || 'MD------'

  return (
    <div className="table-wrap new-model-variants-wrap">
      <table className="invoice-picker-table new-model-variants-table">
        <caption className="sr-only">Variants to create. Untick any combination you will not stock.</caption>
        <thead>
          <tr>
            <th scope="col" className="new-model-variants-check">
              <span className="sr-only">Include</span>
            </th>
            <th scope="col">Variant</th>
            <th scope="col">Generated SKU</th>
            <th scope="col" className="num">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {combos.map(({ color, size }) => {
            const locked = isLocked(color, size)
            const on = locked || isOn(color, size)
            const variantCode = buildVariantCode(color, size)
            const sku = buildSku(codeBase, variantCode)
            return (
              <tr key={`${color}|${size}`} className={on ? undefined : 'new-model-variants-row--off'}>
                <td className="new-model-variants-check">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={() => onToggle(color, size)}
                    aria-label={`Include ${color} / ${size}${locked ? ' (already exists)' : ''}`}
                  />
                </td>
                <th scope="row">
                  <span className="new-model-variant-name">
                    {color} – {size}
                  </span>
                </th>
                <td className="tabular invoice-muted">{sku}</td>
                <td className="num">
                  {on ? <span className="new-model-status-pill new-model-status-pill--active">Active</span> : <span className="muted">Excluded</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
