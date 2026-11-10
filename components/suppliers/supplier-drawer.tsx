'use client'

import { useState } from 'react'
import { Drawer } from '@/components/shared/drawer'
import { SupplierForm, supplierFormProblem, supplierFromRow } from '@/components/suppliers/supplier-form'
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/use-suppliers'
import type { ApiSupplier } from '@/lib/api/types'

export function SupplierDrawer({
  supplier,
  onClose,
}: {
  supplier?: ApiSupplier
  onClose: () => void
}) {
  const isEdit = Boolean(supplier)
  const seed = supplier ? supplierFromRow(supplier) : { name: '', phone: '', note: '' }
  const [name, setName] = useState(seed.name)
  const [phone, setPhone] = useState(seed.phone)
  const [note, setNote] = useState(seed.note)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const pending = create.isPending || update.isPending

  const save = () => {
    const problem = supplierFormProblem(name, phone)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
  }

  const handleCreate = () => {
    save()
    const problem = supplierFormProblem(name, phone)
    if (problem) return
    create.mutate(
      { name, phone, ...(note.trim() ? { note } : {}) },
      { onSuccess: () => onClose() },
    )
  }

  const handleUpdate = () => {
    save()
    const problem = supplierFormProblem(name, phone)
    if (problem || !supplier) return
    update.mutate(
      {
        id: supplier.id,
        input: {
          name: name.trim(),
          phone: phone.trim(),
          ...(note.trim() ? { note: note.trim() } : { note: '' }),
        },
      },
      { onSuccess: () => onClose() },
    )
  }

  const submit = isEdit ? handleUpdate : handleCreate

  return (
    <Drawer
      eyebrow="Warehouse"
      title={isEdit ? supplier!.name : 'New supplier'}
      description={
        isEdit
          ? 'Changing the name here does not rewrite old delivery documents; those keep the name from that day.'
          : 'Every goods receipt picks from this list, so deliveries from the same company stay under one name.'
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add supplier'}
          </button>
        </>
      }
    >
      <SupplierForm
        name={name}
        phone={phone}
        note={note}
        onName={setName}
        onPhone={setPhone}
        onNote={setNote}
        error={error}
        disabled={pending}
      />
    </Drawer>
  )
}
