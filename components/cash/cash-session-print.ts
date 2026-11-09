import { priceOf } from '@/lib/api/map-catalog'
import type { ApiCashSession } from '@/lib/api/types'
import { formatDocumentDate, formatLbp, formatPrice } from '@/lib/format'
import { printHtmlDocument } from '@/lib/print-document'
import { RECEIPT_PRINT_CSS } from '@/lib/print-styles'
import { cachedExchangeRate, usdToLbp } from '@/services/settings.service'

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Mid-shift audit (X): totals only, drawer may stay open. */
export function printCashSessionXReport(session: ApiCashSession, kind: 'x' | 'z' = 'x') {
  const totals = session.totals
  if (!totals) return
  const opening = priceOf(session.openingCash)
  const expected = priceOf(totals.expectedCash)
  const rate = cachedExchangeRate()
  const expectedLbp = usdToLbp(expected, rate)
  const salesTotal = priceOf(totals.salesTotal)
  const cashPay = priceOf(totals.cashPayments)
  const whish = priceOf(totals.whishPayments)
  const title = kind === 'z' ? 'Z-Report' : 'X-Report (midday audit)'
  const status = session.status === 'open' ? 'OPEN' : 'CLOSED'

  const inner = `
    <style>${RECEIPT_PRINT_CSS}</style>
    <div class="receipt-sheet"><div class="receipt">
      <p class="brand">Bitar Fashion</p>
      <header>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">
          ${escapeHtml(session.branch.name)}<br/>
          ${status} · ${formatDocumentDate(session.openedAt)}<br/>
          Opened by ${escapeHtml(session.openedBy.name ?? 'Unknown')}
        </p>
      </header>
      <table class="receipt-lines">
        <tbody>
          <tr><td>Sales (all methods)</td><td class="num">${formatPrice(salesTotal)}</td></tr>
          <tr><td>Sale count</td><td class="num">${totals.salesCount}</td></tr>
          <tr><td>Cash taken in sales</td><td class="num">${formatPrice(cashPay)}</td></tr>
          <tr><td>Whish (not in drawer)</td><td class="num">${formatPrice(whish)}</td></tr>
          <tr><td>Opening float</td><td class="num">${formatPrice(opening)}</td></tr>
          <tr><td>Cash in (manual)</td><td class="num">${formatPrice(priceOf(totals.cashIn))}</td></tr>
          <tr><td>Cash out (manual)</td><td class="num">${formatPrice(priceOf(totals.cashOut))}</td></tr>
          <tr><td><strong>Expected in drawer</strong></td><td class="num"><strong>${formatPrice(expected)}</strong></td></tr>
        </tbody>
      </table>
      ${expectedLbp != null ? `<p class="total-lbp">≈ ${formatLbp(expectedLbp)} guide</p>` : ''}
      <p class="footer-muted">Whish is never counted in the drawer. Figures from the live session on the server.</p>
    </div></div>
  `
  printHtmlDocument(`${title} · ${session.branch.name}`, inner)
}
