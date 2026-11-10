'use client'

import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function SaleFooter({
  total,
  units,
  pending,
  disabled,
  problem,
  onSavePending,
  savingPending,
}: {
  total: number
  units: number
  pending: boolean
  disabled: boolean
  /** Why the sale cannot be completed yet, shown beside the button. */
  problem?: string
  onSavePending?: () => void
  savingPending?: boolean
}) {
  const online = useOnlineStatus()

  return (
    <footer className="sale-footer sale-footer--till">
      <div className="sale-footer-inner">
        <div className="sale-footer-bar">
          <div className="sale-footer-totals">
            <span className="sale-footer-items-badge tabular">
              {units} {units === 1 ? 'item' : 'items'}
              {!online ? ' · Offline' : ''}
            </span>
            <PriceWithLbp usd={total} strong className="sale-footer-price" />
          </div>
          <div className="sale-footer-actions">
            {onSavePending && (
              <button
                type="button"
                className="btn btn-secondary btn-till sale-footer-btn-outline"
                disabled={pending || savingPending}
                onClick={onSavePending}
              >
                {savingPending ? 'Saving…' : 'Save for later'}
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-till sale-footer-btn-confirm" disabled={disabled || pending}>
              {pending ? 'Confirming…' : 'Confirm sale'}
            </button>
          </div>
        </div>
        {problem ? <small className="field-error sale-footer-note">{problem}</small> : null}
      </div>
    </footer>
  )
}
