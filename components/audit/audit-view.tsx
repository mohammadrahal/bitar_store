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
import { formatAuditAction, formatAuditEntityType, formatRelativeDateTime } from '@/lib/format'

const PAGE_SIZE = 50

function AuditEntityCell({ entityType, entityId }: { entityType: string; entityId: string | null }) {
  const label = formatAuditEntityType(entityType)
  const tip = entityId?.trim()
    ? `Entity ID: ${entityId.trim()}`
    : undefined
  return (
    <td className={tip ? 'audit-entity-cell audit-entity-cell--has-tip' : 'audit-entity-cell'} title={tip}>
      {label}
    </td>
  )
}

function AuditByCell({ by }: { by: { id: string; name: string | null } }) {
  const display = by.name?.trim() || (by.id.length > 8 ? `${by.id.slice(0, 8)}…` : by.id)
  const tip = `User ID: ${by.id}`
  return (
    <td className="audit-by-cell audit-by-cell--has-tip" title={tip}>
      {display}
    </td>
  )
}

export function AuditView({ embedded = false }: { embedded?: boolean } = {}) {
  const [page, setPage] = useState(1)
  const offset = (page - 1) * PAGE_SIZE
  const query = useAuditEvents(offset)
  const rows = query.data ?? []
  const hasMore = rows.length >= PAGE_SIZE

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Administration"
          title="Audit log"
          description="Who changed minimums, branches and other settings. Admin only on the server."
        />
      ) : null}

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
              <table className="card-table card-table--audit-log">
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
                      <td>{formatAuditAction(event.action)}</td>
                      <AuditEntityCell entityType={event.entityType} entityId={event.entityId} />
                      <AuditByCell by={event.by} />
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
