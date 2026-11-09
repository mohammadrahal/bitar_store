'use client'

import { Panel } from '@/components/shared/panel'
import { formatPrice } from '@/lib/format'
export function NewProductSummary({
  name,
  code,
  combos,
  unitCost,
  sellPrice,
  pending,
  error,
  onSaveAndAddAnother,
}: {
  name: string
  code?: string
  combos: { color: string; size: string }[]
  unitCost?: number
  sellPrice: number
  prices?: Record<string, number>
  pending: boolean
  /** The first form error, repeated here because the button sits far from the field. */
  error?: string
  /** Save and keep the form open for the next model in the same run. */
  onSaveAndAddAnother?: () => void
}) {
  const codeLabel = code?.trim() ? code.trim() : 'Assigned on save'

  return (
    <Panel title="Summary" description="Review before you create variants on the server." className="new-model-summary-panel">
      <div className="panel-body stack">
        <dl className="dl-grid new-model-summary-dl">
          <dt>Model</dt>
          <dd>{name.trim() || '—'}</dd>
          <dt>Code</dt>
          <dd className={code?.trim() ? 'tabular' : 'muted'}>{codeLabel}</dd>
          {unitCost !== undefined ? (
            <>
              <dt>Unit cost</dt>
              <dd className="tabular">{Number.isFinite(unitCost) ? formatPrice(unitCost) : ''}</dd>
            </>
          ) : null}
          <dt>Sell price</dt>
          <dd className="tabular new-model-summary-sell">{Number.isFinite(sellPrice) ? formatPrice(sellPrice) : '—'}</dd>
          <dt>Variants</dt>
          <dd className="tabular">{combos.length}</dd>
          <dt>Media assets</dt>
          <dd className="muted">Not uploaded yet</dd>
        </dl>
        <p className="muted new-model-summary-foot">
          Each active variant gets its own SKU and price. Opening stock only posts to the location you chose.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary new-model-summary-submit" disabled={pending}>
          {pending ? 'Saving…' : `Create model with ${combos.length} ${combos.length === 1 ? 'variant' : 'variants'}`}
        </button>
        {onSaveAndAddAnother && (
          <button type="button" className="btn btn-secondary new-model-summary-secondary" disabled={pending} onClick={onSaveAndAddAnother}>
            Save and add another
          </button>
        )}
      </div>
    </Panel>
  )
}
