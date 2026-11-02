import { formatPrice } from '@/lib/format'

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
  return (
    <footer className="sale-footer">
      <div className="sale-footer-inner">
        <div className="sale-total">
          <span className="tabular">
            {units} {units === 1 ? 'item' : 'items'}
          </span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <div className="sale-footer-actions">
          {onSavePending && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending || savingPending}
              onClick={onSavePending}
            >
              {savingPending ? 'Saving…' : 'Save pending sale'}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={disabled || pending}>
            {pending ? 'Confirming with the server…' : 'Confirm sale'}
          </button>
        </div>
        {problem ? (
          <small className="field-error">{problem}</small>
        ) : (
          <small>Saved only after the server confirms. Nothing is recorded if this fails.</small>
        )}
      </div>
    </footer>
  )
}
