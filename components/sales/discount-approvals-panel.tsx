'use client'

import { BadgePercent } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { Panel } from '@/components/shared/panel'
import { PreviewBadge } from '@/components/shared/preview-badge'
import { Skeleton } from '@/components/shared/skeleton'
import { useDecideDiscountRequest, useDiscountRequests } from '@/hooks/use-discount-requests'
import { usePermission } from '@/hooks/use-permission'
import { formatRelativeDateTime } from '@/lib/format'
import type { BranchScope } from '@/types'

/**
 * Discounts the till has asked for. Only a super admin or manager decides
 * (BL-04); until one does, the sale that asked cannot be completed.
 */
export function DiscountApprovalsPanel({ scope }: { scope: BranchScope }) {
  const { can } = usePermission()
  const { data: requests, isPending } = useDiscountRequests(scope)
  const decide = useDecideDiscountRequest()

  if (!can('discounts.approve')) return null

  const pending = requests?.filter((request) => request.status === 'pending') ?? []
  if (!isPending && pending.length === 0) return null

  return (
    <Panel title="Discount approvals" description={`${pending.length} waiting`}>
      <PreviewBadge feature="Discount requests" className="panel-body" />
      {isPending ? (
        <div className="panel-body">
          <Skeleton rows={2} stats={0} />
        </div>
      ) : pending.length === 0 ? (
        <div className="panel-body">
          <EmptyState icon={BadgePercent} title="Nothing waiting" description="Requests from the till appear here." />
        </div>
      ) : (
        <ul className="picker-list">
          {pending.map((request) => (
            <li key={request.id} className="picker-row">
              <span>
                <strong>
                  {request.percent}% off — {request.reason}
                </strong>
                <small>
                  {request.requestedBy} · {formatRelativeDateTime(request.requestedAt)}
                </small>
              </span>
              <span className="row-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ requestId: request.id, approved: true })}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="text-btn"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ requestId: request.id, approved: false })}
                >
                  Reject
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
