'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PackagePlus, Paperclip } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Pagination } from '@/components/shared/pagination'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { GOODS_RECEIPTS_PAGE, useGoodsReceipts } from '@/hooks/use-goods-receipts'
import { useStockAdjustments, useStockReceipts } from '@/hooks/use-stock-receipts'
import { useSkuIdFromCode } from '@/hooks/use-skus'
import { formatDateInput, formatNumber, formatPrice, formatRelativeDateTime, formatSigned } from '@/lib/format'
import { ApiError } from '@/lib/api/api-error'
import { receiptTotalCost } from '@/services/goods-receipts.service'
import { ALL_BRANCHES } from '@/types'
import {
  receiptFailures,
  receiptHasCosts,
  receiptTotal,
  receiptUnits,
  REASON_LABELS,
} from '@/services/stock-receipts.service'

/**
 * Three lists, deliberately separate, because they are not the same record.
 *
 * **Deliveries** are `GET /goods-receipts`: the shared document, with the
 * supplier, their invoice number and the cost per piece, which every device
 * sees. **Corrections** are `GET /stock/adjustments`. every balance change
 * anyone has made, at every location in scope. **On this device** is what the
 * old build wrote before the deliveries endpoint was wired up; it is kept so
 * nobody loses their history, and labelled so nobody mistakes it for shared.
 */
