'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { printSaleReceipt } from '@/components/sales/sale-receipt-print'
import { receiptFromSale } from '@/components/sales/sale-receipt-build'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useBranches } from '@/hooks/use-branches'
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
                <td className="num tabular">
                  <PriceWithLbp usd={Number(line.unitPrice)} />
                </td>
                <td className="num tabular">
                  <PriceWithLbp usd={Number(line.lineTotal)} />
                </td>
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
  const { data: branches } = useBranches()
  useDocumentTitle(sale?.reference)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError || !sale) return <ErrorState title="Could not load this sale" error={error} onRetry={() => void refetch()} />

  const branchName = branches?.find((branch) => branch.id === sale.branchId)?.name

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
                ...receiptFromSale(sale),
                branchName,
              })
            }
          >
            <Printer size={16} aria-hidden="true" />
            Print receipt
          </button>
        }
      />
      <Panel title="Lines">
        <SaleLinesTable lines={sale.lines} />
      </Panel>
      <Panel title="Payment">
        <div className="table-wrap">
          <table className="card-table">
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col" className="num">Tendered</th>
                <th scope="col" className="num">Change</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {sale.payments.map((payment, index) => (
                <tr key={index}>
                  <td className="card-title capitalize">{payment.method}</td>
                  <td className="num tabular">{formatPrice(Number(payment.amount))}</td>
                  <td className="num tabular">
                    {payment.tendered != null ? formatPrice(Number(payment.tendered)) : '—'}
                  </td>
                  <td className="num tabular">
                    {payment.change != null && Number(payment.change) > 0
                      ? formatPrice(Number(payment.change))
                      : '—'}
                  </td>
                  <td>{payment.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
