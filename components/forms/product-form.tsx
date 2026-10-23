'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/drawer'
import { Field, StatusPill } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { formatNumber } from '@/lib/format'
import { nextSku } from '@/lib/inventory/ids'
import { levelStatus, selectCategories } from '@/lib/inventory/selectors'

type Errors = Partial<Record<'name' | 'sku' | 'price' | 'reorderPoint' | 'openingQty', string>>

export function ProductForm({ productId, onClose }: { productId?: string; onClose: () => void }) {
  const { state, scope, saveProduct, branchName } = useInventory()
  const existing = state.products.find((p) => p.id === productId)
  const categories = selectCategories(state.products)
  const defaultBranch = state.branches.find((b) => b.id === scope)?.id ?? state.branches[0]?.id ?? ''

  const [name, setName] = useState(existing?.name ?? '')
  const [sku, setSku] = useState(existing?.sku ?? nextSku(state.products))
  const [category, setCategory] = useState(existing?.category ?? categories[0] ?? 'Apparel')
  const [price, setPrice] = useState(String(existing?.price ?? ''))
  const [reorderPoint, setReorderPoint] = useState(String(existing?.reorderPoint ?? 20))
  const [openingBranch, setOpeningBranch] = useState(defaultBranch)
  const [openingQty, setOpeningQty] = useState('0')
  const [errors, setErrors] = useState<Errors>({})

  const levels = existing ? state.stock.filter((s) => s.productId === existing.id) : []

  function submit() {
    const next: Errors = {}
    if (!name.trim()) next.name = 'Enter a product name.'
    if (!sku.trim()) next.sku = 'Enter a SKU.'
    const priceNum = Number(price)
    if (price.trim() === '' || !Number.isFinite(priceNum) || priceNum < 0) next.price = 'Enter a price of 0 or more.'
    const reorderNum = Number(reorderPoint)
    if (!Number.isInteger(reorderNum) || reorderNum < 0) next.reorderPoint = 'Enter a whole number.'
    const qtyNum = Number(openingQty)
    if (!existing && (!Number.isInteger(qtyNum) || qtyNum < 0)) next.openingQty = 'Enter a whole number.'
    setErrors(next)
    if (Object.keys(next).length) return

    const result = saveProduct({
      id: existing?.id,
      name,
      sku,
      category,
      price: priceNum,
      reorderPoint: reorderNum,
      initialStock: !existing && openingBranch ? { branchId: openingBranch, qty: qtyNum } : undefined,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(existing ? `Saved “${name.trim()}”` : `Added “${name.trim()}” to the catalog`)
    onClose()
  }

  return (
    <Drawer
      eyebrow="Catalog"
      title={existing ? 'Edit product' : 'Add product'}
      description={existing ? 'Stock levels change through stock movements so every change is audited.' : 'Create a catalog item and optionally record opening stock.'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Product name" error={errors.name} className="full">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Silk Evening Dress" data-autofocus autoComplete="off" />
        </Field>
        <Field label="SKU" error={errors.sku}>
          <input value={sku} onChange={(e) => setSku(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Category">
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="category-options" autoComplete="off" />
        </Field>
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Retail price" error={errors.price}>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Reorder point" error={errors.reorderPoint} hint="Per branch">
          <input type="number" min={0} step={1} inputMode="numeric" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
        </Field>

        {!existing && state.branches.length > 0 && (
          <>
            <Field label="Opening stock branch">
              <select value={openingBranch} onChange={(e) => setOpeningBranch(e.target.value)}>
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Opening quantity" error={errors.openingQty}>
              <input type="number" min={0} step={1} inputMode="numeric" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {existing && (
        <div className="drawer-section">
          <h3 className="section-label">Stock by branch</h3>
          {levels.length ? (
            <ul className="level-list">
              {levels.map((l) => (
                <li key={l.branchId}>
                  <span>{branchName(l.branchId)}</span>
                  <span className="tabular">
                    {formatNumber(l.onHand)} on hand · {formatNumber(l.reserved)} reserved
                  </span>
                  <StatusPill status={levelStatus(l.onHand, existing.reorderPoint)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Not stocked at any branch yet.</p>
          )}
        </div>
      )}
    </Drawer>
  )
}
