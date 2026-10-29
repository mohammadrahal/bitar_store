'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { UserForm } from '@/components/users/user-form'
import { UserPermissionsForm } from '@/components/users/user-permissions-form'
import { UserTable } from '@/components/users/user-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { PreviewBadge } from '@/components/shared/preview-badge'
import { Skeleton } from '@/components/shared/skeleton'
import { useSetUserActive, useUsers } from '@/hooks/use-users'
import { isOnlyActiveSuperAdmin, type StaffUser } from '@/services/users.service'
import { useCurrentUser } from '@/store/user-store'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: StaffUser }
  | { kind: 'permissions'; user: StaffUser }
  | { kind: 'deactivate'; user: StaffUser }

export function UsersView() {
  const currentUser = useCurrentUser()
  const { data: users, isPending, isError, error, refetch } = useUsers()
  const setActive = useSetUserActive()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  const lastSuperAdminId = users?.find((user) => isOnlyActiveSuperAdmin(users, user.id))?.id ?? null

  const handleActiveChange = (user: StaffUser, isActive: boolean) => {
    if (isActive) {
      setActive.mutate({ id: user.id, name: user.fullName, isActive: true })
      return
    }
    setDialog({ kind: 'deactivate', user })
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Accounts are never deleted. Deactivating blocks sign-in and keeps every record the account is named on."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
            <Plus size={16} aria-hidden="true" />
            Add user
          </button>
        }
      />

      <PreviewBadge feature="Location assignments and employee permission keys" />

      {isPending ? (
        <Skeleton rows={1} stats={0} />
      ) : isError ? (
        <Panel title="All users">
          <div className="panel-body">
            <ErrorState title="Could not load users" error={error} onRetry={() => void refetch()} />
          </div>
        </Panel>
      ) : (
        <Panel title="All users" description={`${users.length} ${users.length === 1 ? 'account' : 'accounts'}`}>
          <UserTable
            users={users}
            currentUserId={currentUser.id}
            lastSuperAdminId={lastSuperAdminId}
            pendingUserId={setActive.isPending ? setActive.variables?.id : null}
            onCreate={() => setDialog({ kind: 'create' })}
            onEdit={(user) => setDialog({ kind: 'edit', user })}
            onPermissions={(user) => setDialog({ kind: 'permissions', user })}
            onActiveChange={handleActiveChange}
          />
        </Panel>
      )}

      {dialog?.kind === 'create' && <UserForm onClose={close} />}
      {dialog?.kind === 'edit' && <UserForm user={dialog.user} onClose={close} />}
      {dialog?.kind === 'permissions' && <UserPermissionsForm user={dialog.user} onClose={close} />}

      {dialog?.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${dialog.user.fullName}?`}
          description="They will not be able to sign in. The account and its history stay in the system — turn Active back on to restore access."
          confirmLabel="Deactivate"
          tone="danger"
          onResolve={(confirmed) => {
            const target = dialog.user
            close()
            if (confirmed) setActive.mutate({ id: target.id, name: target.fullName, isActive: false })
          }}
        />
      )}
    </>
  )
}
