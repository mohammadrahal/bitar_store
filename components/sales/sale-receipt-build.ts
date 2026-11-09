import type { ApiSale, ApiSalePayment } from '@/lib/api/types'
import type { ReceiptPrintInput } from '@/components/sales/sale-receipt-print'
import { changeDue, paymentsFor, type PaymentDraft } from '@/lib/sale-payments'

export interface ReceiptPaymentLine {
  method: string
  amount: number
  tendered?: number | null
  change?: number | null
  reference?: string | null
}

export function receiptPaymentsFromApi(payments: readonly ApiSalePayment[]): ReceiptPaymentLine[] {
  return payments.map((payment) => ({
    method: payment.method,
    amount: Number(payment.amount) || 0,
    tendered: payment.tendered != null ? Number(payment.tendered) : null,
    change: payment.change != null ? Number(payment.change) : null,
    reference: payment.reference,
  }))
}

export function receiptPaymentsFromDraft(draft: PaymentDraft, total: number): ReceiptPaymentLine[] {
  return paymentsFor(draft, total).map((payment) => ({
    method: payment.method,
    amount: payment.amount,
    tendered: payment.method === 'cash' ? (payment.tendered ?? payment.amount) : null,
    change: payment.method === 'cash' ? changeDue(draft, total) : null,
    reference: payment.reference ?? null,
  }))
}

export function receiptFromSale(sale: ApiSale, sellerName?: string): ReceiptPrintInput {
  return {
    reference: sale.reference,
    status: sale.status === 'completed' ? 'completed' : 'pending',
    soldAt: sale.soldAt,
    sellerName: sellerName ?? sale.soldBy.name ?? '',
    note: sale.note,
    total: Number(sale.total),
    lines: sale.lines.map((line) => ({
      label: `${line.styleName} ${line.color} / ${line.size}`,
      skuCode: line.skuCode,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
    payments: receiptPaymentsFromApi(sale.payments),
  }
}
