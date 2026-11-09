'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { LocationSelect } from '@/components/shared/location-select'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useCashSessions } from '@/hooks/use-cash-sessions'
import { useAllowPageBranchFilter } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { priceOf } from '@/lib/api/map-catalog'
import { cashSessionListItems, cashSessionTotals } from '@/lib/cash-display'
import { EMPTY_DISPLAY, formatDocumentDate, formatNumber, formatPrice } from '@/lib/format'
import type { ApiCashSessionSummary, CashSessionStatus } from '@/lib/api/types'

const PAGE_SIZE = 20

type ShiftFilter = 'all' | 'open' | 'closed' | 'flagged'

const FILTER_OPTIONS: ChipOption<ShiftFilter>[] = [
  { value: 'flagged', label: 'To review' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
]

/** What the list asks the server for. `flagged` is its own parameter, not a status. */
function paramsFor(filter: ShiftFilter): { status?: CashSessionStatus; review?: 'flagged' } {
  if (filter === 'flagged') return { review: 'flagged' }
  if (filter === 'open') return { status: 'open' }
  if (filter === 'closed') return { status: 'closed' }
  return {}
}

function StatusCell({ session }: { session: ApiCashSessionSummary }) {
  if (session.status === 'open') {
    return (
      <span className="pill pill-healthy">
        <span className="pill-dot" aria-hidden="true" />
        Open
      </span>
    )
  }
  if (session.review?.flagged && session.review.reviewedAt === null) {
    return (
      <span className="pill pill-out">
        <span className="pill-dot" aria-hidden="true" />
        Needs review
      </span>
    )
  }
  return (
    <span className="pill pill-neutral">
      <span className="pill-dot" aria-hidden="true" />
      {session.review?.reviewedAt != null ? 'Reviewed' : 'Closed'}
    </span>
  )
}

/**
 * The shift record: every drawer that has been opened, newest first.
 *
 * It opens on **To review** rather than on everything, because the reason a
 * manager comes to this list is a count that did not match. The whole record is
 * one chip away.
 */
export function CashShiftsView({
  branchId,
  onBranchChange,
}: {
  branchId: string
  onBranchChange: (id: string) => void
}) {
  const allowBranchPicker = useAllowPageBranchFilter()
  const { locationScoped } = usePermission()
  const [filter, setFilter] = useState<ShiftFilter>('all')
  const [page, setPage] = useState(1)

  const query = useCashSessions({
    branchId: branchId || undefined,
    ...paramsFor(filter),
    offset: (page - 1) * PAGE_SIZE,
  })

  const rows = cashSessionListItems(query.data?.items)
  const total = query.data?.total ?? 0

  return (
    <Panel
      title="Shifts"
      description="Every drawer that has been opened. A count that did not match stays flagged until a manager signs it off."
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
          label="Filter shifts"
        />
      </div>

      {query.isPending ? (
        <Skeleton rows={5} stats={0} />
      ) : query.isError ? (
        <ErrorState title="Could not load the shifts" error={query.error} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title={filter === 'flagged' ? 'Nothing to review' : 'No shifts yet'}
          description={
            filter === 'flagged'
              ? 'Every closed drawer balanced, or has already been signed off.'
              : 'A shift appears here as soon as someone opens the drawer.'
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Cash sessions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Opened</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Sales
                  </th>
                  <th scope="col" className="num">
                    Expected cash
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((session) => {
                  const totals = cashSessionTotals(session)
                  return (
                    <tr key={session.id}>
                      <td className="card-title">
                        <Link href={`/cash/${session.id}`} className="link-cell">
                          {formatDocumentDate(session.openedAt)}
                        </Link>
                        <small>{session.openedBy?.name ?? 'Unknown'}</small>
                      </td>
                      <td data-label="Branch">{session.branch?.name ?? EMPTY_DISPLAY}</td>
                      <td data-label="Status">
                        <StatusCell session={session} />
                      </td>
                      <td className="num tabular" data-label="Sales">
                        {formatNumber(totals.salesCount)}
                      </td>
                      <td className="num tabular" data-label="Expected cash">
                        {formatPrice(priceOf(totals.expectedCash))}
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
