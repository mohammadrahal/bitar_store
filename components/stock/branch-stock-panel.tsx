'use client'

import { useState } from 'react'
import { ArrowLeftRight, ClipboardCheck, PackageSearch } from 'lucide-react'
import { CorrectStockDrawer } from '@/components/inventory/correct-stock-drawer'
import { QuickTransferDrawer, type QuickTransferVariant } from '@/components/inventory/quick-transfer-drawer'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { StockStatusPill } from '@/components/shared/status-pill'
import { usePermission } from '@/hooks/use-permission'
import { useBranchStockRows } from '@/hooks/use-stock'
import { formatPrice } from '@/lib/format'
import { variantLabel } from '@/lib/variant-label'
import type { BranchStockRow } from '@/types'

const PAGE_SIZE = 10

const asTransferVariant = (row: BranchStockRow): QuickTransferVariant => ({
  variantId: row.variantId,
  label: variantLabel(row),
  sku: row.sku,
})

/**
 * Everything one branch holds, from `GET /stock`. Sales move these figures.
 *
 * Each row carries the two things anyone reading this list does next — send
 * some of it on, or correct what it claims — with this branch already set as
 * the location, because that is the whole subject of the page.
 */
export function BranchStockPanel({ branchId }: { branchId: string }) {
  const { data: rows, isPending, isError, error, refetch } = useBranchStockRows(branchId)
  const [page, setPage] = useState(1)
  const { can, canRequestTransfer } = usePermission()
  const maySend = canRequestTransfer()
  const mayCorrect = can('stock.adjust', branchId)
  const [sending, setSending] = useState<QuickTransferVariant | null>(null)
  const [correcting, setCorrecting] = useState<QuickTransferVariant | null>(null)
  const actionable = maySend || mayCorrect

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
    <Panel title="Stock levels" description="What the server holds for this location, emptiest first.">
      {rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={PackageSearch}
            title="Nothing stocked here yet"
            description="Post an opening count for this location to bring its first units in."
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
                  <th scope="col">Status</th>
                  {actionable && (
                    <th scope="col" className="num">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
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
                    <td className="num tabular" data-label="Price">
                      {formatPrice(row.sellPrice)}
                    </td>
                    <td className="num tabular">{row.quantity}</td>
                    <td className="num tabular">
                      <strong>{row.available}</strong>
                    </td>
                    <td>
                      <StockStatusPill status={row.status} />
                    </td>
                    {actionable && (
                      <td className="num td-row-actions">
                        <div className="row-actions">
                          {maySend && (
                            <button
                              type="button"
                              className="icon-btn"
                              title={`Send ${row.sku} from here`}
                              disabled={row.available <= 0}
                              onClick={() => setSending(asTransferVariant(row))}
                            >
                              <ArrowLeftRight size={16} aria-hidden="true" />
                              <span className="sr-only">Send stock</span>
                            </button>
                          )}
                          {mayCorrect && (
                            <button
                              type="button"
                              className="icon-btn"
                              title={`Correct the balance for ${row.sku} here`}
                              onClick={() => setCorrecting(asTransferVariant(row))}
                            >
                              <ClipboardCheck size={16} aria-hidden="true" />
                              <span className="sr-only">Correct stock</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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

      {sending && (
        <QuickTransferDrawer
          variants={[sending]}
          initialSourceId={branchId}
          onClose={() => setSending(null)}
        />
      )}

      {correcting && (
        <CorrectStockDrawer
          variantId={correcting.variantId}
          label={correcting.label}
          code={correcting.sku}
          initialBranchId={branchId}
          onClose={() => setCorrecting(null)}
        />
      )}
    </Panel>
  )
}
