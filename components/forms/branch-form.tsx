'use client'

import { useState } from 'react'
import { Store, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/drawer'
import { Field } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import type { BranchType } from '@/lib/inventory/types'

export function BranchForm({ branchId, onClose }: { branchId?: string; onClose: () => void }) {
  const { state, saveBranch } = useInventory()
  const existing = state.branches.find((b) => b.id === branchId)

  const [name, setName] = useState(existing?.name ?? '')
  const [code, setCode] = useState(existing?.code ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [type, setType] = useState<BranchType>(existing?.type ?? 'store')
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({})

  function submit() {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Enter a branch name.'
    if (!code.trim()) next.code = 'Enter a short code, e.g. DWT-01.'
    setErrors(next)
    if (next.name || next.code) return

    const result = saveBranch({ id: existing?.id, name, code, address, type })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(existing ? `Saved “${name.trim()}”` : `Branch “${name.trim()}” added`)
    onClose()
  }

  return (
    <Drawer
      eyebrow="Branch setup"
      title={existing ? 'Edit branch' : 'Add branch'}
      description="Stores sell to customers. Warehouses hold reserve stock and feed stores through transfers."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save changes' : 'Add branch'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Branch name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Downtown Store" data-autofocus autoComplete="off" />
        </Field>
        <Field label="Branch code" error={errors.code}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. DWT-01" autoComplete="off" />
        </Field>
        <Field label="Address" className="full">
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" autoComplete="street-address" />
        </Field>
        <fieldset className="field full">
          <legend>Type</legend>
          <div className="segmented" role="radiogroup" aria-label="Branch type">
            {(['store', 'warehouse'] as const).map((t) => {
              const Icon = t === 'store' ? Store : Warehouse
              return (
                <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                  <Icon size={15} /> {t === 'store' ? 'Store' : 'Warehouse'}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
    </Drawer>
  )
}
