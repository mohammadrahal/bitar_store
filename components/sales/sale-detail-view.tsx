'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { printSaleReceipt } from '@/components/sales/sale-receipt-print'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useSale } from '@/hooks/use-sales'
import { formatDocumentDate, formatPrice } from '@/lib/format'

function SaleLinesTable({ lines }: { lines: { lineNo: number; styleName: string; color: string; size: string; skuCode: string; quantity: number; unitPrice: string; lineTotal: string }[] }) {
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(lines, 15)
  return (
    <>
      <div className="table-wrap">
        <table className="card-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">Unit</th>
              <th scope="col" className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <tr key={line.lineNo}>
                <td className="card-title">
                  {line.styleName} {line.color} / {line.size}
                  <small>{line.skuCode}</small>
                </td>
                <td className="num tabular">{line.quantity}</td>
                <td className="num tabular">{formatPrice(Number(line.unitPrice))}</td>
                <td className="num tabular">{formatPrice(Number(line.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}

export function SaleDetailView({ saleId }: { saleId: string }) {
  const { data: sale, isPending, isError, error, refetch } = useSale(saleId)
  useDocumentTitle(sale?.reference)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError) return <ErrorState title="Could not load this sale" error={error} onRetry={() => void refetch()} />

  return (
    <>
      <Link href="/sales/b2c" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Sales
      </Link>
      <PageHeader
        eyebrow={sale.reference}
        title={`${formatPrice(Number(sale.total))} · ${sale.channel.replace('_', ' ')}`}
        description={`${formatDocumentDate(sale.soldAt)} · ${sale.soldBy.name}${sale.note ? ` · ${sale.note}` : ''}`}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              printSaleReceipt({
                reference: sale.reference,
                status: sale.status === 'completed' ? 'completed' : 'pending',
                soldAt: sale.soldAt,
                sellerName: sale.soldBy.name ?? '—',
                note: sale.note,
                total: Number(sale.total),
                lines: sale.lines.map((line) => ({
                  label: `${line.styleName} ${line.color} / ${line.size}`,
                  skuCode: line.skuCode,
                  quantity: line.quantity,
                  unitPrice: Number(line.unitPrice),
                  lineTotal: Number(line.lineTotal),
                })),
                payments: sale.payments.map((payment) => ({
                  method: payment.method,
                  amount: Number(payment.amount),
                })),
              })
            }
          >
            <Printer size={16} aria-hidden="true" />
            Print invoice
          </button>
        }
      />
      <Panel title="Lines">
        <SaleLinesTable lines={sale.lines} />
      </Panel>
      <Panel title="Payment">
        <div className="table-wrap">
          <table className="card-table">
            <tbody>
              {sale.payments.map((payment, index) => (
                <tr key={index}>
                  <td className="card-title capitalize">{payment.method}</td>
                  <td className="num tabular">{formatPrice(Number(payment.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
