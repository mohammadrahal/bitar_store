'use client'

import Link from 'next/link'
import { Pencil, Store, Trash2, Warehouse } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ActiveStatusPill } from '@/components/shared/status-pill'
import { useSetWarehouse } from '@/hooks/use-inventory'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { branchHref } from '@/lib/branch-slug'
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
  const setWarehouse = useSetWarehouse()
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(branches)

  if (branches.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={Store}
          title="No branches yet"
          description="Add your first branch, then assign staff to it from the Employees screen."
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
    <>
      <div className="table-wrap table-wrap--invite-style">
        <table>
          <caption className="sr-only">Branches</caption>
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Code</th>
              <th scope="col">Kind</th>
              <th scope="col">Active</th>
              <th scope="col" className="num">
                Actions
              </th>
            </tr>
          </thead>
          <MotionTbody dataset={branches.map((b) => b.id).join(',')}>
            {visible.map((branch, index) => (
              <MotionTr key={branch.id} index={index} className="table-invite-row">
                <td>
                  <Link href={branchHref(branch)} className="link-cell">
                    {branch.name}
                  </Link>
                </td>
                <td className="tabular-nums">{branch.code ?? branch.location}</td>
                <td>{branch.kind === 'warehouse' ? 'Warehouse' : 'Branch'}</td>
                <td>
                  <ActiveStatusPill isActive={branch.isActive} />
                </td>
                <td>
                  <div className="row-actions row-actions--table-invite">
                    {branch.kind !== 'warehouse' && (
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
                        disabled={!BRANCH_WRITES.delete}
                        aria-label={`Delete ${branch.name}`}
                        title={BRANCH_WRITES.delete ? 'Delete branch' : UNAVAILABLE}
                      >
                        <Trash2 size={16} />
                      </button>
                    </Can>
                  </div>
                </td>
              </MotionTr>
            ))}
          </MotionTbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}
