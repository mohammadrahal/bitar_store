'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { BranchForm } from '@/components/branches/branch-form'
import { BranchTable } from '@/components/branches/branch-table'
import { Can } from '@/components/shared/can'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches, useDeleteBranch } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import type { Branch } from '@/types'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; branch: Branch }
  | { kind: 'delete'; branch: Branch }

export function BranchesView() {
  const { branchScoped } = usePermission()
  const { data: branches, isPending, isError, error, refetch } = useBranches()
  const remove = useDeleteBranch()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  return (
    <>
      <PageHeader
        eyebrow="Network"
        title="Branches"
        description={
          branchScoped
            ? 'The branch you work from.'
            : 'Create stores and assign employees to them from Users.'
        }
        actions={
          <Can action="branches:create">
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
              <Plus size={16} aria-hidden="true" />
              Add branch
            </button>
          </Can>
        }
      />

      {isPending ? (
        <Skeleton rows={1} stats={0} />
      ) : isError ? (
        <Panel title="All branches">
          <div className="panel-body">
            <ErrorState title="Could not load branches" error={error} onRetry={() => void refetch()} />
          </div>
        </Panel>
      ) : (
        <Panel
          title="All branches"
          description={`${branches.length} ${branches.length === 1 ? 'branch' : 'branches'}`}
        >
          <BranchTable
            branches={branches}
            onCreate={() => setDialog({ kind: 'create' })}
            onEdit={(branch) => setDialog({ kind: 'edit', branch })}
            onDelete={(branch) => setDialog({ kind: 'delete', branch })}
          />
        </Panel>
      )}

      {dialog?.kind === 'create' && <BranchForm onClose={close} />}
      {dialog?.kind === 'edit' && (
        <BranchForm key={dialog.branch.id} branch={dialog.branch} onClose={close} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.branch.name}?`}
          description="Staff granted access to this branch lose it, and anything recorded against it — stock and documents — goes with it. This cannot be undone."
          confirmLabel="Delete branch"
          tone="danger"
          onResolve={(confirmed) => {
            const { id, name } = dialog.branch
            close()
            if (confirmed) remove.mutate({ id, name })
          }}
        />
      )}
    </>
  )
}
