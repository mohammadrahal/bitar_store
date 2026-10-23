'use client'

import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Check, SlidersHorizontal, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardUI } from '@/components/dashboard/dashboard-ui-provider'
import { TransferPill } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { formatRelativeDateTime, formatSigned } from '@/lib/format'
import { movementDelta } from '@/lib/inventory/selectors'
import type { Movement, MovementType } from '@/lib/inventory/types'

export const movementMeta: Record<MovementType, { label: string; icon: typeof ArrowDownToLine }> = {
  stock_in: { label: 'Stock in', icon: ArrowDownToLine },
  stock_out: { label: 'Stock out', icon: ArrowUpFromLine },
  transfer: { label: 'Transfer', icon: ArrowLeftRight },
  adjustment: { label: 'Adjustment', icon: SlidersHorizontal },
}

export function MovementsTable({ rows, showActions = true }: { rows: Movement[]; showActions?: boolean }) {
  const { scope, branchName, completeTransfer } = useInventory()
  const { confirm } = useDashboardUI()

  async function complete(m: Movement, status: 'received' | 'cancelled') {
    if (status === 'cancelled') {
      const ok = await confirm({
        title: `Cancel transfer ${m.reference}?`,
        description: `${m.qty} × ${m.productName} will be returned to ${branchName(m.branchId)}.`,
        confirmLabel: 'Cancel transfer',
        tone: 'danger',
      })
      if (!ok) return
    }
    const result = completeTransfer(m.id, status)
    if (result.ok) toast.success(status === 'received' ? `Received at ${branchName(m.toBranchId)}` : 'Transfer cancelled, stock returned')
    else toast.error(result.error)
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Product</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col">Branch</th>
            <th scope="col">Reference</th>
            <th scope="col">Time</th>
            {showActions && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const { label, icon: Icon } = movementMeta[m.type]
            const delta = movementDelta(m, scope)
            return (
              <tr key={m.id}>
                <td>
                  <span className="movement-type">
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </span>
                  {m.status && <TransferPill status={m.status} />}
                </td>
                <td>
                  <strong>{m.productName}</strong>
                  <small>
                    {m.sku} · {m.user}
                  </small>
                </td>
                <td className={`num tabular qty ${delta > 0 ? 'positive' : 'negative'}`}>{formatSigned(delta)}</td>
                <td>
                  {m.type === 'transfer' ? (
                    <>
                      <strong>{branchName(m.branchId)}</strong>
                      <small>→ {branchName(m.toBranchId)}</small>
                    </>
                  ) : (
                    branchName(m.branchId)
                  )}
                </td>
                <td>
                  <span className="reference">{m.reference}</span>
                  {m.note && <small title={m.note}>{m.note}</small>}
                </td>
                <td className="muted">{formatRelativeDateTime(m.createdAt)}</td>
                {showActions && (
                  <td>
                    {m.status === 'in_transit' && (
                      <div className="row-actions">
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => complete(m, 'received')}>
                          <Check size={14} /> Receive
                        </button>
                        <button type="button" className="icon-btn danger" aria-label={`Cancel transfer ${m.reference}`} title="Cancel transfer" onClick={() => complete(m, 'cancelled')}>
                          <Undo2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
