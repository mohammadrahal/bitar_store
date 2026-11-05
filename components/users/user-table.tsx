'use client'

import { KeyRound, Pencil, Trash2, Users } from 'lucide-react'
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
  lastSuperAdminId,
  onCreate,
  onEdit,
  onPermissions,
  onDelete,
  onActiveChange,
  pendingUserId,
}: {
  users: StaffUser[]
  branches?: Branch[]
  /** When set, the Branches column shows only this location. */
  branchFilter?: string
  currentUserId: string
  /** The only active super admin, who may not be switched off. */
  lastSuperAdminId: string | null
  onCreate: () => void
  onEdit: (user: StaffUser) => void
  onPermissions: (user: StaffUser) => void
  onDelete: (user: StaffUser) => void
  onActiveChange: (user: StaffUser, isActive: boolean) => void
  pendingUserId?: string | null
}) {
  const { can, superAdmin } = usePermission()
  const mayDeactivate = can('users.deactivate')
  const branchName = (id: string) => branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8)

  function branchSummary(user: StaffUser) {
    if (branchFilter) {
      return user.branchIds.includes(branchFilter) ? branchName(branchFilter) : '—'
    }
    if (user.role === 'super_admin' || user.branchAccessMode === 'all') return 'All branches'
    if (user.branchIds.length === 0) return '—'
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
    if (isSelf) return `${user.fullName} — you cannot deactivate your own account`
    if (user.id === lastSuperAdminId) return `${user.fullName} is the only active super admin`
    if (!mayDeactivate) return `${user.fullName} — only a super admin can deactivate employees`
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
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Employees</caption>
        <thead>
          <tr>
            <SortableTh columnKey="name" label="Name" sort={sort} />
            <SortableTh columnKey="email" label="Email" sort={sort} />
            <SortableTh columnKey="role" label="Role" sort={sort} />
            <SortableTh columnKey="branches" label="Branches" sort={sort} />
            <SortableTh columnKey="active" label="Active" sort={sort} />
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <MotionTbody>
          {visible.map((user, index) => {
            const isSelf = user.id === currentUserId
            const locked = isSelf || user.id === lastSuperAdminId || !mayDeactivate
            return (
              <MotionTr key={user.id} index={index}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td className="muted">{branchSummary(user)}</td>
                <td>
                  <SwitchToggle
                    checked={user.isActive}
                    disabled={locked || pendingUserId === user.id}
                    label={activeLabel(user, isSelf)}
                    onCheckedChange={(isActive) => onActiveChange(user, isActive)}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    {!isSelf && user.role !== 'super_admin' && (superAdmin || user.role === 'employee') && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onPermissions(user)}
                        aria-label={`Permissions for ${user.fullName}`}
                        title="Permissions"
                      >
                        <KeyRound size={16} />
                      </button>
                    )}
                    {superAdmin && !isSelf && (
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
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onEdit(user)}
                      aria-label={`Edit ${user.fullName}`}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
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
