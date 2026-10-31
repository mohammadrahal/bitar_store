'use client'

import { KeyRound, Pencil, Users } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { SwitchToggle } from '@/components/shared/switch'
import { usePermission } from '@/hooks/use-permission'
import { ROLE_LABELS } from '@/lib/permissions'
import type { StaffUser } from '@/services/users.service'

export function UserTable({
  users,
  currentUserId,
  lastSuperAdminId,
  onCreate,
  onEdit,
  onPermissions,
  onActiveChange,
  pendingUserId,
}: {
  users: StaffUser[]
  currentUserId: string
  /** The only active super admin, who may not be switched off. */
  lastSuperAdminId: string | null
  onCreate: () => void
  onEdit: (user: StaffUser) => void
  onPermissions: (user: StaffUser) => void
  onActiveChange: (user: StaffUser, isActive: boolean) => void
  pendingUserId?: string | null
}) {
  const { can } = usePermission()
  const mayDeactivate = can('users.deactivate')

  function activeLabel(user: StaffUser, isSelf: boolean) {
    if (isSelf) return `${user.fullName} — you cannot deactivate your own account`
    if (user.id === lastSuperAdminId) return `${user.fullName} is the only active super admin`
    if (!mayDeactivate) return `${user.fullName} — only a super admin can deactivate accounts`
    return `${user.isActive ? 'Deactivate' : 'Activate'} ${user.fullName}`
  }

  if (users.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Create staff accounts and assign each one to the locations they work at."
          action={
            <button type="button" className="btn btn-primary" onClick={onCreate}>
              Add user
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Users</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Active</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <MotionTbody>
          {users.map((user, index) => {
            const isSelf = user.id === currentUserId
            const locked = isSelf || user.id === lastSuperAdminId || !mayDeactivate
            return (
              <MotionTr key={user.id} index={index}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
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
                    {user.role === 'employee' && (
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
  )
}
