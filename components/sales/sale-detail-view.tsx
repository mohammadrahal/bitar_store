'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useSale } from '@/hooks/use-sales'
import { formatDocumentDate, formatPrice } from '@/lib/format'

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
      />
      <Panel title="Lines">
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
              {sale.lines.map((line) => (
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
