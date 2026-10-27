'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Archive, Lock } from 'lucide-react'
import { VariantQuantityDialog } from '@/components/stock-control/variant-quantity-dialog'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useDispose, useHolds, usePlaceHold, useReleaseHold } from '@/hooks/use-stock-control'
import { formatRelativeDateTime } from '@/lib/format'
import type { HoldRow } from '@/types'

export function HoldsTab({ branchId }: { branchId: string }) {
  const { data: holds, isPending, isError, error, refetch } = useHolds(branchId)
  const idempotency = useIdempotencyKey()
  const place = usePlaceHold()
  const release = useReleaseHold()
  const dispose = useDispose()
  const [placing, setPlacing] = useState(false)
  const [disposing, setDisposing] = useState<HoldRow | null>(null)
  const done = () => {
    idempotency.reset()
    setPlacing(false)
    setDisposing(null)
  }

  return (
    <Panel
      title="On hold"
      description="Units here are counted on hand but cannot be sold or sent."
      actions={
        <Can action="stock:hold" branchId={branchId}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlacing(true)}>
            <Lock size={14} aria-hidden="true" />
            Put on hold
          </button>
        </Can>
      }
    >
      {isPending ? (
        <div className="panel-body"><Skeleton rows={2} stats={0} /></div>
      ) : isError ? (
        <div className="panel-body"><ErrorState title="Could not load holds" error={error} onRetry={() => void refetch()} /></div>
      ) : holds.length === 0 ? (
        <div className="panel-body">
          <EmptyState icon={Archive} title="Nothing on hold" description="Damaged arrivals and units set aside by hand show up here." />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Units on hold</caption>
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col" className="num">Units</th>
                <th scope="col">Reason</th>
                <th scope="col">Since</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {holds.map((hold) => (
                <tr key={hold.id}>
                  <td className="card-title">
                    <Link href={`/inventory/${hold.variantId}`} className="link-cell">
                      {hold.productName} {hold.color} / {hold.size}
                    </Link>
                    <small className="tabular">{hold.sku} · {hold.branchName}</small>
                  </td>
                  <td className="num tabular" data-label="Units">{hold.quantity}</td>
                  <td data-label="Reason">
                    {hold.reason}
                    <small>{hold.source === 'receipt' ? 'Arrived damaged on a transfer' : `Placed by ${hold.createdBy}`}</small>
                  </td>
                  <td className="tabular" data-label="Since">{formatRelativeDateTime(hold.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Can action="stock:hold" branchId={hold.branchId}>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={release.isPending} onClick={() => release.mutate({ id: hold.id, key: idempotency.current() }, { onSuccess: done })}>
                          Release
                        </button>
                      </Can>
                      <Can action="stock:dispose" branchId={hold.branchId}>
                        <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setDisposing(hold)}>
                          Dispose
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {placing && (
        <VariantQuantityDialog
          branchId={branchId}
          title="Put units on hold"
          description="Held units stay on hand but leave available stock until released or disposed of."
          confirmLabel="Put on hold"
          tone="default"
          pending={place.isPending}
          onCancel={() => setPlacing(false)}
          onConfirm={(input) => place.mutate({ input: { ...input, branchId }, key: idempotency.current() }, { onSuccess: done })}
        />
      )}
      {disposing && (
        <ReasonDialog
          title={`Dispose of ${disposing.quantity} × ${disposing.sku}?`}
          description="The units are written off with an adjustment document. This cannot be undone."
          confirmLabel="Dispose"
          pending={dispose.isPending}
          onCancel={() => setDisposing(null)}
          onConfirm={(reason) =>
            dispose.mutate(
              { input: { variantId: disposing.variantId, branchId: disposing.branchId, quantity: disposing.quantity, reason, holdId: disposing.id }, key: idempotency.current() },
              { onSuccess: done },
            )
          }
        />
      )}
    </Panel>
  )
}
