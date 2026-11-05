'use client'

import Link from 'next/link'
import {
  ArrowLeftRight,
  Boxes,
  FileText,
  PackagePlus,
  Truck,
} from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { StaggerList } from '@/components/motion/stagger'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { BranchStockPanel } from '@/components/stock/branch-stock-panel'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { useApiInvoices } from '@/hooks/use-api-invoices'
import { useGoodsReceipts } from '@/hooks/use-goods-receipts'
import { usePermission } from '@/hooks/use-permission'
import { useReplenishment } from '@/hooks/use-warehouse'
import { useTransfersList } from '@/hooks/use-transfers'
import { formatDateInput, formatNumber, formatPrice, formatRelativeDateTime } from '@/lib/format'
import { receiptTotalCost } from '@/services/goods-receipts.service'
import { invoiceLabel, invoiceTotal } from '@/services/invoices-api.service'

/**
 * The warehouse, read as what it actually is: a place stock passes through.
 *
 * It is not a shop and the ordinary branch overview does not describe it. A
 * sale at the warehouse is refused by the server with a `409`, so revenue,
 * best sellers and recent sales are all structurally zero there — showing those
 * bands would be four empty panels implying a bad trading week rather than a
 * place that never trades.
 *
 * What it does have is flow. In from suppliers (`GET /goods-receipts`), out to
 * the branches (`GET /transfers`), the invoices raised for those shipments
 * (`GET /invoices?kind=b2b`), what the branches are still short of
 * (`GET /replenishment/suggestions`), and what is on the shelves right now
 * (`GET /stock`). This band reads in that order.
 */
