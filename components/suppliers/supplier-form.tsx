'use client'

import { Field } from '@/components/shared/field'
import { PhoneInput } from '@/components/shared/phone-input'
import { validateSupplier } from '@/services/suppliers.service'
import type { ApiSupplier } from '@/lib/api/types'

export function SupplierForm({
  name,
  phone,
  note,
  onName,
  onPhone,
  onNote,
  error,
  disabled,
}: {
  name: string
  phone: string
  note: string
  onName: (value: string) => void
  onPhone: (value: string) => void
  onNote: (value: string) => void
  error: string | null
  disabled?: boolean
}) {
  return (
    <div className="form-grid suppliers-form-grid">
      <Field label="Supplier name" error={error && !name.trim() ? error : undefined} className="full">
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          autoComplete="organization"
          placeholder="Al Amin Textiles"
          disabled={disabled}
        />
      </Field>
      <Field label="Phone" hint="Who to call about deliveries." className="full">
        <PhoneInput value={phone} onChange={onPhone} disabled={disabled} />
      </Field>
      <Field label="Note (optional)" className="full">
        <textarea
          rows={2}
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Payment terms, usual lead time…"
          disabled={disabled}
        />
      </Field>
    </div>
  )
}

export function supplierFormProblem(name: string, phone: string): string | null {
  return validateSupplier({ name, phone })
}

export function supplierFromRow(row: ApiSupplier) {
  return {
    name: row.name,
    phone: row.phone ?? '',
    note: row.note ?? '',
  }
}
