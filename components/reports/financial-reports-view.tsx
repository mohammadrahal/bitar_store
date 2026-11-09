'use client'

import { useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { RevenueTrendChart } from '@/components/dashboard/revenue-trend-chart'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { Skeleton } from '@/components/shared/skeleton'
import { SkuTableCell } from '@/components/shared/table-empty'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { useSalesSummaryReport, useTopSkusReport } from '@/hooks/use-reports-api'
import { useBranches } from '@/hooks/use-branches'
import type { ApiSalesSummaryRow } from '@/lib/api/types'
import { formatNumber, formatPrice } from '@/lib/format'
import type { TrendPoint } from '@/services/dashboard-trend.service'

type Quarter = 'q1' | 'q2' | 'q3' | 'q4' | 'custom'

function currentQuarter(): Quarter {
  const month = new Date().getMonth()
  if (month < 3) return 'q1'
  if (month < 6) return 'q2'
  if (month < 9) return 'q3'
  return 'q4'
}

function quarterBounds(quarter: Quarter, year: number): { from: string; to: string } | null {
  if (quarter === 'custom') return null
  const map: Record<Exclude<Quarter, 'custom'>, [string, string]> = {
    q1: [`${year}-01-01`, `${year}-03-31`],
    q2: [`${year}-04-01`, `${year}-06-30`],
    q3: [`${year}-07-01`, `${year}-09-30`],
    q4: [`${year}-10-01`, `${year}-12-31`],
  }
  const [from, to] = map[quarter]
  return { from, to }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addMoney(rows: ApiSalesSummaryRow[]): ApiSalesSummaryRow {
  const sum = (key: keyof ApiSalesSummaryRow) =>
    rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0).toFixed(2)
  return {
    salesCount: rows.reduce((acc, row) => acc + row.salesCount, 0),
    items: rows.reduce((acc, row) => acc + row.items, 0),
    revenue: sum('revenue'),
    discounts: sum('discounts'),
    cash: sum('cash'),
    whish: sum('whish'),
    inStore: sum('inStore'),
    socialMedia: sum('socialMedia'),
  }
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function downloadLedgerCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const lines = [header, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function FinancialReportsView({ embedded = false }: { embedded?: boolean } = {}) {
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const { data: branches } = useBranches()
  const year = new Date().getFullYear()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const initialQuarter = currentQuarter()
  const [quarter, setQuarter] = useState<Quarter>(initialQuarter)
  const [from, setFrom] = useState(quarterBounds(initialQuarter, year)?.from ?? todayIso())
  const [to, setTo] = useState(quarterBounds(initialQuarter, year)?.to ?? todayIso())

  const applyQuarter = (next: Quarter) => {
    setQuarter(next)
    if (next === 'custom') return
    const bounds = quarterBounds(next, year)
    if (bounds) {
      setFrom(bounds.from)
      setTo(bounds.to)
    }
  }

  const summary = useSalesSummaryReport(branchId, from, to)
  const topSkus = useTopSkusReport(branchId, from, to)

  const totals = summary.data?.totals
  const revenue = totals ? Number(totals.revenue) : 0
  const cash = totals ? Number(totals.cash) : 0
  const whish = totals ? Number(totals.whish) : 0
  const cashPct = revenue > 0 ? Math.round((cash / revenue) * 100) : 0
  const whishPct = revenue > 0 ? Math.round((whish / revenue) * 100) : 0

  const chartPoints: TrendPoint[] = useMemo(() => {
    const byDay = summary.data?.byDay ?? []
    if (byDay.length > 0) {
      return byDay.map((row) => ({
        day: row.day,
        revenue: Number(row.revenue),
        sales: row.salesCount,
      }))
    }
    const rows = summary.data?.rows ?? []
    const byDayMap = new Map<string, TrendPoint>()
    for (const row of rows) {
      const existing = byDayMap.get(row.day)
      if (!existing) {
        byDayMap.set(row.day, { day: row.day, revenue: Number(row.revenue), sales: row.salesCount })
      } else {
        existing.revenue += Number(row.revenue)
        existing.sales += row.salesCount
      }
    }
    return [...byDayMap.values()].sort((a, b) => a.day.localeCompare(b.day))
  }, [summary.data])

  const monthlyRows = useMemo(() => {
    const buckets = new Map<string, ApiSalesSummaryRow[]>()
    const dayRows = summary.data?.byDay ?? []
    const source = dayRows.length > 0 ? dayRows : (summary.data?.rows ?? [])
    for (const row of source) {
      const month = row.day.slice(0, 7)
      const list = buckets.get(month) ?? []
      list.push(row)
      buckets.set(month, list)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, rows]) => ({ month, rows }))
  }, [summary.data])

  const topCategories = useMemo(() => {
    const rows = topSkus.data?.rows ?? []
    const byStyle = new Map<string, { name: string; revenue: number; qty: number }>()
    for (const row of rows) {
      const name = row.sku.styleName
      const existing = byStyle.get(name) ?? { name, revenue: 0, qty: 0 }
      existing.revenue += Number(row.revenue)
      existing.qty += row.quantity
      byStyle.set(name, existing)
    }
    return [...byStyle.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  }, [topSkus.data])

  const branchRows = summary.data?.byBranch ?? []

  const exportCsv = () => {
    if (!summary.data) return
    const header = ['Day', 'Revenue USD', 'Sales', 'Cash', 'Whish', 'In-store', 'Social', 'Discounts']
    const rows =
      summary.data.byDay?.map((row) => [
        row.day,
        row.revenue,
        row.salesCount,
        row.cash,
        row.whish,
        row.inStore,
        row.socialMedia,
        row.discounts,
      ]) ??
      summary.data.rows.map((row) => [
        row.day,
        row.revenue,
        row.salesCount,
        row.cash,
        row.whish,
        row.inStore,
        row.socialMedia,
        row.discounts,
      ])
    downloadLedgerCsv(`bitar-sales-${from}-to-${to}.csv`, header, rows)
  }

  const branchLabel =
    branchId && branches?.find((b) => b.id === branchId)?.name
      ? branches.find((b) => b.id === branchId)!.name
      : 'All boutiques'

  return (
    <div className="financial-reports-page">
      {!embedded ? (
        <PageHeader
          eyebrow="Governance"
          title="Financial reports"
          description="Revenue and payment mix from GET /reports/sales-summary. VAT, MoF PDF, and fiscal seal are not on the API yet."
        />
      ) : null}

      <header className="financial-reports-hero">
        <div className="financial-reports-hero-main">
          <h2 className="financial-reports-hero-title">Financial reports &amp; fiscal audit</h2>
          <p className="muted financial-reports-hero-sub">
            {branchLabel} · consolidated USD · {from} → {to}
          </p>
          <p className="financial-reports-source-badge" title="Figures from GET /reports/sales-summary">
            Ledger source · sales-summary API
          </p>
        </div>
        <div className="financial-reports-hero-actions">
          <button type="button" className="btn btn-secondary" disabled={!summary.data} onClick={exportCsv}>
            <Download size={16} aria-hidden="true" />
            Export ledger (CSV)
          </button>
          <button type="button" className="btn btn-primary" disabled title="MoF declaration PDF is not on the API yet">
            <FileText size={16} aria-hidden="true" />
            MoF declaration (PDF)
          </button>
        </div>
      </header>

      <Panel title="Filters" className="financial-reports-filters-panel">
        <div className="panel-body financial-reports-filters">
          <Field label="View">
            <div className="financial-reports-view-toggle" role="group" aria-label="Currency view">
              <span className="financial-reports-view-toggle-active">Consolidated USD</span>
              <span className="financial-reports-view-toggle-muted" title="LBP tax base not on API">
                LBP peg (pending API)
              </span>
            </div>
          </Field>
          <Field label="Fiscal period">
            <select
              className="input"
              value={quarter}
              onChange={(event) => applyQuarter(event.target.value as Quarter)}
            >
              <option value="q1">Q1 · Jan–Mar {year}</option>
              <option value="q2">Q2 · Apr–Jun {year}</option>
              <option value="q3">Q3 · Jul–Sep {year}</option>
              <option value="q4">Q4 · Oct–Dec {year}</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>
          {allowPageBranchFilter && (
            <Field label="Perimeter">
              <LocationSelect value={pageBranchId} onChange={setPageBranchId} onlyAccessible placeholder="All boutiques" />
            </Field>
          )}
          {quarter === 'custom' && (
            <>
              <Field label="From">
                <input type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="To">
                <input type="date" className="input" value={to} onChange={(event) => setTo(event.target.value)} />
              </Field>
            </>
          )}
        </div>
      </Panel>

      {summary.isPending ? (
        <Skeleton rows={3} stats={4} />
      ) : summary.isError ? (
        <ErrorState title="Could not load sales summary" error={summary.error} onRetry={() => void summary.refetch()} />
      ) : totals ? (
        <div className="financial-reports-stack">
          <div className="financial-reports-kpi-grid">
            <article className="financial-reports-kpi">
              <p className="financial-reports-kpi-label">Gross revenue</p>
              <p className="financial-reports-kpi-value tabular">
                <PriceWithLbp usd={revenue} strong />
              </p>
              <p className="muted financial-reports-kpi-foot">
                {formatNumber(totals.salesCount)} {totals.salesCount === 1 ? 'sale' : 'sales'} in range
              </p>
            </article>
            <article className="financial-reports-kpi financial-reports-kpi--gold">
              <p className="financial-reports-kpi-label">Cash (USD)</p>
              <p className="financial-reports-kpi-value tabular">{formatPrice(cash)}</p>
              <p className="muted financial-reports-kpi-foot">{cashPct}% of revenue</p>
            </article>
            <article className="financial-reports-kpi">
              <p className="financial-reports-kpi-label">Whish / digital</p>
              <p className="financial-reports-kpi-value tabular">{formatPrice(whish)}</p>
              <p className="muted financial-reports-kpi-foot">{whishPct}% of revenue</p>
            </article>
            <article className="financial-reports-kpi">
              <p className="financial-reports-kpi-label">Line discounts</p>
              <p className="financial-reports-kpi-value tabular">{formatPrice(Number(totals.discounts))}</p>
              <p className="muted financial-reports-kpi-foot">
                In-store {formatPrice(Number(totals.inStore))} · Social {formatPrice(Number(totals.socialMedia))}
              </p>
            </article>
          </div>

          <div className="financial-reports-split">
            <Panel title="Revenue by day" description="Shop days in the selected range (Lebanon business date).">
              <div className="panel-body">
                {chartPoints.length === 0 ? (
                  <p className="muted">No sales in this period.</p>
                ) : (
                  <RevenueTrendChart points={chartPoints} />
                )}
              </div>
            </Panel>

            <Panel title="Top styles" description="From GET /reports/top-skus in the same window.">
              <div className="panel-body financial-reports-category-list">
                {topSkus.isPending ? (
                  <p className="muted">Loading…</p>
                ) : topCategories.length === 0 ? (
                  <p className="muted">No SKU sales in range.</p>
                ) : (
                  topCategories.map((row) => {
                    const pct = revenue > 0 ? Math.min(100, Math.round((row.revenue / revenue) * 100)) : 0
                    return (
                      <div key={row.name} className="financial-reports-category-row">
                        <div className="financial-reports-category-head">
                          <span>{row.name}</span>
                          <span className="tabular">{formatPrice(row.revenue)}</span>
                        </div>
                        <div className="financial-reports-category-bar" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <small className="muted">
                          {formatNumber(row.qty)} units · {pct}% of period revenue
                        </small>
                      </div>
                    )
                  })
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Period breakdown" description="Revenue by calendar month. All amounts from the sales-summary API.">
            <div className="table-wrap financial-reports-table-wrap">
              <table className="invoice-picker-table financial-reports-table">
                <caption className="sr-only">Monthly revenue breakdown</caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col" className="num">
                      Revenue (USD)
                    </th>
                    <th scope="col" className="num">
                      Sales
                    </th>
                    <th scope="col" className="num">
                      Cash
                    </th>
                    <th scope="col" className="num">
                      Whish
                    </th>
                    <th scope="col" className="num">
                      Discounts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map(({ month, rows }) => {
                    const rolled = addMoney(rows)
                    return (
                      <tr key={month}>
                        <th scope="row">{monthLabel(month)}</th>
                        <td className="num tabular financial-reports-amount">{formatPrice(Number(rolled.revenue))}</td>
                        <td className="num tabular">{rolled.salesCount}</td>
                        <td className="num tabular">{formatPrice(Number(rolled.cash))}</td>
                        <td className="num tabular">{formatPrice(Number(rolled.whish))}</td>
                        <td className="num tabular">{formatPrice(Number(rolled.discounts))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {branchRows.length > 0 && (
            <Panel title="By branch" description="One row per location in scope (including zero-sales branches when the API sends them).">
              <div className="table-wrap">
                <table className="card-table">
                  <thead>
                    <tr>
                      <th scope="col">Branch</th>
                      <th scope="col" className="num">
                        Revenue
                      </th>
                      <th scope="col" className="num">
                        Cash
                      </th>
                      <th scope="col" className="num">
                        Whish
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchRows.map((row) => {
                      const name =
                        'name' in row.branch && row.branch.name ? row.branch.name : row.branch.id
                      return (
                        <tr key={row.branch.id}>
                          <td>{name}</td>
                          <td className="num tabular">{formatPrice(Number(row.revenue))}</td>
                          <td className="num tabular">{formatPrice(Number(row.cash))}</td>
                          <td className="num tabular">{formatPrice(Number(row.whish))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel title="Top SKUs">
            {topSkus.isPending ? (
              <Skeleton rows={3} stats={0} />
            ) : topSkus.isError ? (
              <ErrorState title="Could not load top SKUs" error={topSkus.error} onRetry={() => void topSkus.refetch()} />
            ) : (
              <div className="table-wrap">
                <table className="card-table">
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
                  <tbody>
                    {(topSkus.data?.rows ?? []).map((row) => (
                      <tr key={row.sku.id}>
                        <SkuTableCell
                          code={row.sku.code}
                          styleName={row.sku.styleName}
                          color={row.sku.color}
                          size={row.sku.size}
                        />
                        <td className="num">{row.quantity}</td>
                        <td className="num tabular">{formatPrice(Number(row.revenue))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="financial-reports-footer-grid">
            <article className="financial-reports-footer-card">
              <h3 className="financial-reports-footer-title">Audit trail</h3>
              <p className="muted financial-reports-footer-copy">
                Line-level fiscal seal and SHA digest require a dedicated MoF export endpoint. Until then, use the governance
                audit log for entity sign-off.
              </p>
            </article>
            <article className="financial-reports-footer-card">
              <h3 className="financial-reports-footer-title">Till Z-reports</h3>
              <p className="muted financial-reports-footer-copy">
                Closed cash sessions support printable drawer summaries. VAT breakdown and tax stamps are not on{' '}
                <code className="financial-reports-inline-code">GET /cash-sessions</code> yet.
              </p>
            </article>
            <article className="financial-reports-footer-card">
              <h3 className="financial-reports-footer-title">MoF e-Filing</h3>
              <p className="muted financial-reports-footer-copy">
                PDF declaration export stays disabled until the backend exposes <code className="financial-reports-inline-code">reports.fiscal</code>.
                CSV export uses the same sales-summary window as this screen.
              </p>
            </article>
          </div>
        </div>
      ) : null}
    </div>
  )
}
