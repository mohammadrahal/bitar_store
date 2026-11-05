import { PriceWithLbp } from '@/components/shared/price-with-lbp'

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
          <PriceWithLbp usd={total} strong />
        </div>
        <div className="sale-footer-actions">
          {onSavePending && (
            <button
              type="button"
              className="btn btn-secondary btn-till"
              disabled={pending || savingPending}
              onClick={onSavePending}
            >
              {savingPending ? 'Saving…' : 'Save pending sale'}
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-till" disabled={disabled || pending}>
            {pending ? 'Confirming…' : 'Confirm sale'}
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
