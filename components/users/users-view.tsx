'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { UserForm } from '@/components/users/user-form'
import { UserTable } from '@/components/users/user-table'
import { MotionSwap } from '@/components/motion/motion-swap'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { LocationSelect } from '@/components/shared/location-select'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { useDeleteUser, useSetUserActive, useUsers } from '@/hooks/use-users'
import { undeactivatableUsers, type StaffUser } from '@/services/users.service'
import { useCurrentUser } from '@/store/user-store'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: StaffUser }
  | { kind: 'deactivate'; user: StaffUser }
  | { kind: 'delete'; user: StaffUser }

export function UsersView({ embedded = false }: { embedded?: boolean } = {}) {
  const currentUser = useCurrentUser()
  const { data: users, isPending, isError, error, refetch } = useUsers()
  const { data: branches } = useBranches()
  const setActive = useSetUserActive()
  const remove = useDeleteUser()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [branchFilter, setBranchFilter] = useState('')
  const close = () => setDialog(null)

  const visibleUsers = useMemo(() => {
    if (!users) return []
    if (!branchFilter) return users
    return users.filter((user) => user.branchIds.includes(branchFilter))
  }, [users, branchFilter])

  /* Rule 8: the last active admin AND the last active manager are both locked. */
  const undeactivatable = useMemo(() => undeactivatableUsers(users ?? []), [users])

  const handleActiveChange = (user: StaffUser, isActive: boolean) => {
    if (isActive) {
      setActive.mutate({ id: user.id, name: user.fullName, isActive: true })
      return
    }
    setDialog({ kind: 'deactivate', user })
  }

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Administration"
          title="Employees"
          description="Deactivating blocks sign-in and can be undone. Deleting removes the account; sales they rang up keep their name."
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
              <Plus size={16} aria-hidden="true" />
              Add employee
            </button>
          }
        />
      ) : null}

      <MotionSwap state={isPending ? 'loading' : isError ? 'error' : 'ready'}>
        {isPending ? (
          <Skeleton rows={1} stats={0} />
        ) : isError ? (
          <Panel title="All employees">
            <div className="panel-body">
              <ErrorState title="Could not load employees" error={error} onRetry={() => void refetch()} />
            </div>
          </Panel>
        ) : (
          <Panel
            title="All employees"
            description={
              branchFilter
                ? `${visibleUsers.length} of ${users.length} at ${branches?.find((b) => b.id === branchFilter)?.name ?? 'branch'}`
                : `${users.length} ${users.length === 1 ? 'employee' : 'employees'}`
            }
            actions={
              embedded ? (
                <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
                  <Plus size={16} aria-hidden="true" />
                  Add employee
                </button>
              ) : undefined
            }
          >
            <div className="toolbar toolbar--align-center">
              <div className="toolbar-inline" role="group" aria-label="Filter by branch">
                <span className="toolbar-inline-label">Branch</span>
                <LocationSelect
                  value={branchFilter}
                  onChange={setBranchFilter}
                  placeholder="All branches"
                  variant="inline"
                  size="sm"
                  className="btn btn-secondary toolbar-branch-trigger"
                  aria-label="Filter employees by branch"
                />
                {branchFilter && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBranchFilter('')}>
                    Clear
                  </button>
                )}
              </div>
            </div>
            <UserTable
              users={visibleUsers}
              branches={branches}
              branchFilter={branchFilter}
              currentUserId={currentUser.id}
              undeactivatable={undeactivatable}
              pendingUserId={setActive.isPending ? setActive.variables?.id : null}
              onCreate={() => setDialog({ kind: 'create' })}
              onEdit={(user) => setDialog({ kind: 'edit', user })}
              onDelete={(user) => setDialog({ kind: 'delete', user })}
              onActiveChange={handleActiveChange}
            />
          </Panel>
        )}
      </MotionSwap>

      {dialog?.kind === 'create' && <UserForm onClose={close} />}
      {dialog?.kind === 'edit' && <UserForm user={dialog.user} onClose={close} />}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.user.fullName}?`}
          description="They disappear from the list and cannot sign in. Sales, transfers and stock movements keep their name. You cannot delete yourself or the last admin."
          confirmLabel="Delete account"
          tone="danger"
          onResolve={(confirmed) => {
            const target = dialog.user
            close()
            if (confirmed) remove.mutate(target.id)
          }}
        />
      )}

      {dialog?.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${dialog.user.fullName}?`}
          description="They will not be able to sign in. The account and its history stay in the system. Turn Active back on to restore access."
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
