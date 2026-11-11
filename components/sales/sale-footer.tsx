'use client'

import { CircleAlert, WifiOff } from 'lucide-react'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { useOnlineStatus } from '@/hooks/use-online-status'

/** Total and the buttons that finish the sale, pinned to the foot of the till ticket. */
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
  /** Why the sale cannot be completed yet, shown above the button. */
  problem?: string
  onSavePending?: () => void
  savingPending?: boolean
}) {
  const online = useOnlineStatus()

  return (
    <div className="sale-checkout">
      <div className="sale-checkout-total">
        <span className="sale-checkout-label">
          Total
          <small className="tabular">
            {units} {units === 1 ? 'item' : 'items'}
          </small>
        </span>
        <PriceWithLbp usd={total} strong className="sale-checkout-price" />
      </div>

      {!online ? (
        <p className="sale-checkout-problem" role="status">
          <WifiOff size={16} aria-hidden="true" />
          You are offline. Sales can be completed once the connection is back.
        </p>
      ) : problem ? (
        <p className="sale-checkout-problem" role="status">
          <CircleAlert size={16} aria-hidden="true" />
          {problem}
        </p>
      ) : null}

      <div className="sale-checkout-actions">
        <button
          type="submit"
          className="btn btn-primary sale-checkout-confirm"
          disabled={disabled || pending}
        >
          {pending ? 'Confirming…' : 'Confirm sale'}
        </button>
        {onSavePending && (
          <button
            type="button"
            className="btn btn-secondary sale-checkout-save"
            disabled={pending || savingPending}
            onClick={onSavePending}
          >
            {savingPending ? 'Saving…' : 'Save for later'}
          </button>
        )}
      </div>
    </div>
  )
}
