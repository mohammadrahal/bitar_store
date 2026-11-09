'use client'

import Link from 'next/link'
import { Eye, Pencil, Trash2, Users } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { SortableTh } from '@/components/shared/sortable-th'
import { SwitchToggle } from '@/components/shared/switch'
import { Pagination } from '@/components/shared/pagination'
import { DEFAULT_TABLE_PAGE_SIZE, usePagination } from '@/hooks/use-pagination'
import { usePermission } from '@/hooks/use-permission'
import { useSortedRows, type SortAccessors } from '@/hooks/use-sorted-rows'
import { ROLE_LABELS } from '@/lib/permissions'
import type { StaffUser } from '@/services/users.service'
import type { Branch } from '@/types'

type SortKey = 'name' | 'email' | 'role' | 'branches' | 'active'

export function UserTable({
  users,
  branches,
  branchFilter,
  currentUserId,
  undeactivatable,
  onCreate,
  onEdit,
  onDelete,
  onActiveChange,
  pendingUserId,
}: {
  users: StaffUser[]
  branches?: Branch[]
  /** When set, the Branches column shows only this location. */
  branchFilter?: string
  currentUserId: string
  /** Accounts rule 8 protects, mapped to why ("the only active admin"). */
  undeactivatable: Map<string, string>
  onCreate: () => void
  onEdit: (user: StaffUser) => void
  onDelete: (user: StaffUser) => void
  onActiveChange: (user: StaffUser, isActive: boolean) => void
  pendingUserId?: string | null
}) {
  const { can } = usePermission()
  const mayDeactivate = can('users.deactivate')
  const branchName = (id: string) => branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8)

  function branchSummary(user: StaffUser) {
    if (branchFilter) {
      return user.branchIds.includes(branchFilter) ? branchName(branchFilter) : ''
    }
    if (user.role === 'super_admin' || user.branchAccessMode === 'all') return 'All branches'
    if (user.branchIds.length === 0) return ''
    return user.branchIds.map(branchName).join(', ')
  }

  const accessors: SortAccessors<StaffUser, SortKey> = {
    name: (user) => user.fullName,
    email: (user) => user.email,
    role: (user) => ROLE_LABELS[user.role],
    branches: (user) => branchSummary(user),
    /* Deactivated accounts first when sorted ascending: the reason to sort on
       this column is to find the ones that are switched off. */
    active: (user) => (user.isActive ? 1 : 0),
  }
  const sort = useSortedRows<StaffUser, SortKey>(users, accessors, { key: 'name', direction: 'asc' })
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(
    sort.rows ?? users,
    DEFAULT_TABLE_PAGE_SIZE,
    `${branchFilter ?? ''}-${sort.sort.key}-${sort.sort.direction}`,
  )

  function activeLabel(user: StaffUser, isSelf: boolean) {
    if (isSelf) return `${user.fullName}. You cannot deactivate your own account`
    const protectedAs = undeactivatable.get(user.id)
    if (protectedAs) return `${user.fullName} is ${protectedAs} and cannot be switched off`
    if (!mayDeactivate) return `${user.fullName}. Only an admin or business manager can deactivate employees`
    return `${user.isActive ? 'Deactivate' : 'Activate'} ${user.fullName}`
  }

  if (users.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Create staff accounts and assign each one to the locations they work at."
          action={
            <button type="button" className="btn btn-primary" onClick={onCreate}>
              Add employee
            </button>
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className="table-wrap table-wrap--invite-style">
        <table>
          <caption className="sr-only">Employees</caption>
          <thead>
            <tr>
              <SortableTh columnKey="name" label="Name" sort={sort} />
              <SortableTh columnKey="email" label="Email" sort={sort} />
              <SortableTh columnKey="role" label="Role" sort={sort} />
              <SortableTh columnKey="branches" label="Branches" sort={sort} />
              <SortableTh columnKey="active" label="Sign-in" sort={sort} />
              <th scope="col" className="num">
                Actions
              </th>
            </tr>
          </thead>
          <MotionTbody dataset={`users-${branchFilter ?? 'all'}`}>
            {visible.map((user, index) => {
              const isSelf = user.id === currentUserId
              const locked = isSelf || undeactivatable.has(user.id) || !mayDeactivate
              return (
                <MotionTr key={user.id} index={index} className="table-invite-row">
                  <td>
                    <Link href={`/users/${user.id}`} className="table-primary-link">
                      {user.fullName}
                    </Link>
                  </td>
                  <td>{user.email}</td>
                  <td>{ROLE_LABELS[user.role]}</td>
                  <td className="muted">{branchSummary(user)}</td>
                  <td>
                    <div className="user-signin-cell">
                      <span className="user-signin-label tabular">{user.isActive ? 'Active' : 'Inactive'}</span>
                      <SwitchToggle
                        checked={user.isActive}
                        disabled={locked || pendingUserId === user.id}
                        label={activeLabel(user, isSelf)}
                        onCheckedChange={(isActive) => onActiveChange(user, isActive)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="row-actions row-actions--table-invite">
                      <Link
                        href={`/users/${user.id}`}
                        className="icon-btn"
                        aria-label={`View ${user.fullName}`}
                        title="Profile"
                      >
                        <Eye size={16} />
                      </Link>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onEdit(user)}
                        aria-label={`Edit ${user.fullName}`}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {/* Rule 8 says removed *or* deactivated, so the delete
                          button is locked by the same list as the toggle.
                          Deleting the last manager left a network nobody could
                          approve anything in.

                          Gated on the key rather than on holding the Admin
                          role: both owner roles hold `users.deactivate` now. */}
                      {mayDeactivate && !isSelf && !undeactivatable.has(user.id) && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => onDelete(user)}
                          aria-label={`Delete ${user.fullName}`}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </MotionTr>
              )
            })}
          </MotionTbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}
