'use client'

import { formatPrice } from '@/lib/format'
import { amountsOf, changeDue, type PaymentDraft } from '@/lib/sale-payments'
import { toCents } from '@/lib/money'

export function InvoicePaymentReadout({ payment, total }: { payment?: PaymentDraft; total: number }) {
  if (!payment || toCents(total) <= 0) {
    return (
      <section className="invoice-payment-section" aria-label="Payment">
        <h2>Payment</h2>
        <p className="invoice-muted">Payment not recorded on this invoice.</p>
      </section>
    )
  }

  const { cash, whish } = amountsOf(payment, total)
  const change = changeDue(payment, total)

  return (
    <section className="invoice-payment-section" aria-label="Payment">
      <h2>Payment</h2>
      <dl className="invoice-payment-lines">
        {toCents(cash) > 0 && (
          <>
            <div>
              <dt>Cash</dt>
              <dd className="tabular">{formatPrice(cash)}</dd>
            </div>
            <div>
              <dt>Cash received</dt>
              <dd className="tabular">{formatPrice(payment.tendered)}</dd>
            </div>
            {change > 0 && (
              <div>
                <dt>Change</dt>
                <dd className="tabular">{formatPrice(change)}</dd>
              </div>
            )}
          </>
        )}
        {toCents(whish) > 0 && (
          <>
            <div>
              <dt>Whish</dt>
              <dd className="tabular">{formatPrice(whish)}</dd>
            </div>
            <div>
              <dt>Whish reference</dt>
              <dd>{payment.whishReference.trim() || ''}</dd>
            </div>
          </>
        )}
      </dl>
    </section>
  )
}
