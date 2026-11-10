'use client'

import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { formatLbp } from '@/lib/format'
import { useExchangeRate } from '@/hooks/use-settings'
import { usdToLbp } from '@/services/settings.service'
import { amountsOf, changeDue, type PaymentDraft } from '@/lib/sale-payments'
import { toCents } from '@/lib/money'

export function InvoicePaymentReadout({ payment, total }: { payment?: PaymentDraft; total: number }) {
  const rate = useExchangeRate().rate
  const changeLbp = payment ? usdToLbp(changeDue(payment, total, rate), rate) : null

  if (!payment || toCents(total) <= 0) {
    return (
      <section className="invoice-payment-section" aria-label="Payment">
        <h2>Payment</h2>
        <p className="invoice-muted">Payment not recorded on this invoice.</p>
      </section>
    )
  }

  const { cash, whish } = amountsOf(payment, total)
  const change = changeDue(payment, total, rate)

  return (
    <section className="invoice-payment-section" aria-label="Payment">
      <h2>Payment</h2>
      <dl className="invoice-payment-lines">
        {toCents(cash) > 0 && (
          <>
            <div>
              <dt>Cash</dt>
              <dd className="tabular">
                <PriceWithLbp usd={cash} exchangeRateUsdLbp={rate} />
              </dd>
            </div>
            <div>
              <dt>Cash received</dt>
              <dd className="tabular">
                <PriceWithLbp usd={payment.tendered} exchangeRateUsdLbp={rate} />
              </dd>
            </div>
            {change > 0 && (
              <div>
                <dt>Change</dt>
                <dd className="tabular">
                  <PriceWithLbp usd={change} exchangeRateUsdLbp={rate} />
                  {changeLbp != null ? <small className="muted block">≈ {formatLbp(changeLbp)} LBP</small> : null}
                </dd>
              </div>
            )}
          </>
        )}
        {toCents(whish) > 0 && (
          <>
            <div>
              <dt>Whish</dt>
              <dd className="tabular">
                <PriceWithLbp usd={whish} exchangeRateUsdLbp={rate} />
              </dd>
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
