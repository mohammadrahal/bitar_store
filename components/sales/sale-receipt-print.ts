import { formatDocumentDate, formatLbp, formatPrice } from '@/lib/format'
import { printHtmlDocument } from '@/lib/print-document'
import { getExchangeRate, usdToLbpAmount } from '@/services/exchange-rate.service'
import type { ReceiptPaymentLine } from '@/components/sales/sale-receipt-build'

export interface ReceiptLine {
  label: string
  skuCode?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ReceiptPrintInput {
  reference: string
  status: 'completed' | 'pending'
  soldAt: string
  sellerName: string
  branchName?: string
  note?: string | null
  lines: ReceiptLine[]
  total: number
  payments?: ReceiptPaymentLine[]
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const STYLES = `
  @page { margin: 10mm; }
  body { font-family: system-ui, sans-serif; max-width: 80mm; margin: 0 auto; color: #000; font-size: 12px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { margin: 0 0 12px; color: #333; line-height: 1.4; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-completed { background: #dcfce7; color: #166534; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 4px 0; vertical-align: top; }
  th { text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; }
  td.num { text-align: right; white-space: nowrap; }
  .total { font-weight: 700; font-size: 14px; border-top: 1px solid #000; padding-top: 8px; }
  .total-lbp { font-size: 12px; font-weight: 500; color: #333; margin-top: 4px; }
  .note { margin-top: 12px; font-style: italic; }
  .pay-row { margin: 4px 0; }
  .pay-change { font-weight: 700; margin-top: 8px; }
`

function paymentsBlock(payments: ReceiptPaymentLine[] | undefined, status: ReceiptPrintInput['status']) {
  if (payments && payments.length > 0) {
    const rows = payments
      .map((payment) => {
        const parts = [`<div class="pay-row"><strong>${escapeHtml(payment.method)}</strong> — ${formatPrice(payment.amount)}`]
        if (payment.reference) parts.push(` · ref ${escapeHtml(payment.reference)}`)
        parts.push('</div>')
        if (payment.method === 'cash' && payment.tendered != null && payment.tendered > 0) {
          parts.push(`<div class="pay-row">Tendered: ${formatPrice(payment.tendered)}</div>`)
        }
        if (payment.method === 'cash' && payment.change != null && Number(payment.change) > 0) {
          parts.push(`<div class="pay-row pay-change">Change: ${formatPrice(Number(payment.change))}</div>`)
        }
        return parts.join('')
      })
      .join('')
    return `<section><h2 style="font-size:13px;margin:16px 0 6px">Payment</h2>${rows}</section>`
  }
  if (status === 'pending') {
    return '<p><em>Payment not recorded — complete the sale at the till when the customer pays.</em></p>'
  }
  return ''
}

export function printSaleReceipt(input: ReceiptPrintInput) {
  const statusClass = input.status === 'pending' ? 'status-pending' : 'status-completed'
  const statusLabel = input.status === 'pending' ? 'Pending payment' : 'Paid'
  const rate = getExchangeRate()
  const totalLbp = usdToLbpAmount(input.total, rate)
  const linesHtml = input.lines
    .map(
      (line) => `
    <tr>
      <td>${escapeHtml(line.label)}${line.skuCode ? `<br/><small>${escapeHtml(line.skuCode)}</small>` : ''}</td>
      <td class="num">${line.quantity}</td>
      <td class="num">${formatPrice(line.unitPrice)}</td>
      <td class="num">${formatPrice(line.lineTotal)}</td>
    </tr>`,
    )
    .join('')

  const body = `
    <style>${STYLES}</style>
    <header>
      <h1>${escapeHtml(input.reference)}</h1>
      <p class="meta">
        <span class="status ${statusClass}">${statusLabel}</span><br/>
        ${formatDocumentDate(input.soldAt)}<br/>
        ${escapeHtml(input.sellerName)}${input.branchName ? ` · ${escapeHtml(input.branchName)}` : ''}
      </p>
    </header>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <p class="total">Total: ${formatPrice(input.total)}</p>
    ${totalLbp != null ? `<p class="total-lbp">≈ ${formatLbp(totalLbp)}</p>` : ''}
    ${paymentsBlock(input.payments, input.status)}
    ${input.note ? `<p class="note">${escapeHtml(input.note)}</p>` : ''}
  `
  printHtmlDocument(input.reference, body)
}

export interface WholesalePrintInput {
  reference: string
  status: 'draft' | 'issued'
  customerName: string
  issuedAt: string
  sellerName: string
  branchName?: string
  note?: string | null
  lines: ReceiptLine[]
  total: number
  payments?: ReceiptPaymentLine[]
}

/** B2B invoice print — includes payment when recorded on the document. */
export function printWholesaleInvoice(input: WholesalePrintInput) {
  const statusClass = input.status === 'draft' ? 'status-pending' : 'status-completed'
  const statusLabel = input.status === 'draft' ? 'Draft' : 'Issued'
  const linesHtml = input.lines
    .map(
      (line) => `
    <tr>
      <td>${escapeHtml(line.label)}</td>
      <td class="num">${line.quantity}</td>
      <td class="num">${formatPrice(line.unitPrice)}</td>
      <td class="num">${formatPrice(line.lineTotal)}</td>
    </tr>`,
    )
    .join('')

  const body = `
    <style>${STYLES}</style>
    <header>
      <h1>Wholesale invoice</h1>
      <p class="meta">
        ${escapeHtml(input.reference)} · <span class="status ${statusClass}">${statusLabel}</span><br/>
        ${escapeHtml(input.customerName)}<br/>
        ${formatDocumentDate(input.issuedAt)}<br/>
        ${escapeHtml(input.sellerName)}${input.branchName ? ` · ${escapeHtml(input.branchName)}` : ''}
      </p>
    </header>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <p class="total">Total: ${formatPrice(input.total)}</p>
    ${paymentsBlock(input.payments, input.payments?.length ? 'completed' : 'pending')}
    <p><em>Wholesale document — stock and accounts sync when the wholesale API is connected.</em></p>
    ${input.note ? `<p class="note">${escapeHtml(input.note)}</p>` : ''}
  `
  printHtmlDocument(input.reference, body)
}
