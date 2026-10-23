'use client'

import { useMemo } from 'react'
import { ArrowLeftRight, MapPin, Pencil, Plus, Store, Trash2, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardUI } from '@/components/dashboard/dashboard-ui-provider'
import { EmptyState, PageHeader } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { formatCurrency, formatNumber } from '@/lib/format'
import { selectStats } from '@/lib/inventory/selectors'
import type { Branch } from '@/lib/inventory/types'

export function BranchesView() {
  const { state, scope, setScope, deleteBranch } = useInventory()
  const { openDrawer, confirm } = useDashboardUI()

  const cards = useMemo(() => state.branches.map((b) => ({ branch: b, stats: selectStats(state, b.id) })), [state])

  async function remove(branch: Branch) {
    const ok = await confirm({
      title: `Delete ${branch.name}?`,
      description: 'The branch will be removed. Its movement history is kept for auditing.',
      confirmLabel: 'Delete branch',
      tone: 'danger',
    })
    if (!ok) return
    const result = deleteBranch(branch.id)
    if (result.ok) toast.success(`Deleted “${branch.name}”`)
    else toast.error(result.error)
  }

  return (
    <>
      <PageHeader
        title="Branches"
        description={`${state.branches.length} locations in the Bitar Fashion network.`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openDrawer({ kind: 'branch' })}>
            <Plus size={16} /> Add branch
          </button>
        }
      />

      {cards.length === 0 ? (
        <section className="panel">
          <EmptyState icon={Store} title="No branches yet" description="Add a store or warehouse to start tracking stock." />
        </section>
      ) : (
        <div className="branch-cards">
          {cards.map(({ branch: b, stats }) => {
            const Icon = b.type === 'store' ? Store : Warehouse
            return (
              <article key={b.id} className={`branch-card ${scope === b.id ? 'selected' : ''}`}>
                <header className="branch-card-head">
                  <span className="branch-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <div>
                    <h2>{b.name}</h2>
                    <small>
                      {b.code} · {b.type === 'store' ? 'Store' : 'Warehouse'}
                    </small>
                  </div>
                </header>
                <p className="branch-address">
                  <MapPin size={14} aria-hidden="true" /> {b.address || 'No address on file'}
                </p>
                <dl className="branch-stats">
                  <div>
                    <dt>Value</dt>
                    <dd className="tabular">{formatCurrency(stats.value, state.settings.currency, true)}</dd>
                  </div>
                  <div>
                    <dt>Units</dt>
                    <dd className="tabular">{formatNumber(stats.units)}</dd>
                  </div>
                  <div>
                    <dt>SKUs</dt>
                    <dd className="tabular">{formatNumber(stats.skuCount)}</dd>
                  </div>
                  <div>
                    <dt>Alerts</dt>
                    <dd className={`tabular ${stats.lowCount + stats.outCount ? 'detail-alert' : ''}`}>{formatNumber(stats.lowCount + stats.outCount)}</dd>
                  </div>
                </dl>
                <footer className="branch-card-actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setScope(scope === b.id ? 'all' : b.id)} aria-pressed={scope === b.id}>
                    {scope === b.id ? 'Viewing' : 'View branch'}
                  </button>
                  <button type="button" className="icon-btn" title="Transfer from this branch" aria-label={`Transfer from ${b.name}`} onClick={() => openDrawer({ kind: 'transfer', fromBranchId: b.id })}>
                    <ArrowLeftRight size={15} />
                  </button>
                  <button type="button" className="icon-btn" title="Edit" aria-label={`Edit ${b.name}`} onClick={() => openDrawer({ kind: 'branch', branchId: b.id })}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${b.name}`} onClick={() => remove(b)}>
                    <Trash2 size={15} />
                  </button>
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
