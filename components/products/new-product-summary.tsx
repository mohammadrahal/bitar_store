'use client'

import { Panel } from '@/components/shared/panel'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'
import { buildVariantCode } from '@/lib/sku'

export function NewProductSummary({
  name,
  combos,
  costPrice,
  sellPrice,
  prices = {},
  pending,
  error,
}: {
  name: string
  combos: { color: string; size: string }[]
  costPrice: number
  sellPrice: number
  prices?: Record<string, number>
  pending: boolean
  /** The first form error, repeated here because the button sits far from the field. */
  error?: string
}) {
  const showCost = usePermission().can('products:read-cost')
  const margin = sellPrice > 0 && costPrice > 0 ? Math.round(((sellPrice - costPrice) / sellPrice) * 100) : null

  return (
    <Panel title="Summary" description="The model code is assigned when you save.">
      <div className="panel-body stack">
        <dl className="dl-grid">
          <dt>Model</dt>
          <dd>{name.trim() || '—'}</dd>
          <dt>Code</dt>
          <dd className="muted">Assigned on save</dd>
          <dt>Sell price</dt>
          <dd className="tabular">{Number.isFinite(sellPrice) ? formatPrice(sellPrice) : '—'}</dd>
          {showCost && margin !== null && (
            <>
              <dt>Margin</dt>
              <dd className="tabular">{margin}%</dd>
            </>
          )}
          <dt>Variants</dt>
          <dd className="tabular">{combos.length}</dd>
        </dl>
        {combos.length > 0 && (
          <ul className="summary-list" aria-label="Variants to create">
            {combos.map((combo) => {
              const key = `${combo.color}|${combo.size}`
              const price = prices[key] ?? sellPrice
              return (
                <li key={key}>
                  <span>
                    {combo.color} / {combo.size}
                  </span>
                  <small className="tabular">
                    {Number.isFinite(price) ? formatPrice(price) : '—'} · {buildVariantCode(combo.color, combo.size)}
                  </small>
                </li>
              )
            })}
          </ul>
        )}
        <p className="muted">Each variant is created with its own price. Opening units go only to the branches you picked.</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : `Create model with ${combos.length} ${combos.length === 1 ? 'variant' : 'variants'}`}
        </button>
      </div>
    </Panel>
  )
}
