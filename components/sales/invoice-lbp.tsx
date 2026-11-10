'use client'

import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import type { ApiInvoicePayment } from '@/lib/api/types'
import { formatLbp, formatPrice, formatUsdLbpRate } from '@/lib/format'

export function invoicePaymentMethodLabel(payment: ApiInvoicePayment): string {
  if (payment.method === 'whish') {
    return payment.reference ? `Whish (${payment.reference})` : 'Whish'
  }
  if (payment.currency === 'LBP') return 'Cash in pounds'
  return 'Cash'
}

export function InvoicePaymentAmount({
  payment,
  exchangeRateUsdLbp,
}: {
  payment: ApiInvoicePayment
  exchangeRateUsdLbp?: number | null
}) {
  if (payment.currency === 'LBP' && payment.lbpAmount != null) {
    return (
      <div className="invoice-amount-stack invoice-amount-stack--lbp-primary">
        <span className="tabular invoice-amount-primary">{formatLbp(payment.lbpAmount)}</span>
        <small className="price-lbp tabular">= {formatPrice(Number(payment.amount))}</small>
        {payment.changeLbp != null && payment.changeLbp > 0 ? (
          <small className="muted tabular invoice-amount-change">Change {formatLbp(payment.changeLbp)} LBP</small>
        ) : null}
      </div>
    )
  }

  return <PriceWithLbp usd={Number(payment.amount)} exchangeRateUsdLbp={exchangeRateUsdLbp} />
}

export function InvoiceLbpFootnote({
  exchangeRate,
}: {
  exchangeRate?: number | null
}) {
  if (exchangeRate == null || exchangeRate <= 0) return null
  return (
    <p className="muted text-sm invoice-lbp-footnote">
      LBP at checkout: {formatUsdLbpRate(exchangeRate)}.
    </p>
  )
}
