'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { BranchForm } from '@/components/branches/branch-form'
import { BranchTable } from '@/components/branches/branch-table'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'

export function BranchesView() {
  const { branchScoped } = usePermission()
  const { data: branches, isPending, isError, error, refetch } = useBranches()
  const [createOpen, setCreateOpen] = useState(false)

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
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
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
          <BranchTable branches={branches} onCreate={() => setCreateOpen(true)} />
        </Panel>
      )}

      {createOpen && <BranchForm onClose={() => setCreateOpen(false)} />}
    </>
  )
}
