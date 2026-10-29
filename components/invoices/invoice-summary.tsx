import { Can } from '@/components/shared/can'
import { formatPrice } from '@/lib/format'
import type { InvoiceTotals } from '@/types'

/**
 * Document totals, shared by the form and the detail page so a draft and a
 * filed document always add up the same way. Margin is only meaningful on
 * documents priced at sell, so the caller decides whether to ask for it.
 */
export function InvoiceSummary({ totals, showMargin }: { totals: InvoiceTotals; showMargin: boolean }) {
  return (
    <dl className="totals">
      <div>
        <dt>Units</dt>
        <dd className="tabular">{totals.units}</dd>
      </div>
      <div>
        <dt>Subtotal</dt>
        <dd className="tabular">{formatPrice(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div>
          <dt>Discount</dt>
          <dd className="tabular">−{formatPrice(totals.discount)}</dd>
        </div>
      )}
      <div className="totals-row">
        <dt>Total</dt>
        <dd className="tabular">{formatPrice(totals.total)}</dd>
      </div>
      {showMargin && (
        <Can permission="costs.view">
          <div>
            <dt>Cost</dt>
            <dd className="tabular">{formatPrice(totals.cost)}</dd>
          </div>
          <div>
            <dt>Margin</dt>
            <dd className="tabular">{formatPrice(totals.margin)}</dd>
          </div>
        </Can>
      )}
    </dl>
  )
}
