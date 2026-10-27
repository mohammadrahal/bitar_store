import { formatPrice } from '@/lib/format'

export function SaleFooter({
  total,
  units,
  pending,
  disabled,
}: {
  total: number
  units: number
  pending: boolean
  disabled: boolean
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
        <button type="submit" className="btn btn-primary" disabled={disabled || pending}>
          {pending ? 'Confirming with the server…' : 'Confirm sale'}
        </button>
        <small>Saved only after the server confirms. Nothing is recorded if this fails.</small>
      </div>
    </footer>
  )
}
