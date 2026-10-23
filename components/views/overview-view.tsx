'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, BarChart3, ChevronRight, CircleAlert, ClipboardList, Package, PackagePlus, Truck } from 'lucide-react'
import { useDashboardUI } from '@/components/dashboard/dashboard-ui-provider'
import { MovementsTable } from '@/components/dashboard/movements-table'
import { EmptyState, PageHeader, Panel } from '@/components/dashboard/primitives'
import { StockChart } from '@/components/dashboard/stock-chart'
import { useInventory } from '@/components/inventory/inventory-provider'
import { formatCurrency, formatLongDate, formatNumber } from '@/lib/format'
import { isMovementInScope, selectActivitySeries, selectStats, selectStockAlerts } from '@/lib/inventory/selectors'
import { ALL_BRANCHES } from '@/lib/inventory/types'

const periods = [7, 30, 90] as const

function StatCard({ label, value, detail, href, icon: Icon, tone }: { label: string; value: string; detail: string; href: string; icon: typeof Package; tone?: 'alert' }) {
  return (
    <Link href={href} className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="stat-value tabular">{value}</div>
      <div className={`stat-detail ${tone === 'alert' ? 'detail-alert' : ''}`}>{detail}</div>
    </Link>
  )
}

export function OverviewView() {
  const { state, scope, branchName } = useInventory()
  const { openDrawer } = useDashboardUI()
  const [period, setPeriod] = useState<(typeof periods)[number]>(30)

  const stats = useMemo(() => selectStats(state, scope), [state, scope])
  const alerts = useMemo(() => selectStockAlerts(state, scope), [state, scope])
  const series = useMemo(() => selectActivitySeries(state.movements, scope, period), [state.movements, scope, period])
  const recent = useMemo(() => state.movements.filter((m) => isMovementInScope(m, scope)).slice(0, 6), [state.movements, scope])
  const scopeLabel = scope === ALL_BRANCHES ? 'all branches' : branchName(scope)

  if (!state.branches.length) {
    return (
      <>
        <PageHeader title="Overview" description="Monitor Bitar Fashion inventory across your network." />
        <section className="panel">
          <EmptyState
            icon={PackagePlus}
            title="Set up your first branch"
            description="Add a store or warehouse, then add products to start tracking stock."
            action={
              <button type="button" className="btn btn-primary" onClick={() => openDrawer({ kind: 'branch' })}>
                Add branch
              </button>
            }
          />
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(new Date())}
        title="Overview"
        description={`Inventory health for ${scopeLabel}.`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => openDrawer({ kind: 'stock' })}>
              <PackagePlus size={16} /> Record stock
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openDrawer({ kind: 'transfer', fromBranchId: scope === ALL_BRANCHES ? undefined : scope })}>
              <ArrowLeftRight size={16} /> Transfer stock
            </button>
          </>
        }
      />

      <div className="stats-grid">
        <StatCard label="Inventory value" value={formatCurrency(stats.value, state.settings.currency)} detail={`${formatNumber(stats.units)} units at retail`} href="/products?sort=value&dir=desc" icon={BarChart3} />
        <StatCard label="Active SKUs" value={formatNumber(stats.skuCount)} detail={scope === ALL_BRANCHES ? `Across ${state.branches.length} branches` : 'Stocked at this branch'} href="/products" icon={Package} />
        <StatCard
          label="Stock alerts"
          value={formatNumber(stats.lowCount + stats.outCount)}
          detail={stats.outCount ? `${stats.outCount} out of stock` : 'Nothing out of stock'}
          href="/products?status=attention"
          icon={CircleAlert}
          tone={stats.outCount ? 'alert' : undefined}
        />
        <StatCard label="Transfers in transit" value={formatNumber(stats.inTransit)} detail={stats.inTransit ? 'Awaiting receipt' : 'All transfers received'} href="/movements?status=in_transit" icon={Truck} />
      </div>

      <div className="dashboard-grid">
        <Panel
          title="Stock activity"
          description={scope === ALL_BRANCHES ? 'Units received vs sold or removed. Internal transfers excluded.' : 'Units in vs out, including transfers.'}
          actions={
            <label className="select-inline">
              <span className="sr-only">Period</span>
              <select value={period} onChange={(e) => setPeriod(Number(e.target.value) as (typeof periods)[number])}>
                {periods.map((p) => (
                  <option key={p} value={p}>
                    Last {p} days
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <StockChart data={series} />
        </Panel>

        <Panel
          title="Needs attention"
          description={alerts.length ? `${alerts.length} stock levels below reorder point` : 'Everything is above reorder point'}
          actions={
            <Link href="/products?status=attention" className="more-link">
              View all <ChevronRight size={14} />
            </Link>
          }
        >
          {alerts.length === 0 ? (
            <EmptyState icon={Package} title="All stocked up" description="No products are below their reorder point." />
          ) : (
            <ul className="attention-list">
              {alerts.slice(0, 5).map((a) => (
                <li key={`${a.productId}-${a.branchId}`}>
                  <button type="button" className="attention-item" onClick={() => openDrawer({ kind: 'stock', productId: a.productId, branchId: a.branchId, mode: 'stock_in' })}>
                    <span className={`attention-icon ${a.status === 'out' ? 'red' : ''}`} aria-hidden="true">
                      <CircleAlert size={15} />
                    </span>
                    <span className="attention-text">
                      <strong>{a.productName}</strong>
                      <small>
                        {branchName(a.branchId)} · {a.onHand} on hand, min {a.reorderPoint}
                      </small>
                    </span>
                    <span className="attention-cta">Restock</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent movements"
        description={`Latest inventory changes for ${scopeLabel}`}
        actions={
          <Link href="/movements" className="more-link">
            View all <ChevronRight size={14} />
          </Link>
        }
      >
        {recent.length ? (
          <MovementsTable rows={recent} />
        ) : (
          <EmptyState icon={ClipboardList} title="No movements yet" description="Receive, sell, or transfer stock to see activity here." />
        )}
      </Panel>
    </>
  )
}
