'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeftRight, Truck, type LucideIcon } from 'lucide-react'
import { useBranchesKey } from '@/hooks/use-stock'
import { useStockHealth } from '@/hooks/use-stock-health'
import { usePermission } from '@/hooks/use-permission'
import {
  isScopedBranch,
  OVERDUE_DAYS,
  getOverdueTransfers,
  getTransferAttention,
} from '@/services/attention.service'
import { inventoryHref } from '@/lib/inventory-filters'
import { formatNumber } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { useBranches } from '@/hooks/use-branches'
import { ALL_BRANCHES, type BranchScope } from '@/types'

export interface AttentionRow {
  key: string
  /** The figure the row leads with. Rows at zero are dropped before display. */
  count: number
  label: string
  /** A quieter second clause, such as how many of them are overdue. */
  detail?: string
  href: string
  /** The button's words, which name the destination rather than saying "View". */
  action: string
  icon: LucideIcon
  /** `warning` for things going wrong, `info` for things merely in flight. */
  tone: 'warning' | 'info'
}

function plural(count: number, singular: string, many = `${singular}s`) {
  return count === 1 ? singular : many
}

/**
 * The transfer half of the list; its own query so a `403` cannot hide low
 * stock. Exported because the sidebar badges count the same two figures and
 * must not fetch them a second time.
 */
export function useTransferAttention(scope: BranchScope) {
  const { canSeeTransfers } = usePermission()
  const branches = useBranchesKey()
  const scopeReady = scope === ALL_BRANCHES || isScopedBranch(scope)
  return useQuery({
    queryKey: [...queryKeys.transfers.all, 'attention', scope],
    queryFn: () => getTransferAttention(scope),
    enabled: branches !== null && canSeeTransfers() && scopeReady,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const active =
        data.onTheRoad + data.awaitingApproval + data.incomingOnRoad
      return active > 0 ? 20_000 : false
    },
  })
}

/**
 * The "sent over N days ago" clause, which is the only figure here that needs
 * the transfer documents rather than a count header. Off unless a caller is
 * about to show it, so the nav rail does not page the shipment list on every
 * screen to render a badge that never mentions it.
 */
export function useOverdueTransfers(scope: BranchScope, { enabled = false } = {}) {
  const { canSeeTransfers } = usePermission()
  const branches = useBranchesKey()
  return useQuery({
    queryKey: [...queryKeys.transfers.all, 'overdue', scope],
    queryFn: () => getOverdueTransfers(scope),
    enabled: enabled && branches !== null && canSeeTransfers() && (scope === ALL_BRANCHES || isScopedBranch(scope)),
    staleTime: 60_000,
  })
}

/**
 * Everything waiting for someone, as rows ready to render.
 *
 * Each row is filtered three ways before it appears: the viewer must hold the
 * permission to act on it, the figure must be above zero, and the data must
 * exist on this API at all. An employee's rows are already narrowed to their
 * active location, because `scope` resolves to it for a location-scoped user.
 *
 * Three rows the brief asked for are absent because the backend has no route
 * for them — supplier receipts, discount and refund requests, and social media
 * orders past a pickup time. They are listed in `ARCHITECTURE.md` section 9.
 */
export function useAttention(scope: BranchScope, { detail = false } = {}) {
  const { can, canSeeTransfers, canDispatchTransfers, canReceiveTransfers } = usePermission()
  const { data: branches } = useBranches()
  const transfers = useTransferAttention(scope)
  /* `detail` is what the caller is about to render. The overview's list always
     shows it; the bell asks only once its popup is open. */
  const overdueQuery = useOverdueTransfers(scope, { enabled: detail })
  const health = useStockHealth(scope)

  const rows: AttentionRow[] = []

  if (canDispatchTransfers() && transfers.data && transfers.data.awaitingApproval > 0) {
    const count = transfers.data.awaitingApproval
    rows.push({
      key: 'transfer_approvals',
      count,
      label: `${plural(count, 'transfer')} waiting to be sent`,
      detail: 'Prepared or requested, nothing has moved yet',
      href: '/transfers?status=draft',
      action: 'Review drafts',
      icon: ArrowLeftRight,
      tone: 'warning',
    })
  }

  const scopedBranch = isScopedBranch(scope) ? scope : null
  const branchLabel = scopedBranch ? branches?.find((b) => b.id === scopedBranch)?.name : null
  const incomingOnRoad = transfers.data?.incomingOnRoad ?? 0

  if (canReceiveTransfers() && scopedBranch && incomingOnRoad > 0) {
    const overdue = overdueQuery.data ?? 0
    rows.push({
      key: 'incoming',
      count: incomingOnRoad,
      label: branchLabel
        ? `${plural(incomingOnRoad, 'shipment')} on the way to ${branchLabel}`
        : `${plural(incomingOnRoad, 'shipment')} on the way here`,
      detail:
        overdue > 0
          ? `${formatNumber(overdue)} sent over ${OVERDUE_DAYS} days ago`
          : undefined,
      href: '/transfers?status=dispatched',
      action: 'Receive stock',
      icon: Truck,
      tone: overdue > 0 ? 'warning' : 'info',
    })
  } else if (canSeeTransfers() && transfers.data && transfers.data.onTheRoad > 0) {
    const { onTheRoad } = transfers.data
    const overdue = overdueQuery.data ?? 0
    rows.push({
      key: 'in_transit',
      count: onTheRoad,
      label: `${plural(onTheRoad, 'shipment')} on the road`,
      detail:
        overdue > 0
          ? `${formatNumber(overdue)} sent over ${OVERDUE_DAYS} days ago`
          : undefined,
      href: '/transfers?status=dispatched',
      action: 'Track shipments',
      icon: Truck,
      tone: overdue > 0 ? 'warning' : 'info',
    })
  }

  /* `minimumsKnown` is false when no minimum could be read for the scope, which
     is not the same as nothing being low — so the row stays away rather than
     claiming the shelves are fine. */
  if (can('stock.view') && health.data?.minimumsKnown && health.data.lowStock > 0) {
    const count = health.data.lowStock
    rows.push({
      key: 'low_stock',
      count,
      label: `${plural(count, 'variant')} under its minimum`,
      detail: health.data.lowElsewhere > 0 ? `${formatNumber(health.data.lowElsewhere)} still stocked elsewhere` : undefined,
      href: inventoryHref('low'),
      action: 'See low stock',
      icon: AlertTriangle,
      tone: 'warning',
    })
  }

  /* Pending only while nothing is known yet: one slow query should not hold up
     rows another already answered. */
  const queries = [transfers, health]
  const live = queries.filter((query) => query.fetchStatus !== 'idle' || query.data !== undefined)
  const isPending = rows.length === 0 && live.some((query) => query.isPending)
  const isError = rows.length === 0 && live.length > 0 && live.every((query) => query.isError)

  return {
    rows,
    isPending,
    isError,
    error: transfers.error ?? health.error,
    /** The bell's badge: everything needing attention, as one figure. */
    total: rows.reduce((sum, row) => sum + row.count, 0),
    refetch: () => {
      void transfers.refetch()
      if (overdueQuery.fetchStatus !== 'idle' || overdueQuery.data !== undefined) void overdueQuery.refetch()
      void health.refetch()
    },
  }
}
