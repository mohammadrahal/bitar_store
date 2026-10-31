'use client'

import { useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { ReplenishmentReviewForm } from '@/components/replenishment/review-form'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { MotionSwap } from '@/components/motion/motion-swap'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import {
  useCancelReplenishmentRequest,
  useCompleteReplenishmentRequest,
  useReplenishmentRequests,
} from '@/hooks/use-replenishment-requests'
import { usePermission } from '@/hooks/use-permission'
import { formatRelativeDateTime } from '@/lib/format'
import type { BranchScope, ReplenishmentRequestRow, ReplenishmentStatus } from '@/types'

const STATUS_LABELS: Record<ReplenishmentStatus, string> = {
  requested: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_TONES: Record<ReplenishmentStatus, string> = {
  requested: 'pill-transit',
  approved: 'pill-healthy',
  rejected: 'pill-out',
  completed: 'pill-neutral',
  cancelled: 'pill-neutral',
}

/** Requests a branch has raised, and the decisions taken on them. */
export function ReplenishmentRequestsPanel({ scope }: { scope: BranchScope }) {
  const { can } = usePermission()
  const { data: rows, isPending, isError, error, refetch } = useReplenishmentRequests({ scope })
  const complete = useCompleteReplenishmentRequest()
  const cancel = useCancelReplenishmentRequest()
  const [reviewing, setReviewing] = useState<ReplenishmentRequestRow | null>(null)
  const mayReview = can('replenishment.review')

  return (
    <>
      <Panel
        title="Requests"
        description={isPending ? 'Loading…' : `${rows?.length ?? 0} in total, newest first`}
      >
        <MotionSwap state={isPending ? 'loading' : isError ? 'error' : 'ready'}>
          {isPending ? (
            <div className="panel-body">
              <Skeleton rows={3} stats={0} />
            </div>
          ) : isError ? (
            <div className="panel-body">
              <ErrorState title="Could not load requests" error={error} onRetry={() => void refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={PackagePlus}
                title="No requests yet"
                description="A location asks for stock here, and a super admin or manager decides what to send."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Replenishment requests</caption>
                <thead>
                  <tr>
                    <th scope="col">Request</th>
                    <th scope="col">Location</th>
                    <th scope="col" className="num">
                      Asked
                    </th>
                    <th scope="col" className="num">
                      Approved
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <MotionTbody dataset={scope}>
                  {rows.map((row, index) => (
                    <MotionTr key={row.id} index={index}>
                      <td className="card-title" data-label="Request">
                        {row.number}
                        <small>
                          {row.requestedBy} · {formatRelativeDateTime(row.requestedAt)}
                        </small>
                      </td>
                      <td data-label="Location">{row.branchName}</td>
                      <td className="num tabular" data-label="Asked">
                        {row.requestedUnits}
                      </td>
                      <td className="num tabular" data-label="Approved">
                        {row.status === 'requested' ? '—' : row.approvedUnits}
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${STATUS_TONES[row.status]}`}>
                          <span className="pill-dot" aria-hidden="true" />
                          {STATUS_LABELS[row.status]}
                        </span>
                        {row.decisionReason && <small className="muted"> {row.decisionReason}</small>}
                      </td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          {row.status === 'requested' && mayReview && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewing(row)}>
                              Review
                            </button>
                          )}
                          {row.status === 'approved' && mayReview && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={complete.isPending}
                              onClick={() => complete.mutate(row.id)}
                            >
                              Mark completed
                            </button>
                          )}
                          {(row.status === 'requested' || row.status === 'approved') && (
                            <button
                              type="button"
                              className="text-btn"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(row.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
          )}
        </MotionSwap>
      </Panel>

      {reviewing && <ReplenishmentReviewForm request={reviewing} onClose={() => setReviewing(null)} />}
    </>
  )
}
