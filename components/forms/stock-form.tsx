'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/drawer'
import { Field } from '@/components/dashboard/primitives'
import { useInventory, type StockInput } from '@/components/inventory/inventory-provider'
import { formatNumber, formatSigned } from '@/lib/format'
import { ALL_BRANCHES } from '@/lib/inventory/types'

const modes = [
  { value: 'stock_in', label: 'Receive', icon: ArrowDownToLine },
  { value: 'stock_out', label: 'Sell / remove', icon: ArrowUpFromLine },
  { value: 'adjustment', label: 'Count', icon: SlidersHorizontal },
] as const

export function StockForm({
  productId,
  branchId,
  mode = 'stock_in',
  onClose,
}: {
  productId?: string
  branchId?: string
  mode?: StockInput['type']
  onClose: () => void
}) {
  const { state, scope, recordStock } = useInventory()
  const [type, setType] = useState<StockInput['type']>(mode)
  const [product, setProduct] = useState(productId ?? state.products[0]?.id ?? '')
  const [branch, setBranch] = useState(branchId ?? (scope !== ALL_BRANCHES ? scope : state.branches[0]?.id) ?? '')
  const [qty, setQty] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()

  const level = state.stock.find((l) => l.productId === product && l.branchId === branch)
  const onHand = level?.onHand ?? 0
  const available = Math.max(0, onHand - (level?.reserved ?? 0))
  const qtyNum = Number(qty)
  const delta = qty === '' || !Number.isFinite(qtyNum) ? null : type === 'stock_in' ? qtyNum : type === 'stock_out' ? -qtyNum : qtyNum - onHand

  function submit() {
    if (qty.trim() === '' || !Number.isInteger(qtyNum) || qtyNum < 0) {
      setError('Enter a whole number.')
      return
    }
    setError(undefined)
    const result = recordStock({ productId: product, branchId: branch, type, qty: qtyNum, reference, note })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Stock movement recorded')
    onClose()
  }

  if (!state.products.length || !state.branches.length) {
    return (
      <Drawer eyebrow="Inventory action" title="Record stock" onClose={onClose} footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}>
        <p className="muted">Add at least one branch and one product before recording stock.</p>
      </Drawer>
    )
  }

  return (
    <Drawer
      eyebrow="Inventory action"
      title="Record stock"
      description="Every change is logged as a stock movement with your name and a reference."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Record movement
          </button>
        </>
      }
    >
      <div className="segmented" role="radiogroup" aria-label="Movement type">
        {modes.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" role="radio" aria-checked={type === value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <Field label="Product" className="full">
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            {state.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Branch">
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            {state.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={type === 'adjustment' ? 'Counted quantity' : 'Quantity'}
          error={error}
          hint={type === 'stock_out' ? `${formatNumber(available)} available` : `${formatNumber(onHand)} on hand`}
        >
          <input type="number" min={0} step={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} data-autofocus />
        </Field>
        <Field label="Reference" hint="Leave blank to auto-generate" className="full">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={type === 'stock_in' ? 'PO number' : type === 'stock_out' ? 'Sales order' : 'Count sheet'} />
        </Field>
        <Field label="Note" className="full">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'adjustment' ? 'Reason for the adjustment' : 'Optional'} />
        </Field>
      </div>

      {delta !== null && delta !== 0 && (
        <div className="summary-row">
          <span>On hand after</span>
          <strong className="tabular">
            {formatNumber(Math.max(0, onHand + delta))} <span className={delta > 0 ? 'positive' : 'negative'}>({formatSigned(delta)})</span>
          </strong>
        </div>
      )}
    </Drawer>
  )
}
