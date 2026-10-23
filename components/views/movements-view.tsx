'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowLeftRight, ClipboardList, Download, PackagePlus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardUI } from '@/components/dashboard/dashboard-ui-provider'
import { movementMeta, MovementsTable } from '@/components/dashboard/movements-table'
import { EmptyState, PageHeader, Pagination, Panel } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { useSearchState } from '@/hooks/use-query-state'
import { datedFilename, downloadFile, toCsv } from '@/lib/csv'
import { formatNumber } from '@/lib/format'
import { isMovementInScope } from '@/lib/inventory/selectors'
import { ALL_BRANCHES, type MovementType } from '@/lib/inventory/types'

const PAGE_SIZE = 15
const DEFAULT_PARAMS = { type: 'all', status: 'all', period: '30', page: '1' }
const DAY = 86_400_000

export function MovementsView() {
  const { state, scope, branchName } = useInventory()
  const { openDrawer } = useDashboardUI()
  const [params, setParams] = useSearchState(DEFAULT_PARAMS)
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.trim().toLowerCase())

  const filtered = useMemo(() => {
    const since = params.period === 'all' ? 0 : Date.now() - Number(params.period) * DAY
    return state.movements.filter((m) => {
      if (!isMovementInScope(m, scope)) return false
      if (params.type !== 'all' && m.type !== params.type) return false
      if (params.status !== 'all' && m.status !== params.status) return false
      // In-transit transfers stay visible regardless of age so they can't be forgotten.
      if (since && m.status !== 'in_transit' && new Date(m.createdAt).getTime() < since) return false
      if (query && !`${m.productName} ${m.sku} ${m.reference} ${m.user} ${m.note ?? ''}`.toLowerCase().includes(query)) return false
      return true
    })
  }, [state.movements, scope, params.type, params.status, params.period, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Number(params.page) || 1))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const inTransit = filtered.filter((m) => m.status === 'in_transit').length

  function exportCsv() {
    const csv = toCsv(
      ['Date', 'Type', 'Status', 'SKU', 'Product', 'Quantity', 'From / branch', 'To', 'Reference', 'User', 'Note'],
      filtered.map((m) => [
        m.createdAt,
        movementMeta[m.type].label,
        m.status ?? '',
        m.sku,
        m.productName,
        m.qty,
        branchName(m.branchId),
        m.toBranchId ? branchName(m.toBranchId) : '',
        m.reference,
        m.user,
        m.note ?? '',
      ]),
    )
    downloadFile(datedFilename('bitar-movements', 'csv'), csv)
    toast.success(`Exported ${filtered.length} movements`)
  }

  return (
    <>
      <PageHeader
        title="Stock movements"
        description={scope === ALL_BRANCHES ? 'Audit trail of every receipt, sale, transfer, and adjustment.' : `Audit trail for ${branchName(scope)}.`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={16} /> Export CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => openDrawer({ kind: 'stock' })}>
              <PackagePlus size={16} /> Record stock
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openDrawer({ kind: 'transfer', fromBranchId: scope === ALL_BRANCHES ? undefined : scope })}>
              <ArrowLeftRight size={16} /> Transfer stock
            </button>
          </>
        }
      />

      <Panel title="Movement history" description={`${formatNumber(filtered.length)} movements${inTransit ? ` · ${inTransit} in transit` : ''}`}>
        <div className="toolbar">
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search movements</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, reference, user…" />
          </label>
          <label className="select-inline">
            <span className="sr-only">Type</span>
            <select value={params.type} onChange={(e) => setParams({ type: e.target.value })}>
              <option value="all">All types</option>
              {(Object.keys(movementMeta) as MovementType[]).map((t) => (
                <option key={t} value={t}>
                  {movementMeta[t].label}
                </option>
              ))}
            </select>
          </label>
          <label className="select-inline">
            <span className="sr-only">Transfer status</span>
            <select value={params.status} onChange={(e) => setParams({ status: e.target.value, type: e.target.value === 'all' ? params.type : 'transfer' })}>
              <option value="all">Any status</option>
              <option value="in_transit">In transit</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="select-inline">
            <span className="sr-only">Period</span>
            <select value={params.period} onChange={(e) => setParams({ period: e.target.value })}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </label>
        </div>

        {visible.length ? (
          <MovementsTable rows={visible} />
        ) : (
          <EmptyState icon={ClipboardList} title="No movements found" description="Try a longer period or clear the filters." />
        )}
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={(p) => setParams({ page: String(p) })} />
      </Panel>
    </>
  )
}
