'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { SelectInput } from '@/components/shared/select-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useAllowPageBranchFilter, useEffectiveListBranchId, useListBranchFilter } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { useSalesHistoryPages } from '@/hooks/use-sales-history'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { apiFeatureHint, isApiFeatureMissing } from '@/lib/api/capabilities'
import { saleChannelLabel } from '@/lib/sale-channel'
import { presetRange, shopSpanDays, shopToday, type SalesHistoryPreset } from '@/lib/shop-date'

const PRESETS: ChipOption<SalesHistoryPreset>[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
]

function money(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? formatPrice(amount) : value
}

export function SalesHistoryView() {
  const salesHistoryMissing = isApiFeatureMissing('salesHistory')
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const scopeFilter = useListBranchFilter()
  const { data: branches } = useBranches()
  const today = shopToday()
  const initial = presetRange('today', today)
  const [preset, setPreset] = useState<SalesHistoryPreset>('today')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [pageBranchId, setPageBranchId] = useState('all')

  const span = shopSpanDays(from, to)
  const rangeError =
    from > to ? 'The start date is after the end date.' : span > 366 ? 'A range can be at most 366 days.' : null

  const apiBranchId = useEffectiveListBranchId(pageBranchId === 'all' ? '' : pageBranchId)
  const canQuery = !rangeError && (allowPageBranchFilter ? pageBranchId === 'all' || Boolean(pageBranchId) : Boolean(scopeFilter))
  const history = useSalesHistoryPages({ branchId: apiBranchId, from, to }, canQuery)

  const rows = history.data?.pages.flatMap((page) => page.sales) ?? []
  const total = history.data?.pages[0]?.total ?? 0

  const branchOptions = [
    ...(allowPageBranchFilter ? [{ value: 'all', label: 'All branches' }] : []),
    ...(branches ?? [])
      .filter((branch) => branch.isActive && branch.kind !== 'warehouse')
      .map((branch) => ({ value: branch.id, label: branch.name })),
  ]

  const applyPreset = (next: SalesHistoryPreset) => {
    setPreset(next)
    if (next === 'custom') return
    const range = presetRange(next, shopToday())
    setFrom(range.from)
    setTo(range.to)
  }

  if (salesHistoryMissing) {
    return (
      <>
        <PageHeader eyebrow="Sales" title="Sales history" description="Completed till sales by shop day." />
        <Panel title="Not available on this server">
          <div className="panel-body">
            <EmptyState icon={ReceiptText} title="Sales history API missing" description={apiFeatureHint('salesHistory')} />
          </div>
        </Panel>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Sales history"
        description="Completed till sales by shop day in Lebanon. Open a row for the receipt."
      />

      <Panel
        title="Sales"
        description={
          history.isPending ? 'Loading…' : rangeError ? rangeError : `${rows.length} of ${total}`
        }
      >
        <div className="toolbar">
          <FilterChips label="Period" options={PRESETS} value={preset} onChange={applyPreset} />
          {allowPageBranchFilter && (
            <SelectInput
              value={pageBranchId}
              onValueChange={setPageBranchId}
              options={branchOptions}
              placeholder="Branch"
              aria-label="Branch"
              variant="inline"
              size="sm"
            />
          )}
          {preset === 'custom' && (
            <>
              <label className="toolbar-field">
                <span className="sr-only">From</span>
                <input type="date" value={from} max={to || today} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="toolbar-field">
                <span className="sr-only">To</span>
                <input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} />
              </label>
            </>
          )}
        </div>

        {!canQuery && !rangeError ? (
          <div className="panel-body">
            <EmptyState icon={ReceiptText} title="Choose a branch" description="Sales history follows the branches you can reach." />
          </div>
        ) : rangeError ? (
          <div className="panel-body">
            <p className="field-error" role="alert">
              {rangeError}
            </p>
          </div>
        ) : history.isPending ? (
          <div className="panel-body">
            <Skeleton rows={5} stats={0} />
          </div>
        ) : history.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load sales" error={history.error} onRetry={() => void history.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState icon={ReceiptText} title="No sales in this period" description="Try another range or another branch." />
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Sales history</caption>
                <thead>
                  <tr>
                    <th scope="col">Sale</th>
                    <th scope="col">When</th>
                    <th scope="col">Branch</th>
                    <th scope="col">Sold by</th>
                    <th scope="col">Channel</th>
                    <th scope="col" className="num">Items</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col" className="num">Cash</th>
                    <th scope="col" className="num">Whish</th>
                  </tr>
                </thead>
                <MotionTbody>
                  {rows.map((sale, index) => (
                    <MotionTr key={sale.id} index={index}>
                      <td>
                        <Link href={`/sales/${sale.id}`} className="link-cell">
                          {sale.reference}
                        </Link>
                      </td>
                      <td>
                        <strong>{sale.businessDate}</strong>
                        <small>{formatDocumentDate(sale.soldAt)}</small>
                      </td>
                      <td>{sale.branch.name}</td>
                      <td>{sale.soldBy.name ?? 'Unknown'}</td>
                      <td>{saleChannelLabel(sale.channel)}</td>
                      <td className="num">{sale.items}</td>
                      <td className="num">{money(sale.total)}</td>
                      <td className="num">{money(sale.cash)}</td>
                      <td className="num">{money(sale.whish)}</td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
            {history.hasNextPage && (
              <div className="panel-body">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void history.fetchNextPage()}
                  disabled={history.isFetchingNextPage}
                >
                  {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  )
}
