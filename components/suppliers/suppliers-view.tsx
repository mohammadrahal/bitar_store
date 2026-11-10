'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { SupplierDrawer } from '@/components/suppliers/supplier-drawer'
import { MotionSwap } from '@/components/motion/motion-swap'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import { SwitchToggle } from '@/components/shared/switch'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useSetSupplierActive, useSuppliers } from '@/hooks/use-suppliers'
import type { ApiSupplier } from '@/lib/api/types'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; supplier: ApiSupplier }
  | { kind: 'deactivate'; supplier: ApiSupplier }

type ActiveFilter = 'all' | 'active' | 'inactive'

const ACTIVE_CHIPS: ChipOption<ActiveFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export function SuppliersView({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const setActive = useSetSupplierActive()
  const activeParam = activeFilter === 'all' ? undefined : activeFilter === 'active'
  const list = useSuppliers(search, activeParam)
  const close = () => setDialog(null)

  const rows = list.data?.items ?? []
  const total = list.data?.total ?? rows.length

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [rows],
  )

  const handleActiveChange = (supplier: ApiSupplier, isActive: boolean) => {
    if (isActive) {
      setActive.mutate({ id: supplier.id, active: true })
      return
    }
    setDialog({ kind: 'deactivate', supplier })
  }

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Stock"
          title="Suppliers"
          description="Who the warehouse buys from. Goods receipts link here so the same company is not spelled three different ways."
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
              <Plus size={16} aria-hidden="true" />
              Add supplier
            </button>
          }
        />
      ) : null}

      <MotionSwap state={list.isPending ? 'loading' : list.isError ? 'error' : 'ready'}>
        {list.isPending ? (
          <Skeleton rows={1} stats={0} />
        ) : list.isError ? (
          <Panel title="Suppliers">
            <div className="panel-body">
              <ErrorState title="Could not load suppliers" error={list.error} onRetry={() => void list.refetch()} />
            </div>
          </Panel>
        ) : (
          <Panel
            title="All suppliers"
            description={`${total} ${total === 1 ? 'supplier' : 'suppliers'} on the server`}
            actions={
              embedded ? (
                <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
                  <Plus size={16} aria-hidden="true" />
                  Add supplier
                </button>
              ) : undefined
            }
          >
            <div className="toolbar">
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search by name or phone"
                aria-label="Search suppliers"
              />
              <FilterChips label="Status" options={ACTIVE_CHIPS} value={activeFilter} onChange={setActiveFilter} />
            </div>

            {sorted.length === 0 ? (
              <div className="panel-body">
                <p className="muted">
                  {searchInput.trim()
                    ? 'Nothing matches that search.'
                    : activeFilter === 'inactive'
                      ? 'No inactive suppliers.'
                      : 'No suppliers yet. Add the first one, then pick them on a goods receipt.'}
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="card-table">
                  <caption className="sr-only">Suppliers</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Note</th>
                      <th scope="col">Active</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((supplier) => (
                      <tr key={supplier.id}>
                        <td className="card-title" data-label="Name">
                          {supplier.name}
                        </td>
                        <td className="tabular" data-label="Phone">
                          {supplier.phone ?? '—'}
                        </td>
                        <td data-label="Note">{supplier.note?.trim() ? supplier.note : '—'}</td>
                        <td data-label="Active">
                          <SwitchToggle
                            checked={supplier.isActive}
                            onCheckedChange={(next) => handleActiveChange(supplier, next)}
                            disabled={setActive.isPending}
                            label={
                              supplier.isActive
                                ? `${supplier.name} is active on new receipts`
                                : `Activate ${supplier.name}`
                            }
                          />
                        </td>
                        <td className="table-actions" data-label="Actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm icon-btn"
                            aria-label={`Edit ${supplier.name}`}
                            onClick={() => setDialog({ kind: 'edit', supplier })}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
      </MotionSwap>

      {dialog?.kind === 'create' && <SupplierDrawer onClose={close} />}
      {dialog?.kind === 'edit' && <SupplierDrawer key={dialog.supplier.id} supplier={dialog.supplier} onClose={close} />}
      {dialog?.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Switch off ${dialog.supplier.name}?`}
          description="They disappear from the picker on new receipts. Old deliveries that named them stay as they are."
          confirmLabel="Switch off"
          tone="danger"
          onResolve={(confirmed) => {
            const { id } = dialog.supplier
            close()
            if (confirmed) setActive.mutate({ id, active: false })
          }}
        />
      )}
    </>
  )
}
