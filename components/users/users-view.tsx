'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { UserForm } from '@/components/users/user-form'
import { UserTable } from '@/components/users/user-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDeleteUser, useSetUserActive, useUsers } from '@/hooks/use-users'
import type { ApiUser } from '@/lib/api'
import { useCurrentUser } from '@/store/user-store'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: ApiUser }
  | { kind: 'deactivate'; user: ApiUser }
  | { kind: 'delete'; user: ApiUser }

export function UsersView() {
  const currentUser = useCurrentUser()
  const { data: users, isPending, isError, error, refetch } = useUsers()
  const setActive = useSetUserActive()
  const remove = useDeleteUser()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  const handleActiveChange = (user: ApiUser, isActive: boolean) => {
    if (isActive) {
      setActive.mutate({ id: user.id, name: user.fullName, isActive: true })
      return
    }
    setDialog({ kind: 'deactivate', user })
  }

  const pendingUserId = setActive.isPending
    ? setActive.variables?.id
    : remove.isPending
      ? remove.variables?.id
      : null

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Turn Active off to pause sign-in access, or delete an account to remove it for good."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
            <Plus size={16} aria-hidden="true" />
            Add user
          </button>
        }
      />

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
            pendingUserId={pendingUserId}
            onCreate={() => setDialog({ kind: 'create' })}
            onEdit={(user) => setDialog({ kind: 'edit', user })}
            onActiveChange={handleActiveChange}
            onDelete={(user) => setDialog({ kind: 'delete', user })}
          />
        </Panel>
      )}

      {dialog?.kind === 'create' && <UserForm onClose={close} />}
      {dialog?.kind === 'edit' && <UserForm user={dialog.user} onClose={close} />}

      {dialog?.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${dialog.user.fullName}?`}
          description="They will not be able to sign in. Their account stays in the system — turn Active back on to restore access."
          confirmLabel="Deactivate"
          tone="danger"
          onResolve={(confirmed) => {
            const target = dialog.user
            close()
            if (confirmed) setActive.mutate({ id: target.id, name: target.fullName, isActive: false })
          }}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.user.fullName}?`}
          description="This permanently removes the account and its branch access. To pause access instead, turn Active off."
          confirmLabel="Delete user"
          tone="danger"
          onResolve={(confirmed) => {
            const target = dialog.user
            close()
            if (confirmed) remove.mutate({ id: target.id, name: target.fullName })
          }}
        />
      )}
    </>
  )
}
