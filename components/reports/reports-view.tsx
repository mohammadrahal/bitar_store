'use client'

import { useMemo, useState } from 'react'
import { Receipt } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-cards'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { SkuTableCell } from '@/components/shared/table-empty'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useSalesSummaryReport, useTopSkusReport } from '@/hooks/use-reports-api'
import { formatPrice } from '@/lib/format'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ReportsView() {
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())

  const summary = useSalesSummaryReport(branchId, from, to)
  const topSkus = useTopSkusReport(branchId, from, to)
  const filterKey = `${branchId}:${from}:${to}`
  const summaryRows = useMemo(() => {
    const rows = summary.data?.rows ?? []
    if (!branchId) return rows
    return rows.filter((row) => row.branch.id === branchId)
  }, [summary.data?.rows, branchId])
  const topRows = topSkus.data?.rows ?? []
  const summaryPagination = usePagination(summaryRows, 20, `${filterKey}:summary`)
  const topPagination = usePagination(topRows, 20, `${filterKey}:top`)

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Sales summary"
        description="Revenue and payment mix by shop day (Lebanon time). Needs reports.financial on the server."
      />

      <Panel title="Date range">
        <div
          className={`panel-body report-filters${!allowPageBranchFilter ? ' report-filters--dates-only' : ''}`}
        >
          {allowPageBranchFilter && (
            <Field label="Branch (optional)">
              <LocationSelect value={pageBranchId} onChange={setPageBranchId} onlyAccessible placeholder="All branches" />
            </Field>
          )}
          <Field label="From">
            <input type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
      </Panel>

      {summary.isPending ? (
        <Skeleton rows={2} stats={4} />
      ) : summary.isError ? (
        <ErrorState title="Could not load summary" error={summary.error} onRetry={() => void summary.refetch()} />
      ) : summary.data ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Revenue"
              value={formatPrice(Number(summary.data.totals.revenue))}
              detail={`${summary.data.totals.salesCount} sales`}
              icon={Receipt}
            />
            <StatCard
              label="Cash"
              value={formatPrice(Number(summary.data.totals.cash))}
              detail="Paid in cash"
              icon={Receipt}
            />
            <StatCard
              label="Whish"
              value={formatPrice(Number(summary.data.totals.whish))}
              detail="Paid by Whish"
              icon={Receipt}
            />
            <StatCard
              label="Discounts"
              value={formatPrice(Number(summary.data.totals.discounts))}
              detail="Given on lines"
              icon={Receipt}
            />
          </div>

          <Panel title="By day and branch">
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Sales by day and branch</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Branch</th>
                    <th scope="col" className="num">
                      Sales
                    </th>
                    <th scope="col" className="num">
                      Items
                    </th>
                    <th scope="col" className="num">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <MotionTbody>
                  {summaryPagination.visible.map((row, index) => (
                    <MotionTr key={`${row.day}-${row.branch.id}`} index={index}>
                      <td>{row.day}</td>
                      <td>{'name' in row.branch && row.branch.name ? row.branch.name : row.branch.id}</td>
                      <td className="num">{row.salesCount}</td>
                      <td className="num">{row.items}</td>
                      <td className="num">{formatPrice(Number(row.revenue))}</td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
            <Pagination
              page={summaryPagination.page}
              pageCount={summaryPagination.pageCount}
              total={summaryPagination.total}
              pageSize={summaryPagination.pageSize}
              onPage={summaryPagination.setPage}
            />
          </Panel>
        </>
      ) : null}

      <Panel title="Top sellers">
        {topSkus.isPending ? (
          <Skeleton rows={3} stats={0} />
        ) : topSkus.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load top SKUs" error={topSkus.error} onRetry={() => void topSkus.refetch()} />
          </div>
        ) : (
          <>
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Top selling SKUs</caption>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">
                    Qty
                  </th>
                  <th scope="col" className="num">
                    Revenue
                  </th>
                </tr>
              </thead>
              <MotionTbody>
                {topPagination.visible.map((row, index) => (
                  <MotionTr key={row.sku.id} index={index}>
                    <SkuTableCell
                      code={row.sku.code}
                      styleName={row.sku.styleName}
                      color={row.sku.color}
                      size={row.sku.size}
                    />
                    <td className="num">{row.quantity}</td>
                    <td className="num">{formatPrice(Number(row.revenue))}</td>
                  </MotionTr>
                ))}
              </MotionTbody>
            </table>
          </div>
          <Pagination
            page={topPagination.page}
            pageCount={topPagination.pageCount}
            total={topPagination.total}
            pageSize={topPagination.pageSize}
            onPage={topPagination.setPage}
          />
          </>
        )}
      </Panel>
    </>
  )
}
