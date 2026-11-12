'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { MotionSwap } from '@/components/motion/motion-swap'
import { receiptFromSale } from '@/components/sales/sale-receipt-build'
import { printSaleReceipt } from '@/components/sales/sale-receipt-print'
import { SearchInput } from '@/components/shared/search-input'
import { Can } from '@/components/shared/can'
import { useConfirm } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { LocationSelect } from '@/components/shared/location-select'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { useDeletePendingSale, usePendingSales } from '@/hooks/use-pending-sales'
import { useSalesList } from '@/hooks/use-sales'
import { useCurrentUser } from '@/store/user-store'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { pendingSaleTotal, type PendingSale } from '@/services/pending-sales.service'
import type { Sale } from '@/services/sales.service'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

type SaleFilter = 'all' | 'completed' | 'pending'

const FILTER_OPTIONS: ChipOption<SaleFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending sale' },
]

function saleUnits(sale: Sale) {
  return sale.lines.reduce((sum, line) => sum + line.quantity, 0)
}

function pendingUnits(sale: PendingSale) {
  return sale.lines.reduce((sum, line) => sum + line.quantity, 0)
}

function matchesSearchSale(sale: Sale, query: string) {
  const haystack = [
    sale.reference,
    sale.note ?? '',
    sale.soldBy.name,
    ...sale.lines.map((line) => `${line.styleName} ${line.skuCode} ${line.color} ${line.size}`),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function matchesSearchPending(sale: PendingSale, query: string) {
  const haystack = [sale.note, ...sale.lines.map((line) => line.label)].join(' ').toLowerCase()
  return haystack.includes(query)
}

export function B2cRetailSalesPanel({
  onCreate,
}: {
  onCreate: () => void
}) {
  const user = useCurrentUser()
  const { data: branches } = useBranches()
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const [date, setDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [saleFilter, setSaleFilter] = useState<SaleFilter>('all')
  const branchName = branches?.find((branch) => branch.id === branchId)?.name

  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    setPage(1)
  }, [search, date, branchId, saleFilter])

  const listQuery = useSalesList(branchId, date || undefined, saleFilter !== 'pending')
  const pendingQuery = usePendingSales(branchId)
  const removePending = useDeletePendingSale()
  const [confirm, confirmDialog] = useConfirm()

  const completedSales = useMemo(() => {
    if (saleFilter === 'pending') return []
    const sales = listQuery.data?.sales ?? []
    const query = search.trim().toLowerCase()
    if (!query) return sales
    return sales.filter((sale) => matchesSearchSale(sale, query))
  }, [listQuery.data?.sales, search, saleFilter])

  const pendingSales = useMemo(() => {
    if (saleFilter === 'completed') return []
    const rows = pendingQuery.data ?? []
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((sale) => matchesSearchPending(sale, query))
  }, [pendingQuery.data, search, saleFilter])

  type Row =
    | { kind: 'completed'; id: string; at: string; sale: Sale }
    | { kind: 'pending'; id: string; at: string; pending: PendingSale }

  const merged = useMemo(() => {
    const rows: Row[] = [
      ...completedSales.map((sale) => ({ kind: 'completed' as const, id: sale.id, at: sale.soldAt, sale })),
      ...pendingSales.map((pending) => ({
        kind: 'pending' as const,
        id: pending.id,
        at: pending.createdAt,
        pending,
      })),
    ]
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }, [completedSales, pendingSales])

  const total = merged.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = merged.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const isFiltered = search.trim() !== '' || date !== '' || saleFilter !== 'all'
  const businessDate = listQuery.data?.businessDate
  const loading = saleFilter === 'pending' ? pendingQuery.isPending : listQuery.isPending

  const printPending = (pending: PendingSale) => {
    printSaleReceipt({
      reference: `PENDING-${pending.id.slice(0, 8).toUpperCase()}`,
      status: 'pending',
      soldAt: pending.createdAt,
      sellerName: user.name,
      branchName,
      note: pending.note,
      total: pendingSaleTotal(pending),
      lines: pending.lines.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.quantity * line.unitPrice,
      })),
    })
  }

  return (
    <Panel
      title="Retail sales"
      description={
        loading
          ? 'Loading…'
          : saleFilter === 'pending'
            ? `${total} pending sale${total === 1 ? '' : 's'} on this device`
            : businessDate && saleFilter === 'completed'
              ? `${total} on ${businessDate}`
              : `${total} ${total === 1 ? 'sale' : 'sales'}`
      }
    >
      <div className="toolbar">
        {allowPageBranchFilter && (
          <Field label="Branch" className="toolbar-field">
            <LocationSelect value={pageBranchId} onChange={setPageBranchId} onlyAccessible />
          </Field>
        )}
        {saleFilter !== 'pending' && (
          <Field label="Business date" className="toolbar-field">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        )}
        <FilterChips label="Show" options={FILTER_OPTIONS} value={saleFilter} onChange={setSaleFilter} />
        <Field label="Search" className="toolbar-field toolbar-field-grow">
          <SearchInput
            className="search-field--full"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Reference, note or SKU"
            aria-label="Search sales"
          />
        </Field>
        {isFiltered && (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setDate('')
              setSaleFilter('all')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <MotionSwap state={!branchId ? 'no-branch' : loading ? 'loading' : listQuery.isError && saleFilter !== 'pending' ? 'error' : 'ready'}>
        {!branchId ? (
          <div className="panel-body">
            <EmptyState icon={ReceiptText} title="Pick a branch" description="Choose a location to see its till sales for the day." />
          </div>
        ) : loading ? (
          <div className="panel-body">
            <Skeleton rows={1} stats={0} />
          </div>
        ) : listQuery.isError && saleFilter !== 'pending' ? (
          <div className="panel-body">
            <ErrorState title="Could not load sales" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
          </div>
        ) : visible.length === 0 ? (
          <div className="panel-body">
            {isFiltered ? (
              <EmptyState icon={ReceiptText} title="No sales match" description="Try another filter or search term." />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No retail sales yet"
                description="Ring up a walk-in sale, or save the cart as a pending sale until the customer pays at the till."
                action={
                  <Can permission="sales.create">
                    <button type="button" className="btn btn-primary" onClick={onCreate}>
                      New B2C sale
                    </button>
                  </Can>
                }
              />
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Retail sales and pending till carts</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Status</th>
                    <th scope="col">When</th>
                    <th scope="col">Seller</th>
                    <th scope="col" className="num">
                      Units
                    </th>
                    <th scope="col" className="num">
                      Total
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <MotionTbody dataset={`${branchId}-${currentPage}-${saleFilter}`}>
                  {visible.map((row, index) =>
                    row.kind === 'completed' ? (
                      <MotionTr key={row.id} index={index}>
                        <td className="card-title">
                          <Link href={`/sales/${row.sale.id}`}>{row.sale.reference}</Link>
                          {row.sale.note ? <small>{row.sale.note}</small> : null}
                        </td>
                        <td>
                          <span className="pill pill-healthy">Completed</span>
                        </td>
                        <td>{formatDocumentDate(row.sale.soldAt)}</td>
                        <td>{row.sale.soldBy.name}</td>
                        <td className="num tabular">{saleUnits(row.sale)}</td>
                        <td className="num tabular">{formatPrice(Number(row.sale.total))}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              printSaleReceipt({
                                ...receiptFromSale(row.sale),
                                branchName,
                              })
                            }
                          >
                            Print
                          </button>
                        </td>
                      </MotionTr>
                    ) : (
                      <MotionTr key={row.id} index={index}>
                        <td className="card-title">
                          <span>Pending sale</span>
                          {row.pending.customerName || row.pending.note ? (
                            <small>{row.pending.customerName ?? row.pending.note}</small>
                          ) : null}
                          {row.pending.customerPhone ? (
                            <small className="tabular muted">{row.pending.customerPhone}</small>
                          ) : null}
                        </td>
                        <td>
                          <span className="pill pill-low">Pending</span>
                        </td>
                        <td>{formatDocumentDate(row.pending.createdAt)}</td>
                        <td>{user.name}</td>
                        <td className="num tabular">{pendingUnits(row.pending)}</td>
                        <td className="num tabular">{formatPrice(pendingSaleTotal(row.pending))}</td>
                        <td>
                          <div className="row-actions">
                            <Link href={`/sales/new?pending=${row.pending.id}`} className="btn btn-ghost btn-sm">
                              Resume
                            </Link>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => printPending(row.pending)}>
                              Print
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm danger"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: 'Remove this pending sale?',
                                  description: `${pendingUnits(row.pending)} item(s), ${formatPrice(pendingSaleTotal(row.pending))}. The basket is deleted and cannot be resumed.`,
                                  confirmLabel: 'Remove',
                                  tone: 'danger',
                                })
                                if (confirmed) removePending.mutate({ id: row.pending.id, branchId: row.pending.branchId })
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </MotionTr>
                    ),
                  )}
                </MotionTbody>
              </table>
            </div>
            <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </MotionSwap>
      {confirmDialog}
    </Panel>
  )
}
