import { formatDocumentDate, formatPrice } from '@/lib/format'
import { printHtmlDocument } from '@/lib/print-document'

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
  payments?: { method: string; amount: number }[]
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
  .note { margin-top: 12px; font-style: italic; }
`

export function printSaleReceipt(input: ReceiptPrintInput) {
  const statusClass = input.status === 'pending' ? 'status-pending' : 'status-completed'
  const statusLabel = input.status === 'pending' ? 'Pending payment' : 'Paid'
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
  const paymentsHtml =
    input.payments && input.payments.length > 0
      ? `<section><h2 style="font-size:13px;margin:16px 0 6px">Payment</h2><ul style="margin:0;padding-left:18px">${input.payments
          .map((p) => `<li>${escapeHtml(p.method)} — ${formatPrice(p.amount)}</li>`)
          .join('')}</ul></section>`
      : input.status === 'pending'
        ? '<p><em>Payment not recorded — complete the sale at the till when the customer pays.</em></p>'
        : ''

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
    ${paymentsHtml}
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
}

/** B2B document — no till payment block; stock sync waits for the wholesale API. */
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
    <p><em>This document is not a till sale. Stock and accounts sync when the wholesale API is connected.</em></p>
    ${input.note ? `<p class="note">${escapeHtml(input.note)}</p>` : ''}
  `
  printHtmlDocument(input.reference, body)
}
