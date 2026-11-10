'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { LocationSelect } from '@/components/shared/location-select'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { ReturnStatusPill } from '@/components/returns/return-status-pill'
import { useAllowPageBranchFilter } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { useReturns } from '@/hooks/use-returns'
import { priceOf } from '@/lib/api/map-catalog'
import { EMPTY_DISPLAY, formatDocumentDate, formatPrice } from '@/lib/format'
import type { ApiReturnStatus } from '@/lib/api/types'

const PAGE_SIZE = 20

type ReturnFilter = 'in_custody' | 'approved' | 'rejected' | 'all'

/**
 * `In custody` leads, because it is the only filter with work waiting in it:
 * goods are at the counter and nobody has decided. `handed_back` has no chip of
 * its own — a closed rejected return is history, and `All` covers it.
 */
const FILTER_OPTIONS: ChipOption<ReturnFilter>[] = [
  { value: 'in_custody', label: 'Waiting on a decision' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

function statusFor(filter: ReturnFilter): ApiReturnStatus | undefined {
  return filter === 'all' ? undefined : filter
}

/**
 * Everything that has come back.
 *
 * It opens on **Waiting on a decision**, which is the reason anyone comes here:
 * a manager looking for what to approve, or a cashier checking whether the
 * goods a customer is asking about have been dealt with yet.
 *
 * The money column is `refundOutstanding`, not the total — what is still owed
 * is the actionable figure. A return whose refund is paid in full shows nothing
 * there, which is the point.
 */
export function ReturnsListView({
  branchId,
  onBranchChange,
}: {
  branchId: string
  onBranchChange: (id: string) => void
}) {
  const allowBranchPicker = useAllowPageBranchFilter()
  const { locationScoped } = usePermission()
  const [filter, setFilter] = useState<ReturnFilter>('in_custody')
  const [page, setPage] = useState(1)

  const query = useReturns({
    branchId: branchId || undefined,
    status: statusFor(filter),
    offset: (page - 1) * PAGE_SIZE,
  })

  const rows = query.data?.items ?? []
  const total = query.data?.total ?? 0

  return (
    <Panel
      title="Returns"
      description="Every return taken in, newest first. A return is visible to the branch that took the goods and to the branch that sold them."
    >
      <div className="toolbar">
        {allowBranchPicker && !locationScoped ? (
          <Field label="Branch" className="toolbar-field">
            <LocationSelect
              value={branchId}
              onChange={(value) => {
                onBranchChange(value)
                setPage(1)
              }}
              onlyAccessible
              allowAll
              allLabel="Every branch"
            />
          </Field>
        ) : null}
        <FilterChips
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(next) => {
            setFilter(next)
            setPage(1)
          }}
          label="Filter returns"
        />
      </div>

      {query.isPending ? (
        <Skeleton rows={5} stats={0} />
      ) : query.isError ? (
        <ErrorState
          title="Could not load the returns"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title={filter === 'in_custody' ? 'Nothing waiting' : 'No returns here'}
          description={
            filter === 'in_custody'
              ? 'Every return that came in has been approved or rejected.'
              : 'A return appears here as soon as someone takes goods back at the counter.'
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Returns, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Return</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Units
                  </th>
                  <th scope="col" className="num">
                    Still owed
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const owed = entry.refundOutstanding === null ? null : priceOf(entry.refundOutstanding)
                  return (
                    <tr key={entry.id}>
                      <td className="card-title">
                        <Link href={`/returns/${entry.id}`} className="link-cell">
                          {entry.reference}
                        </Link>
                        <small>
                          {formatDocumentDate(entry.receivedAt)} · sale {entry.saleReference}
                        </small>
                      </td>
                      <td data-label="Branch">{entry.receivingBranch?.name ?? EMPTY_DISPLAY}</td>
                      <td data-label="Status">
                        <ReturnStatusPill status={entry.status} />
                      </td>
                      <td className="num tabular" data-label="Units">
                        {entry.units}
                      </td>
                      <td
                        className={`num tabular ${owed !== null && owed > 0 ? 'detail-alert' : ''}`}
                        data-label="Still owed"
                      >
                        {owed === null || owed === 0 ? EMPTY_DISPLAY : formatPrice(owed)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            total={total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}
    </Panel>
  )
}
