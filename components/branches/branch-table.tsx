'use client'

import Link from 'next/link'
import { Pencil, Store, Trash2, Warehouse } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ActiveStatusPill } from '@/components/shared/status-pill'
import { useSetWarehouse, useWarehouseId } from '@/hooks/use-inventory'
import { BRANCH_WRITES } from '@/services/branches.service'
import type { Branch } from '@/types'

const UNAVAILABLE = 'Not supported by the API yet'

export function BranchTable({
  branches,
  onCreate,
  onEdit,
  onDelete,
}: {
  branches: Branch[]
  onCreate: () => void
  onEdit: (branch: Branch) => void
  onDelete: (branch: Branch) => void
}) {
  const { data: warehouseId } = useWarehouseId()
  const setWarehouse = useSetWarehouse()

  if (branches.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={Store}
          title="No branches yet"
          description="Add your first branch, then assign staff to it from the Users screen."
          action={
            <Can permission="settings.manage">
              <button type="button" className="btn btn-primary" onClick={onCreate}>
                Add branch
              </button>
            </Can>
          }
        />
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Branches</caption>
        <thead>
          <tr>
            <th scope="col">Branch</th>
            <th scope="col">Code</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr key={branch.id}>
              <td>
                <Link href={`/branches/${branch.id}`} className="link-cell">
                  {branch.name}
                </Link>
              </td>
              <td className="tabular-nums">{branch.code ?? branch.location}</td>
              <td>
                <span className="row-actions">
                  <ActiveStatusPill isActive={branch.isActive} />
                  {branch.id === warehouseId && <span className="pill pill-accent">Warehouse</span>}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  {branch.id !== warehouseId && (
                    <Can permission="settings.manage">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setWarehouse.mutate(branch.id)}
                        disabled={setWarehouse.isPending}
                        aria-label={`Make ${branch.name} the main warehouse`}
                        title="Set as warehouse"
                      >
                        <Warehouse size={16} />
                      </button>
                    </Can>
                  )}
                  <Can permission="settings.manage">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onEdit(branch)}
                      disabled={!BRANCH_WRITES.update}
                      aria-label={`Edit ${branch.name}`}
                      title={BRANCH_WRITES.update ? 'Edit' : UNAVAILABLE}
                    >
                      <Pencil size={16} />
                    </button>
                  </Can>
                  <Can permission="settings.manage">
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => onDelete(branch)}
                      disabled={!BRANCH_WRITES.deactivate || !branch.isActive}
                      aria-label={`Mark ${branch.name} inactive`}
                      title={
                        !branch.isActive
                          ? 'Already inactive'
                          : BRANCH_WRITES.deactivate
                            ? 'Mark inactive'
                            : UNAVAILABLE
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </Can>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
