'use client'

import { useState } from 'react'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/use-receiving'
import type { Supplier } from '@/types'

/** Name and phone, both required (BL-06). Suppliers are archived, never deleted. */
export function SupplierForm({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')

  const pending = create.isPending || update.isPending
  const submit = () => {
    if (supplier) {
      update.mutate({ id: supplier.id, name, phone }, { onSuccess: onClose })
      return
    }
    create.mutate({ name, phone }, { onSuccess: onClose })
  }

  return (
    <Drawer
      eyebrow="Suppliers"
      title={supplier ? 'Edit supplier' : 'New supplier'}
      description="Receipts point at the supplier they came from, so the name stays in history."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" className="full">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            placeholder="Beirut Textiles"
          />
        </Field>
        <Field label="Phone" className="full">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="off"
            inputMode="tel"
            placeholder="+961 1 234 567"
          />
        </Field>
      </div>
    </Drawer>
  )
}
