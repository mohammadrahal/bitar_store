'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { MotionSwap } from '@/components/motion/motion-swap'
import { SearchInput } from '@/components/shared/search-input'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { useSalesList } from '@/hooks/use-sales'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import type { Sale } from '@/services/sales.service'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

function saleUnits(sale: Sale) {
  return sale.lines.reduce((sum, line) => sum + line.quantity, 0)
}

function matchesSearch(sale: Sale, query: string) {
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

export function B2cRetailSalesPanel({
  onCreate,
}: {
  onCreate: () => void
}) {
  const { locationScoped } = usePermission()
  const defaultBranchId = useDefaultBranchId()
  const [branchChoice, setBranchChoice] = useState('')
  const [date, setDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const branchId = locationScoped ? defaultBranchId : branchChoice

  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    setPage(1)
  }, [search, date, branchId])

  const listQuery = useSalesList(branchId, date || undefined)
  const filtered = useMemo(() => {
    const sales = listQuery.data?.sales ?? []
    const query = search.trim().toLowerCase()
    if (!query) return sales
    return sales.filter((sale) => matchesSearch(sale, query))
  }, [listQuery.data?.sales, search])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const isFiltered = search.trim() !== '' || date !== ''
  const businessDate = listQuery.data?.businessDate

  return (
    <Panel
      title="Retail sales"
      description={
        listQuery.isPending
          ? 'Loading…'
          : businessDate
            ? `${total} on ${businessDate}`
            : `${total} ${total === 1 ? 'sale' : 'sales'}`
      }
    >
      <div className="toolbar">
        {!locationScoped && (
          <Field label="Branch" className="toolbar-field">
            <LocationSelect value={branchChoice} onChange={setBranchChoice} onlyAccessible />
          </Field>
        )}
        <Field label="Business date" className="toolbar-field">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Search" className="toolbar-field toolbar-field-grow">
          <SearchInput
            className="search-field--full"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Reference, customer note or SKU"
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
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <MotionSwap state={!branchId ? 'no-branch' : listQuery.isPending ? 'loading' : listQuery.isError ? 'error' : 'ready'}>
        {!branchId ? (
          <div className="panel-body">
            <EmptyState icon={ReceiptText} title="Pick a branch" description="Choose a location to see its till sales for the day." />
          </div>
        ) : listQuery.isPending ? (
          <div className="panel-body">
            <Skeleton rows={1} stats={0} />
          </div>
        ) : listQuery.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load sales" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
          </div>
        ) : visible.length === 0 ? (
          <div className="panel-body">
            {isFiltered ? (
              <EmptyState icon={ReceiptText} title="No sales match" description="Try another date or search term." />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No retail sales yet"
                description="Ring up a walk-in or till sale to remove units from branch stock."
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
                <caption className="sr-only">Completed retail sales</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">When</th>
                    <th scope="col">Seller</th>
                    <th scope="col" className="num">
                      Units
                    </th>
                    <th scope="col" className="num">
                      Total
                    </th>
                  </tr>
                </thead>
                <MotionTbody dataset={`${branchId}-${currentPage}`}>
                  {visible.map((sale, index) => (
                    <MotionTr key={sale.id} index={index}>
                      <td className="card-title">
                        <Link href={`/sales/${sale.id}`}>{sale.reference}</Link>
                        {sale.note ? <small>{sale.note}</small> : null}
                      </td>
                      <td>{formatDocumentDate(sale.soldAt)}</td>
                      <td>{sale.soldBy.name}</td>
                      <td className="num tabular">{saleUnits(sale)}</td>
                      <td className="num tabular">{formatPrice(Number(sale.total))}</td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
            <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </MotionSwap>
    </Panel>
  )
}
