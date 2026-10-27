'use client'

import { ClipboardList } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useCountReports, useResolveCountReport } from '@/hooks/use-stock-control'
import { formatRelativeDateTime, formatSigned } from '@/lib/format'

export function CountReportsPanel({ branchId }: { branchId: string }) {
  const { data: reports, isPending, isError, error, refetch } = useCountReports(branchId)
  const resolve = useResolveCountReport()
  const idempotency = useIdempotencyKey()
  const open = reports?.filter((report) => report.status === 'open') ?? []

  const decide = (id: string, apply: boolean) =>
    resolve.mutate({ id, apply, key: idempotency.current() }, { onSuccess: () => idempotency.reset() })

  return (
    <Panel title="Reported differences" description="Counts staff sent for a manager to apply or dismiss.">
      {isPending ? (
        <div className="panel-body"><Skeleton rows={1} stats={0} /></div>
      ) : isError ? (
        <div className="panel-body"><ErrorState title="Could not load reports" error={error} onRetry={() => void refetch()} /></div>
      ) : open.length === 0 ? (
        <div className="panel-body"><EmptyState icon={ClipboardList} title="No open reports" description="Differences reported from the shelf will wait here." /></div>
      ) : (
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Open count reports</caption>
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col" className="num">System</th>
                <th scope="col" className="num">Counted</th>
                <th scope="col">Note</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {open.map((report) => (
                <tr key={report.id}>
                  <td className="card-title">
                    {report.productName} {report.color} / {report.size}
                    <small className="tabular">{report.sku} · {report.branchName}</small>
                  </td>
                  <td className="num tabular" data-label="System">{report.expected}</td>
                  <td className="num tabular" data-label="Counted">
                    {report.counted}
                    <small>{formatSigned(report.counted - report.expected)}</small>
                  </td>
                  <td data-label="Note">
                    {report.note}
                    <small>{report.reportedBy}, {formatRelativeDateTime(report.createdAt)}</small>
                  </td>
                  <td>
                    <Can action="stock:count" branchId={report.branchId}>
                      <div className="row-actions">
                        <button type="button" className="btn btn-primary btn-sm" disabled={resolve.isPending} onClick={() => decide(report.id, true)}>
                          Apply
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={resolve.isPending} onClick={() => decide(report.id, false)}>
                          Dismiss
                        </button>
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
