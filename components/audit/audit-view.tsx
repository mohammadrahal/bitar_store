'use client'

import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Pagination } from '@/components/shared/pagination'
import { Skeleton } from '@/components/shared/skeleton'
import { useAuditEvents } from '@/hooks/use-reports-api'
import { formatRelativeDateTime } from '@/lib/format'

const PAGE_SIZE = 50

export function AuditView() {
  const [page, setPage] = useState(1)
  const offset = (page - 1) * PAGE_SIZE
  const query = useAuditEvents(offset)
  const rows = query.data ?? []
  const hasMore = rows.length >= PAGE_SIZE

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Who changed minimums, branches and other settings. Admin only on the server."
      />

      <Panel title="Recent events">
        {query.isPending ? (
          <div className="panel-body">
            <Skeleton rows={6} stats={0} />
          </div>
        ) : query.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load audit events" error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState icon={ScrollText} title="No audit events yet" description="Changes will appear here as they happen." />
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Audit log</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">By</th>
                  </tr>
                </thead>
                <MotionTbody dataset={String(page)}>
                  {rows.map((event, index) => (
                    <MotionTr key={event.id} index={index}>
                      <td>{formatRelativeDateTime(event.occurredAt)}</td>
                      <td>{event.action}</td>
                      <td>
                        {event.entityType}
                        {event.entityId ? ` · ${event.entityId.slice(0, 8)}…` : ''}
                      </td>
                      <td>{event.by.name ?? event.by.id.slice(0, 8)}</td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
            {(page > 1 || hasMore) && (
              <Pagination
                page={page}
                pageCount={hasMore ? page + 1 : page}
                total={offset + rows.length + (hasMore ? 1 : 0)}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            )}
          </>
        )}
      </Panel>
    </>
  )
}
