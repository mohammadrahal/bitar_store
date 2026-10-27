'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import { ReceivePanel } from '@/components/transfers/receive-panel'
import { TransferActions } from '@/components/transfers/transfer-actions'
import { TransferLinesTable } from '@/components/transfers/transfer-lines-table'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { TransferStepper } from '@/components/transfers/transfer-stepper'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useTransfer } from '@/hooks/use-transfers'
import { formatRelativeDateTime } from '@/lib/format'

export function TransferDetailView({ transferId }: { transferId: string }) {
  const { data: transfer, isPending, isError, error, refetch } = useTransfer(transferId)
  const [receiving, setReceiving] = useState(false)

  return (
    <>
      <Link href="/transfers" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Transfers
      </Link>
      {isPending ? (
        <Skeleton rows={4} stats={0} />
      ) : isError ? (
        <ErrorState title="Could not load this transfer" error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <PageHeader
            eyebrow="Transfer"
            title={transfer.number}
            description={`${transfer.fromName} → ${transfer.toName}${transfer.note ? ` · ${transfer.note}` : ''}`}
            actions={<TransferStatusPill status={transfer.status} />}
          />
          <div className="split">
            <div className="stack">
              <Panel title="Progress">
                {transfer.status === 'cancelled' ? (
                  <div className="panel-body">
                    <p className="notice">This transfer was cancelled before anything was dispatched. Nothing moved.</p>
                  </div>
                ) : (
                  <TransferStepper transfer={transfer} />
                )}
              </Panel>
              <Panel title="Lines">
                <TransferLinesTable transfer={transfer} />
                <TransferActions transfer={transfer} onReceive={() => setReceiving(true)} />
              </Panel>
              {receiving && <ReceivePanel transfer={transfer} onDone={() => setReceiving(false)} />}
            </div>
            <aside className="split-aside">
              <Panel title="Invoices" description="Raised when stock leaves the sender.">
                <div className="panel-body">
                  {transfer.linkedInvoices.length === 0 ? (
                    <p className="muted">None yet. They are created on dispatch.</p>
                  ) : (
                    <ul className="chip-row" aria-label="Linked invoices">
                      {transfer.linkedInvoices.map((invoice) => (
                        <li key={invoice.id}>
                          <Link href={`/invoices/${invoice.id}`} className="chip">
                            <FileText size={14} aria-hidden="true" />
                            <span className="tabular">{invoice.number}</span>
                            <span className="chip-count">{invoice.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>
              <Panel title="Activity">
                <ol className="activity" aria-label="Activity, newest first">
                  {transfer.events.map((event) => (
                    <li key={event.id}>
                      <time dateTime={event.at} className="tabular">{formatRelativeDateTime(event.at)}</time>
                      <span>
                        {event.message}
                        <small>{event.actor}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </aside>
          </div>
        </>
      )}
    </>
  )
}
