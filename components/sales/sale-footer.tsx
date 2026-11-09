'use client'

import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { useExchangeRate } from '@/hooks/use-settings'
import { formatLbp } from '@/lib/format'
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
  const rateQuery = useExchangeRate()
  const online = useOnlineStatus()

  return (
    <footer className="sale-footer sale-footer--till">
      <div className="sale-footer-inner">
        {rateQuery.rate !== null ? (
          <p className="sale-footer-rate">
            1 USD = {formatLbp(rateQuery.rate)} · totals show an LBP guide for the customer
          </p>
        ) : null}
        <div className="sale-footer-bar">
          {online ? (
            <span className="sale-footer-scanner">
              <span className="sale-footer-scanner-dot" aria-hidden="true" />
              Scanner active
            </span>
          ) : (
            <span className="sale-footer-scanner sale-footer-scanner--offline">Offline</span>
          )}
          <div className="sale-footer-totals">
            <span className="sale-footer-items-badge tabular">
              {units} {units === 1 ? 'item' : 'items'}
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
                {savingPending ? 'Saving…' : 'Save pending sale'}
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-till sale-footer-btn-confirm" disabled={disabled || pending}>
              {pending ? 'Confirming…' : 'Confirm sale'}
            </button>
          </div>
        </div>
        {problem ? (
          <small className="field-error sale-footer-note">{problem}</small>
        ) : (
          <small className="sale-footer-note">
            Saved only after the server confirms. Nothing is recorded if this fails.
          </small>
        )}
      </div>
    </footer>
  )
}
