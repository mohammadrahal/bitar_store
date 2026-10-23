'use client'

import { useState } from 'react'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/drawer'
import { Field } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { formatNumber } from '@/lib/format'

interface Line {
  key: number
  productId: string
  qty: string
}

export function TransferForm({ productId, fromBranchId, onClose }: { productId?: string; fromBranchId?: string; onClose: () => void }) {
  const { state, createTransfer, branchName } = useInventory()
  const warehouse = state.branches.find((b) => b.type === 'warehouse')
  const initialFrom = fromBranchId ?? warehouse?.id ?? state.branches[0]?.id ?? ''
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(state.branches.find((b) => b.id !== initialFrom)?.id ?? '')
  const [lines, setLines] = useState<Line[]>([{ key: 0, productId: productId ?? '', qty: '' }])
  const [note, setNote] = useState('')

  const available = (pid: string) => {
    const level = state.stock.find((l) => l.productId === pid && l.branchId === from)
    return Math.max(0, (level?.onHand ?? 0) - (level?.reserved ?? 0))
  }
  const sourceProducts = state.products.filter((p) => available(p.id) > 0)
  const totalUnits = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0)

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function submit() {
    const result = createTransfer({
      fromBranchId: from,
      toBranchId: to,
      lines: lines.map((l) => ({ productId: l.productId, qty: Number(l.qty) })),
      note,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Transfer to ${branchName(to)} is in transit`, { description: 'Mark it received on the Stock movements page when it arrives.' })
    onClose()
  }

  if (state.branches.length < 2) {
    return (
      <Drawer eyebrow="Inventory action" title="Transfer stock" onClose={onClose} footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}>
        <p className="muted">You need at least two branches to transfer stock.</p>
      </Drawer>
    )
  }

  return (
    <Drawer
      eyebrow="Inventory action"
      title="Transfer stock"
      description="Stock leaves the source immediately and arrives at the destination when the transfer is marked received."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={totalUnits <= 0}>
            Create transfer
          </button>
        </>
      }
    >
      <div className="transfer-route">
        <Field label="From">
          <select
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setLines([{ key: Date.now(), productId: '', qty: '' }])
              if (e.target.value === to) setTo(state.branches.find((b) => b.id !== e.target.value)?.id ?? '')
            }}
          >
            {state.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <ArrowRight size={18} className="route-arrow" aria-hidden="true" />
        <Field label="To">
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {state.branches
              .filter((b) => b.id !== from)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <div className="drawer-section">
        <h3 className="section-label">Products</h3>
        {sourceProducts.length === 0 ? (
          <p className="muted">{branchName(from)} has no available stock to transfer.</p>
        ) : (
          <ul className="transfer-lines">
            {lines.map((line, index) => {
              const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.productId))
              return (
                <li key={line.key}>
                  <Field label={`Product ${index + 1}`} hint={line.productId ? `${formatNumber(available(line.productId))} available` : undefined}>
                    <select value={line.productId} onChange={(e) => updateLine(line.key, { productId: e.target.value })}>
                      <option value="">Select a product…</option>
                      {sourceProducts
                        .filter((p) => !taken.has(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.sku}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Qty">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      max={line.productId ? available(line.productId) : undefined}
                      inputMode="numeric"
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                    />
                  </Field>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove product ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {sourceProducts.length > lines.length && (
          <button type="button" className="text-btn" onClick={() => setLines((prev) => [...prev, { key: Date.now(), productId: '', qty: '' }])}>
            <Plus size={15} /> Add another product
          </button>
        )}
      </div>

      <Field label="Note" className="notes-field">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the receiving branch" />
      </Field>

      <div className="summary-row">
        <span>Total units</span>
        <strong className="tabular">{formatNumber(totalUnits)}</strong>
      </div>
    </Drawer>
  )
}
