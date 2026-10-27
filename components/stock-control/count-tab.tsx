'use client'

import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { CountReportsPanel } from '@/components/stock-control/count-reports-panel'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import { useApplyCount, useCountSheet, useReportCount } from '@/hooks/use-stock-control'
import { formatSigned } from '@/lib/format'
import type { CountSheetRow } from '@/types'

/**
 * Managers apply a count straight away as adjustments. Employees report a
 * difference instead, and a manager applies or dismisses it.
 */
export function CountTab({ branchId }: { branchId: string }) {
  const { can, canAccessBranch } = usePermission()
  const applies = can('stock:count') && canAccessBranch(branchId)
  const { data: rows, isPending, isError, error, refetch } = useCountSheet(branchId)
  const apply = useApplyCount()
  const report = useReportCount()
  const idempotency = useIdempotencyKey()
  const [counted, setCounted] = useState<Record<string, number>>({})
  const [confirming, setConfirming] = useState<CountSheetRow[] | null>(null)

  const changed = (rows ?? []).filter((row) => counted[row.variantId] !== undefined && counted[row.variantId] !== row.onHand)
  const reset = () => {
    idempotency.reset()
    setConfirming(null)
    setCounted({})
  }

  return (
    <>
      <Panel
        title="Physical count"
        description={applies ? 'Enter what is on the shelf. Differences are applied as adjustments with your note.' : 'Enter what is on the shelf. Differences go to a manager to approve.'}
        actions={
          changed.length > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirming(changed)}>
              {applies ? `Apply ${changed.length}` : `Report ${changed.length}`} {changed.length === 1 ? 'difference' : 'differences'}
            </button>
          )
        }
      >
        {isPending ? (
          <div className="panel-body"><Skeleton rows={3} stats={0} /></div>
        ) : isError ? (
          <div className="panel-body"><ErrorState title="Could not load the count sheet" error={error} onRetry={() => void refetch()} /></div>
        ) : rows.length === 0 ? (
          <div className="panel-body"><EmptyState icon={ClipboardCheck} title="Nothing to count" description="There are no active variants at this location." /></div>
        ) : (
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Count sheet</caption>
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col" className="num">System</th>
                  <th scope="col" className="num">Counted</th>
                  <th scope="col" className="num">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const value = counted[row.variantId]
                  const diff = value === undefined ? 0 : value - row.onHand
                  return (
                    <tr key={row.variantId} className={diff !== 0 ? 'selected' : ''}>
                      <td className="card-title">
                        {row.productName} {row.color} / {row.size}
                        <small className="tabular">{row.sku}</small>
                      </td>
                      <td className="num tabular" data-label="System">{row.onHand}</td>
                      <td className="num" data-label="Counted">
                        <input
                          className="qty-input tabular"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={value ?? ''}
                          placeholder={String(row.onHand)}
                          aria-label={`Counted for ${row.productName} ${row.color} / ${row.size}`}
                          onChange={(event) => {
                            const raw = event.target.value
                            setCounted((current) => {
                              const next = { ...current }
                              if (raw === '') delete next[row.variantId]
                              else next[row.variantId] = Math.max(0, Math.floor(Number(raw)) || 0)
                              return next
                            })
                          }}
                        />
                      </td>
                      <td className="num tabular" data-label="Difference">{diff === 0 ? '—' : formatSigned(diff)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CountReportsPanel branchId={branchId} />

      {confirming && (
        <ReasonDialog
          title={applies ? 'Apply count' : 'Report differences'}
          description={
            applies
              ? `${confirming.length} ${confirming.length === 1 ? 'variant changes' : 'variants change'} on hand. Removing units is a write-off and needs a reason.`
              : 'A manager will see each difference with your note and decide whether to apply it.'
          }
          confirmLabel={applies ? 'Apply count' : 'Send report'}
          reasonLabel="Note"
          tone={applies ? 'danger' : 'default'}
          pending={apply.isPending || report.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={async (note) => {
            if (applies) {
              apply.mutate(
                { input: { branchId, note, counts: confirming.map((row) => ({ variantId: row.variantId, counted: counted[row.variantId] ?? row.onHand })) }, key: idempotency.current() },
                { onSuccess: reset },
              )
              return
            }
            try {
              for (const row of confirming) {
                await report.mutateAsync({ input: { branchId, variantId: row.variantId, counted: counted[row.variantId] ?? row.onHand, note }, key: `${idempotency.current()}:${row.variantId}` })
              }
              reset()
            } catch {
              // The failed row was toasted; rows already sent replay safely on retry with the same keys.
            }
          }}
        />
      )}
    </>
  )
}
