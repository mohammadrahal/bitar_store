'use client'

import { Pencil, Trash2, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { SwitchToggle } from '@/components/shared/switch'
import type { ApiUser } from '@/lib/api'
import { ROLE_LABELS } from '@/lib/permissions'

export function UserTable({
  users,
  currentUserId,
  onCreate,
  onEdit,
  onActiveChange,
  onDelete,
  pendingUserId,
}: {
  users: ApiUser[]
  currentUserId: string
  onCreate: () => void
  onEdit: (user: ApiUser) => void
  onActiveChange: (user: ApiUser, isActive: boolean) => void
  /** Wire this when DELETE /users exists; until then the control stays disabled. */
  onDelete?: (user: ApiUser) => void
  pendingUserId?: string | null
}) {
  if (users.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Create staff accounts and assign each one to a branch."
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
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId
            return (
              <tr key={user.id}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td>
                  <SwitchToggle
                    checked={user.isActive}
                    disabled={isSelf || pendingUserId === user.id}
                    label={
                      isSelf
                        ? `${user.fullName} — you cannot deactivate your own account`
                        : `${user.isActive ? 'Deactivate' : 'Activate'} ${user.fullName}`
                    }
                    onCheckedChange={(isActive) => onActiveChange(user, isActive)}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onEdit(user)}
                      aria-label={`Edit ${user.fullName}`}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      disabled={!onDelete || isSelf}
                      onClick={() => onDelete?.(user)}
                      aria-label={
                        !onDelete
                          ? `Delete ${user.fullName} (not available yet)`
                          : isSelf
                            ? 'You cannot delete your own account'
                            : `Delete ${user.fullName}`
                      }
                      title={
                        !onDelete
                          ? 'Delete — coming soon (use Active to deactivate)'
                          : isSelf
                            ? 'Cannot delete yourself'
                            : 'Delete'
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