export function WarehouseDetailBody({ warehouseId }: { warehouseId: string }) {
  const { canSeeTransfers, canManageMinimums, can } = usePermission()

  const onTheRoad = useTransfersList(warehouseId, 'dispatched', 0)
  const drafts = useTransfersList(warehouseId, 'draft', 0)
  const deliveries = useGoodsReceipts('', 0)
  const invoices = useApiInvoices({ kind: 'b2b', branchId: warehouseId, enabled: can('stock.view') })
  /* `branchId` on `/replenishment/suggestions` names the branch being *supplied*,
     not the supplier, so the warehouse's own id would filter out every row.
     Empty means every branch the viewer reaches, which is the question here:
     what does this warehouse owe the network? */
  const replenishment = useReplenishment('')

  const suggestions = replenishment.data?.suggestions ?? []
  /* The endpoint lists one row per branch-and-SKU, so the figure a reader wants
     is how many branches are waiting, not how many rows came back. */
  const branchesShort = new Set(suggestions.map((row) => row.branch.id)).size

  return (
    <>
      <div className="section-bar">
        <h2 className="section-title">Flow</h2>
        <p className="section-note">
          Everything moving through this warehouse right now. The warehouse supplies the branches and never sells to
          customers, so there are no takings to report.
        </p>
      </div>

      <StaggerList className="stats-grid">
        <StatCard
          label="On the road"
          value={formatNumber(onTheRoad.data?.total ?? 0)}
          detail="Dispatched, not yet confirmed"
          icon={Truck}
          href="/transfers?status=dispatched"
        />
        <StatCard
          label="Waiting to be sent"
          value={formatNumber(drafts.data?.total ?? 0)}
          detail="Prepared or requested, nothing has moved"
          icon={ArrowLeftRight}
          alert={(drafts.data?.total ?? 0) > 0}
          href="/transfers?status=draft"
        />
        <StatCard
          label="Branches short"
          value={formatNumber(branchesShort)}
          detail={branchesShort > 0 ? countOf(suggestions.length, 'variant') + ' under minimum' : 'All at or above minimum'}
          icon={Boxes}
          alert={branchesShort > 0}
          href="/replenishment"
        />
        <StatCard
          label="Deliveries in"
          value={formatNumber(deliveries.data?.total ?? 0)}
          detail="Supplier receipts recorded here"
          icon={PackagePlus}
          href="/stock-receipts"
        />
      </StaggerList>

      {canSeeTransfers() && (
        <Panel
          title="On the road"
          description="Dispatched and not yet confirmed at the other end. Mostly supply going out; a branch returning stock here shows as coming in."
          actions={
            <Link href="/transfers?status=dispatched" className="btn btn-secondary btn-sm">
              All transfers
            </Link>
          }
        >
          {onTheRoad.isPending ? (
            <Skeleton rows={3} />
          ) : onTheRoad.isError ? (
            <div className="panel-body">
              <ErrorState
                title="Could not load shipments"
                error={onTheRoad.error}
                onRetry={() => void onTheRoad.refetch()}
              />
            </div>
          ) : (onTheRoad.data?.items.length ?? 0) === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={Truck}
                title="Nothing on the road"
                description="Every shipment that left here has been confirmed at its destination."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Shipments on the road from this warehouse</caption>
                <thead>
                  <tr>
                    <th scope="col">Transfer</th>
                    <th scope="col">Route</th>
                    <th scope="col">Sent</th>
                    <th scope="col" className="num">
                      Still on the way
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {onTheRoad.data?.items.map((transfer) => (
                    <tr key={transfer.id}>
                      <td className="card-title">
                        <Link href={`/transfers/${transfer.id}`} className="link-cell">
                          <span className="tabular">{transfer.reference}</span>
                        </Link>
                        <small>{countOf(transfer.lines.length, 'variant')}</small>
                      </td>
                      {/* Named from the warehouse's point of view: the other
                          place, and which way it is travelling. */}
                      <td data-label="Route">
                        {transfer.from.id === warehouseId
                          ? `Out to ${transfer.to.name}`
                          : `In from ${transfer.from.name}`}
                      </td>
                      <td className="tabular" data-label="Sent">
                        {transfer.dispatchedAt ? formatRelativeDateTime(transfer.dispatchedAt) : '—'}
                      </td>
                      <td className="num tabular" data-label="Still on the way">
                        {formatNumber(transfer.totals.onTheRoad)}
                      </td>
                      <td data-label="Status">
                        <TransferStatusPill status={transfer.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {canManageMinimums() && (
        <Panel
          title="What to send next"
          description="Branches under their minimum, biggest need first, against what this warehouse can actually cover."
          actions={
            <Link href="/replenishment" className="btn btn-secondary btn-sm">
              Open replenishment
            </Link>
          }
        >
          {replenishment.isPending ? (
            <Skeleton rows={3} />
          ) : replenishment.isError ? (
            <div className="panel-body">
              <ErrorState
                title="Could not load suggestions"
                error={replenishment.error}
                onRetry={() => void replenishment.refetch()}
              />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={Boxes}
                title="Nothing to send"
                description="Every branch is at or above the minimum it keeps."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Replenishment suggestions from this warehouse</caption>
                <thead>
                  <tr>
                    <th scope="col">Branch</th>
                    <th scope="col">Variant</th>
                    <th scope="col" className="num">
                      They have
                    </th>
                    <th scope="col" className="num">
                      Suggested
                    </th>
                    <th scope="col" className="num">
                      We can send
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.slice(0, 8).map((row) => (
                    <tr key={`${row.branch.id}-${row.sku.id}`}>
                      <td className="card-title">{row.branch.name}</td>
                      <td data-label="Variant">
                        {row.sku.styleName}
                        <small>
                          {row.sku.color} / {row.sku.size} · <span className="tabular">{row.sku.code}</span>
                        </small>
                      </td>
                      <td className="num tabular" data-label="They have">
                        {formatNumber(row.sellable)}
                        {row.inTransit > 0 && <small> +{formatNumber(row.inTransit)} coming</small>}
                      </td>
                      <td className="num tabular" data-label="Suggested">
                        {formatNumber(row.suggested)}
                      </td>
                      <td className="num tabular" data-label="We can send">
                        {row.fillable < row.suggested ? (
                          <span className="pill pill-low">{formatNumber(row.fillable)}</span>
                        ) : (
                          formatNumber(row.fillable)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {suggestions.length > 8 && (
                <p className="panel-body section-note">
                  {countOf(suggestions.length - 8, 'more variant')} on the replenishment screen.
                </p>
              )}
            </div>
          )}
        </Panel>
      )}

      <div className="detail-grid">
        <Panel
          title="Deliveries in"
          description="Supplier receipts. Every delivery is recorded into this warehouse."
          actions={
            <Link href="/stock-receipts" className="btn btn-secondary btn-sm">
              All deliveries
            </Link>
          }
        >
          {deliveries.isPending ? (
            <Skeleton rows={3} />
          ) : deliveries.isError ? (
            <div className="panel-body">
              <ErrorState
                title="Could not load deliveries"
                error={deliveries.error}
                onRetry={() => void deliveries.refetch()}
              />
            </div>
          ) : (deliveries.data?.items.length ?? 0) === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={PackagePlus}
                title="No deliveries yet"
                description="Record one and its pieces land on these shelves straight away."
              />
            </div>
          ) : (
            <ul className="doc-feed panel-body" aria-label="The most recent supplier deliveries">
              {deliveries.data?.items.slice(0, 6).map((receipt) => (
                <li key={receipt.id} className="doc-feed-row">
                  <div className="doc-feed-head">
                    <Link href={`/stock-receipts/${receipt.id}`} className="doc-feed-ref link-cell">
                      {receipt.reference}
                    </Link>
                    <span className="doc-feed-figure tabular">{formatPrice(receiptTotalCost(receipt))}</span>
                  </div>
                  <p className="doc-feed-meta">
                    <span>{receipt.supplierName}</span>
                    <span className="tabular">{formatDateInput(receipt.invoiceDate)}</span>
                    <span className="tabular">{countOf(receipt.totalQuantity, 'piece')}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Supply invoices"
          description="Raised against shipments that left this warehouse. A draft has no number until it is finalized."
        >
          {invoices.isPending ? (
            <Skeleton rows={3} />
          ) : invoices.isError ? (
            <div className="panel-body">
              <ErrorState
                title="Could not load invoices"
                error={invoices.error}
                onRetry={() => void invoices.refetch()}
              />
            </div>
          ) : (invoices.data?.items.length ?? 0) === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={FileText}
                title="No supply invoices yet"
                description="One can be raised for any transfer that has been sent from here."
              />
            </div>
          ) : (
            <ul className="doc-feed panel-body" aria-label="Supply invoices raised by this warehouse">
              {invoices.data?.items.slice(0, 6).map((invoice) => (
                <li key={invoice.id} className="doc-feed-row">
                  <div className="doc-feed-head">
                    <span className="doc-feed-ref">{invoiceLabel(invoice)}</span>
                    <span className="doc-feed-figure tabular">{formatPrice(invoiceTotal(invoice))}</span>
                  </div>
                  <p className="doc-feed-meta">
                    <span>{invoice.recipient.name ?? 'Branch'}</span>
                    {invoice.transfer && <span className="tabular">{invoice.transfer.reference}</span>}
                    <span>{countOf(invoice.lineCount, 'line')}</span>
                    {invoice.voided ? (
                      <span>
                        <span className="pill pill-out">Void</span>
                      </span>
                    ) : invoice.status === 'draft' ? (
                      <span>
                        <span className="pill pill-low">Draft</span>
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <BranchStockPanel branchId={warehouseId} />
    </>
  )
}

