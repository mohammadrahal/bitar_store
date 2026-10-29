'use client'

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, PackageSearch } from 'lucide-react'
import { InvoiceForm, type InvoicePrefill } from '@/components/invoices/invoice-form'
import { Can } from '@/components/shared/can'
import { ThresholdCell } from '@/components/stock/threshold-cell'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { StockStatusPill } from '@/components/shared/status-pill'
import { useBranchStockRows } from '@/hooks/use-stock'
import { formatPrice } from '@/lib/format'
import type { BranchStockRow, InvoiceKind } from '@/types'

const PAGE_SIZE = 10

/** Everything one branch holds: quantity moved only by documents, threshold set here. */
export function BranchStockPanel({ branchId }: { branchId: string }) {
  const { data: rows, isPending, isError, error, refetch } = useBranchStockRows(branchId)
  const [page, setPage] = useState(1)
  const [correcting, setCorrecting] = useState<InvoicePrefill | null>(null)

  /* An adjustment is the only way to move stock by hand, so the row opens one
     already pointed at this variant instead of offering an editable figure. */
  const correct = (row: BranchStockRow, kind: InvoiceKind) =>
    setCorrecting({
      kind,
      variant: {
        variantId: row.variantId,
        sku: row.sku,
        barcode: row.barcode,
        productId: row.productId,
        productName: row.productName,
        size: row.size,
        color: row.color,
        costPrice: row.costPrice,
        sellPrice: row.sellPrice,
      },
    })

  if (isPending) {
    return (
      <Panel title="Stock levels">
        <div className="panel-body">
          <Skeleton rows={1} stats={0} />
        </div>
      </Panel>
    )
  }

  if (isError) {
    return (
      <Panel title="Stock levels">
        <div className="panel-body">
          <ErrorState title="Could not load stock" error={error} onRetry={() => void refetch()} />
        </div>
      </Panel>
    )
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <Panel
      title="Stock levels"
      description="On hand moves only when a document is issued. The threshold is yours to set."
    >
      {rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={PackageSearch}
            title="Nothing stocked here yet"
            description="Add a product, then raise a purchase or an adjustment to bring units in."
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Stock held at this branch</caption>
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col" className="num">
                    On hand
                  </th>
                  <th scope="col" className="num">
                    Available
                  </th>
                  <th scope="col" className="num">
                    Threshold
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Correct stock</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.variantId}>
                    <td>
                      <strong>
                        {row.productName} · {row.size} / {row.color}
                      </strong>
                      <small>
                        {row.sku} · {row.barcode || row.category}
                      </small>
                    </td>
                    <td className="num tabular" data-label="Price">{formatPrice(row.sellPrice)}</td>
                    <td className="num tabular">{row.quantity}</td>
                    <td className="num tabular">
                      <strong>{row.available}</strong>
                    </td>
                    <td className="num">
                      <ThresholdCell variantId={row.variantId} branchId={branchId} value={row.lowStockAt} />
                    </td>
                    <td>
                      <StockStatusPill status={row.status} />
                    </td>
                    <td>
                      <Can permission="documents.manage">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => correct(row, 'adjustment_in')}
                            aria-label={`Add stock of ${row.sku}`}
                            title="Stock in"
                          >
                            <ArrowDownLeft size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => correct(row, 'adjustment_out')}
                            disabled={row.quantity === 0}
                            aria-label={`Remove stock of ${row.sku}`}
                            title={row.quantity === 0 ? 'Nothing on hand to remove' : 'Stock out'}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                      </Can>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={rows.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}

      {correcting && (
        <InvoiceForm
          prefill={correcting}
          defaultBranchId={branchId}
          onClose={() => setCorrecting(null)}
        />
      )}
    </Panel>
  )
}
