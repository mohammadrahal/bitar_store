'use client'

import Link from 'next/link'
import { Store } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ActiveStatusPill } from '@/components/shared/status-pill'
import type { Branch } from '@/types'

export function BranchTable({
  branches,
  onCreate,
}: {
  branches: Branch[]
  onCreate: () => void
}) {
  if (branches.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={Store}
          title="No branches yet"
          description="Add your first branch, then assign staff to it from the Users screen."
          action={
            <Can action="branches:create">
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
                <ActiveStatusPill isActive={branch.isActive} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
