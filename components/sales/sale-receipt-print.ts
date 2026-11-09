import { formatDocumentDate, formatLbp, formatPrice } from '@/lib/format'
import { printHtmlDocument } from '@/lib/print-document'
import { RECEIPT_PRINT_CSS } from '@/lib/print-styles'
import { cachedExchangeRate, usdToLbp } from '@/services/settings.service'
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
  customerName?: string
  note?: string | null
  lines: ReceiptLine[]
  total: number
  payments?: ReceiptPaymentLine[]
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function paymentsBlock(payments: ReceiptPaymentLine[] | undefined, status: ReceiptPrintInput['status']) {
  if (payments && payments.length > 0) {
    const rows = payments
      .map((payment) => {
        const parts = [
          `<div class="pay-row"><strong>${escapeHtml(payment.method)}</strong> ${formatPrice(payment.amount)}`,
        ]
        if (payment.reference) parts[0] += ` · ref ${escapeHtml(payment.reference)}`
        parts[0] += '</div>'
        let extra = ''
        if (payment.method === 'cash' && payment.tendered != null && payment.tendered > 0) {
          extra += `<div class="pay-row">Tendered: ${formatPrice(payment.tendered)}</div>`
        }
        if (payment.method === 'cash' && payment.change != null && Number(payment.change) > 0) {
          extra += `<div class="pay-row pay-change">Change: ${formatPrice(Number(payment.change))}</div>`
        }
        return parts.join('') + extra
      })
      .join('')
    return `<section><h2 class="section-title">Payment</h2>${rows}</section>`
  }
  if (status === 'pending') {
    return '<p class="footer-muted">Payment not recorded. Complete the sale at the till when the customer pays.</p>'
  }
  return ''
}

function receiptShell(inner: string) {
  return `<style>${RECEIPT_PRINT_CSS}</style><div class="receipt-sheet"><div class="receipt">${inner}</div></div>`
}

export function printSaleReceipt(input: ReceiptPrintInput) {
  const statusClass = input.status === 'pending' ? 'status-pending' : 'status-completed'
  const statusLabel = input.status === 'pending' ? 'Pending payment' : 'Paid'
  const rate = cachedExchangeRate()
  const totalLbp = usdToLbp(input.total, rate)
  const linesHtml = input.lines
    .map(
      (line) => `
    <tr>
      <td>${escapeHtml(line.label)}${line.skuCode ? `<small>${escapeHtml(line.skuCode)}</small>` : ''}</td>
      <td class="num">${line.quantity}</td>
      <td class="num">${formatPrice(line.unitPrice)}</td>
      <td class="num">${formatPrice(line.lineTotal)}</td>
    </tr>`,
    )
    .join('')

  const inner = `
    <p class="brand">Bitar Fashion</p>
    <header>
      <h1>${escapeHtml(input.reference)}</h1>
      <p class="meta">
        <span class="status ${statusClass}">${statusLabel}</span><br/>
        ${formatDocumentDate(input.soldAt)}<br/>
        ${input.customerName ? `${escapeHtml(input.customerName)}<br/>` : ''}
        ${input.branchName ? `${escapeHtml(input.branchName)}<br/>` : ''}
        ${escapeHtml(input.sellerName)}
      </p>
    </header>
    <table class="receipt-lines">
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <div class="total-block">
      <p class="total">Total: ${formatPrice(input.total)}</p>
      ${totalLbp != null ? `<p class="total-lbp">≈ ${formatLbp(totalLbp)}</p>` : ''}
    </div>
    ${paymentsBlock(input.payments, input.status)}
    ${input.note ? `<p class="note">${escapeHtml(input.note)}</p>` : ''}
  `

  printHtmlDocument(`Receipt ${input.reference}`, receiptShell(inner))
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

/** B2B invoice print. includes payment when recorded on the document. */
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

  const inner = `
    <p class="brand">Bitar Fashion</p>
    <header>
      <h1>Wholesale invoice</h1>
      <p class="meta">
        ${escapeHtml(input.reference)} · <span class="status ${statusClass}">${statusLabel}</span><br/>
        ${escapeHtml(input.customerName)}<br/>
        ${formatDocumentDate(input.issuedAt)}<br/>
        ${input.branchName ? `${escapeHtml(input.branchName)}<br/>` : ''}
        ${escapeHtml(input.sellerName)}
      </p>
    </header>
    <table class="receipt-lines">
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <div class="total-block">
      <p class="total">Total: ${formatPrice(input.total)}</p>
    </div>
    ${paymentsBlock(input.payments, input.payments?.length ? 'completed' : 'pending')}
    <p class="footer-muted">Wholesale document. Stock and accounts sync when the wholesale API is connected.</p>
    ${input.note ? `<p class="note">${escapeHtml(input.note)}</p>` : ''}
  `

  printHtmlDocument(`Invoice ${input.reference}`, receiptShell(inner))
}