export function StockReceiptsView({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  /* Rule 63: supplier, date and product. All three are server-side parameters,
     so a range narrower than one page still returns every match. */
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [skuSearch, setSkuSearch] = useState('')
  const skuTerm = useDebouncedValue(skuSearch)
  const [page, setPage] = useState(1)
  const offset = (page - 1) * GOODS_RECEIPTS_PAGE

  /* The product filter takes a SKU code off a tag, which the server wants as an
     id. The catalog mirror already holds the pairing, so no extra request. */
  const skuId = useSkuIdFromCode(skuTerm)
  const skuUnknown = skuTerm.trim().length > 0 && skuId === null

  const deliveries = useGoodsReceipts(
    { search, from, to, ...(skuId ? { skuId } : {}) },
    offset,
  )
  const receipts = useStockReceipts()
  const adjustments = useStockAdjustments()
  const { data: branches } = useBranches()

  const branchName = (id: string) => branches?.find((branch) => branch.id === id)?.name ?? 'Unknown location'
  const deliveryRows = deliveries.data?.items ?? []
  const deliveryTotal = deliveries.data?.total ?? 0
  const legacy = receipts.data ?? []
  const forbidden = deliveries.isError && deliveries.error instanceof ApiError && deliveries.error.status === 403

  /* The header filter narrows the corrections, which are held per location, and
     deliberately does not narrow the deliveries: a supplier receipt belongs to
     the warehouse, so a branch has none of its own and filtering them to one
     would always read empty. Each panel names its own reach instead of leaving
     the filter to be read as covering both. */
  const scope = useBranchScope()
  const scoped = scope !== ALL_BRANCHES ? branchName(scope) : null

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Stock"
          title="Receive stock"
          description={
            scoped
              ? `Supplier deliveries into the warehouse, and the balance corrections at ${scoped}.`
              : 'Supplier deliveries into the warehouse, and every balance correction the server knows about.'
          }
          actions={
            <Can permission="stock.adjust">
              <Link href="/stock-receipts/new" className="btn btn-primary">
                <PackagePlus size={16} aria-hidden="true" />
                Receive stock
              </Link>
            </Can>
          }
        />
      ) : null}

      <div className={embedded ? 'stack embedded-stock-receipts' : 'stack'}>
        <Panel
          title="Supplier deliveries"
          description={
            scoped
              ? `One document per delivery: supplier, their invoice number, and the price paid per piece. Deliveries arrive at the warehouse, so this list stays warehouse-wide. it is not narrowed to ${scoped}.`
              : 'One document per delivery: supplier, their invoice number, and the price paid per piece. Recorded on the server, so every device sees the same list.'
          }
        >
          <div className="toolbar">
            <SearchInput
              value={searchInput}
              onChange={(next) => {
                setSearchInput(next)
                setPage(1)
              }}
              placeholder="Search by supplier"
              aria-label="Search supplier deliveries"
            />
            <div className="toolbar-field">
              <label className="sr-only" htmlFor="receipts-sku">
                Filter by SKU or barcode
              </label>
              <input
                id="receipts-sku"
                className="input"
                value={skuSearch}
                onChange={(event) => {
                  setSkuSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="SKU or barcode"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={skuUnknown}
              />
            </div>
            <div className="toolbar-field">
              <label className="sr-only" htmlFor="receipts-from">
                Delivered from
              </label>
              <input
                id="receipts-from"
                type="date"
                className="input tabular"
                value={from}
                max={to || undefined}
                onChange={(event) => {
                  setFrom(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="toolbar-field">
              <label className="sr-only" htmlFor="receipts-to">
                Delivered to
              </label>
              <input
                id="receipts-to"
                type="date"
                className="input tabular"
                value={to}
                min={from || undefined}
                onChange={(event) => {
                  setTo(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            {(from || to || skuSearch) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFrom('')
                  setTo('')
                  setSkuSearch('')
                  setPage(1)
                }}
              >
                Clear filters
              </button>
            )}
            {embedded ? (
              <Can permission="stock.adjust">
                <Link href="/stock-receipts/new" className="btn btn-primary">
                  <PackagePlus size={16} aria-hidden="true" />
                  New receipt
                </Link>
              </Can>
            ) : null}
          </div>

          {deliveries.isPending ? (
            <Skeleton rows={3} />
          ) : forbidden ? (
            /* A branch manager cannot reach the warehouse, so the server will
               not show them its deliveries. That is the rule working, not a
               fault. and the corrections below are still theirs to read. */
            <div className="panel-body">
              <p className="muted">
                Deliveries are recorded into the warehouse, and your account does not reach it. Ask an admin if you
                need to see them.
              </p>
            </div>
          ) : deliveries.isError ? (
            <div className="panel-body">
              <ErrorState
                title="Could not load deliveries"
                error={deliveries.error}
                onRetry={() => void deliveries.refetch()}
              />
            </div>
          ) : deliveryRows.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title={search ? 'No deliveries match that supplier' : 'No deliveries recorded yet'}
              description={
                search
                  ? 'Try part of the supplier’s name.'
                  : 'Record a delivery and its quantities go into the warehouse straight away, with the cost on the document.'
              }
              action={
                search ? undefined : (
                  <Can permission="stock.adjust">
                    <Link href="/stock-receipts/new" className="btn btn-primary">
                      Receive stock
                    </Link>
                  </Can>
                )
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="card-table">
                  <caption className="sr-only">Supplier deliveries</caption>
                  <thead>
                    <tr>
                      <th scope="col">Receipt</th>
                      <th scope="col">Supplier</th>
                      <th scope="col">Invoice date</th>
                      <th scope="col" className="num">Lines</th>
                      <th scope="col" className="num">Pieces</th>
                      <th scope="col" className="num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryRows.map((receipt) => (
                      <tr key={receipt.id}>
                        <td className="card-title">
                          <Link href={`/stock-receipts/${receipt.id}`} className="link-cell">
                            <span className="tabular">{receipt.reference}</span>
                          </Link>
                          <small>
                            {receipt.supplierInvoiceNumber ? (
                              <span className="tabular">their inv {receipt.supplierInvoiceNumber}</span>
                            ) : (
                              <span>no invoice number</span>
                            )}
                            {` · into ${receipt.warehouse.name}`}
                          </small>
                        </td>
                        <td data-label="Supplier">{receipt.supplierName}</td>
                        <td className="tabular" data-label="Invoice date">
                          {formatDateInput(receipt.invoiceDate)}
                        </td>
                        <td className="num tabular" data-label="Lines">{formatNumber(receipt.lineCount)}</td>
                        <td className="num tabular" data-label="Pieces">{formatNumber(receipt.totalQuantity)}</td>
                        <td className="num tabular" data-label="Cost">{formatPrice(receiptTotalCost(receipt))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(deliveryTotal / GOODS_RECEIPTS_PAGE))}
                total={deliveryTotal}
                pageSize={GOODS_RECEIPTS_PAGE}
                onPage={setPage}
              />
            </>
          )}
        </Panel>

        {legacy.length > 0 && (
        <Panel
          title="Recorded on this device"
          description="Deliveries entered before the server held this document. Their stock is on the shelf and in the audit log; this paperwork exists in this browser only."
        >
          {(
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Stock receipts saved on this device</caption>
                <thead>
                  <tr>
                    <th scope="col">Receipt</th>
                    <th scope="col">Arrived at</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="num">Lines</th>
                    <th scope="col" className="num">Pieces</th>
                    <th scope="col" className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {legacy.map((receipt) => {
                    const failed = receiptFailures(receipt)
                    return (
                      <tr key={receipt.id}>
                        <td className="card-title">
                          <Link href={`/stock-receipts/${receipt.id}`} className="link-cell">
                            <span className="tabular">
                              {receipt.receiptNo || receipt.reference || 'Untitled receipt'}
                            </span>
                          </Link>
                          <small>
                            {receipt.supplierName || null}
                            {receipt.reference && receipt.receiptNo && (
                              <span className="tabular"> · their ref {receipt.reference}</span>
                            )}
                            {/* A paperclip beside the row is the quickest way to
                                see which deliveries have their paperwork and
                                which are someone's memory of one. */}
                            {receipt.photo?.stored && (
                              <span className="receipt-has-photo">
                                <Paperclip size={12} aria-hidden="true" />
                                <span className="sr-only">Invoice photo attached</span>
                              </span>
                            )}
                            {failed.length > 0 && (
                              <span className="pill pill-out">
                                {failed.length} {failed.length === 1 ? 'line' : 'lines'} did not post
                              </span>
                            )}
                          </small>
                        </td>
                        <td data-label="Arrived at">{branchName(receipt.branchId)}</td>
                        <td className="tabular" data-label="Date">
                          {formatDateInput(receipt.receivedOn)}
                        </td>
                        <td className="num tabular" data-label="Lines">{formatNumber(receipt.lines.length)}</td>
                        <td className="num tabular" data-label="Pieces">{formatNumber(receiptUnits(receipt))}</td>
                        <td className="num tabular" data-label="Value">
                          {receiptHasCosts(receipt) ? formatPrice(receiptTotal(receipt)) : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        )}

        <Panel
          title={scoped ? `Corrections at ${scoped}` : 'Corrections on the server'}
          description={
            scoped
              ? `Every balance change at ${scoped}, whoever made it and from wherever. This is the shared record.`
              : 'Every balance change at the locations you can see, whoever made it and from wherever. This is the shared record.'
          }
        >
          {adjustments.isPending ? (
            <Skeleton rows={3} />
          ) : adjustments.isError ? (
            <ErrorState
              title="Could not load corrections"
              error={adjustments.error}
              onRetry={() => void adjustments.refetch()}
            />
          ) : (adjustments.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title="No corrections yet"
              description="Receiving stock or correcting a count will appear here."
            />
          ) : (
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Stock corrections recorded by the server</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Location</th>
                    <th scope="col" className="num">Change</th>
                    <th scope="col">Reason</th>
                    <th scope="col">By</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.data?.map((row) => (
                    <tr key={row.id}>
                      <td className="tabular" data-label="When">{formatRelativeDateTime(row.createdAt)}</td>
                      <td className="tabular" data-label="SKU">{row.sku.code}</td>
                      <td data-label="Location">{row.branch.name}</td>
                      <td className="num tabular" data-label="Change">{formatSigned(row.quantityDelta)}</td>
                      <td data-label="Reason">
                        {REASON_LABELS[row.reason] ?? row.reason}
                        {row.note && <small className="section-note">{row.note}</small>}
                      </td>
                      <td data-label="By">{row.by.name ?? 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
