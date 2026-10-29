'use client'

import { useState } from 'react'
import { Pencil, Plus, Truck } from 'lucide-react'
import { SupplierForm } from '@/components/receiving/supplier-form'
import { EmptyState } from '@/components/shared/empty-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { SwitchToggle } from '@/components/shared/switch'
import { usePermission } from '@/hooks/use-permission'
import { useSetSupplierArchived, useSuppliers } from '@/hooks/use-receiving'
import type { Supplier } from '@/types'

/** Who the goods come from. An employee only picks one; an owner role maintains the list. */
export function SuppliersPanel() {
  const { can } = usePermission()
  const { data, isPending } = useSuppliers(true)
  const suppliers = data ?? []
  const setArchived = useSetSupplierArchived()
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [adding, setAdding] = useState(false)
  const mayManage = can('suppliers.manage')

  return (
    <>
      <Panel
        title="Suppliers"
        description={isPending ? 'Loading…' : `${suppliers.length} on file`}
        actions={
          mayManage ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
              <Plus size={14} aria-hidden="true" />
              Add supplier
            </button>
          ) : null
        }
      >
        {isPending ? (
          <div className="panel-body">
            <Skeleton rows={2} stats={0} />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add the businesses Bitar buys from; every receipt names one."
              action={
                mayManage ? (
                  <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                    Add supplier
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Suppliers</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  {mayManage && (
                    <>
                      <th scope="col">Active</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="card-title" data-label="Name">
                      {supplier.name}
                    </td>
                    <td data-label="Phone" className="tabular">
                      {supplier.phone}
                    </td>
                    {mayManage && (
                      <>
                        <td data-label="Active">
                          <SwitchToggle
                            checked={!supplier.archived}
                            disabled={setArchived.isPending}
                            label={`${supplier.archived ? 'Restore' : 'Archive'} ${supplier.name}`}
                            onCheckedChange={(active) =>
                              setArchived.mutate({ id: supplier.id, archived: !active })
                            }
                          />
                        </td>
                        <td data-label="Actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Edit ${supplier.name}`}
                            title="Edit"
                            onClick={() => setEditing(supplier)}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {adding && <SupplierForm onClose={() => setAdding(false)} />}
      {editing && <SupplierForm supplier={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
