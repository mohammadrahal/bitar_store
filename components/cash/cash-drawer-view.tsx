'use client'

import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { CashDrawerClosedLayout } from '@/components/cash/cash-drawer-closed-layout'
import { CashDrawerZLayout } from '@/components/cash/cash-drawer-z-layout'
import { useBranches } from '@/hooks/use-branches'
import { useCurrentCashSession } from '@/hooks/use-cash-sessions'
import { useAllowPageBranchFilter } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { useSettings } from '@/hooks/use-settings'

/**
 * The drawer at one branch, start to finish, on one screen.
 *
 * Opening it, moving cash, handing it over and closing it are the whole of a
 * shift's cash handling, and they interleave: someone takes the drawer over at
 * noon, pays a courier at three, and closes at eight. Splitting them across
 * pages would mean navigating back to the figure you are counting against every
 * time, so they are panels on this one page, each showing the expected cash
 * they are measured against.
 *
 * The drawer belongs to a **branch**, not to a person. An employee sees their
 * own; an owner picks one, because "the drawer" is meaningless across a network
 * and a count entered against the wrong branch is a shortfall invented in one
 * till and a surplus in another.
 */
export function CashDrawerView({
  branchId,
  onBranchChange,
}: {
  branchId: string
  onBranchChange: (branchId: string) => void
}) {
  const { can, locationScoped } = usePermission()
  const allowBranchPicker = useAllowPageBranchFilter()
  const { data: branches } = useBranches()
  const settings = useSettings()
  const session = useCurrentCashSession(branchId)

  const branchName = branches?.find((branch) => branch.id === branchId)?.name ?? 'this branch'
  const required = settings.data?.requireOpenCashSession ?? false

  const canOpen = can('cash.open', branchId || undefined)
  const canAccept = can('cash.accept', branchId || undefined)
  const canClose = can('cash.close', branchId || undefined)
  const canMove = can('cash.move', branchId || undefined)

  const picker =
    allowBranchPicker && !locationScoped ? (
      <Field label="Drawer at" className="sale-location-field">
        <LocationSelect value={branchId} onChange={onBranchChange} onlyAccessible onlyFullAccess />
      </Field>
    ) : null

  if (!branchId) {
    return (
      <>
        {picker}
        <Panel title="Choose a branch" description="A cash drawer belongs to one till at one branch.">
          <p className="panel-body muted">
            Pick the branch above to see its drawer. Counting one branch&apos;s cash against another&apos;s expected
            figure would show a shortfall at one till and a surplus at the other.
          </p>
        </Panel>
      </>
    )
  }

  if (session.isPending) {
    return (
      <>
        {picker}
        <Skeleton rows={4} stats={4} />
      </>
    )
  }

  if (session.isError) {
    return (
      <>
        {picker}
        <ErrorState
          title="Could not load the drawer"
          error={session.error}
          onRetry={() => void session.refetch()}
        />
      </>
    )
  }

  const open = session.data

  if (!open) {
    return (
      <>
        {picker}
        <CashDrawerClosedLayout
          branchId={branchId}
          branchName={branchName}
          canOpen={canOpen}
          salesBlocked={required}
        />
      </>
    )
  }

  return (
    <>
      {picker}
      {open.note ? <p className="section-note muted">Opening note: {open.note}</p> : null}
      <CashDrawerZLayout
        session={open}
        branchName={branchName}
        canClose={canClose}
        canMove={canMove}
        canAccept={canAccept}
      />
    </>
  )
}
