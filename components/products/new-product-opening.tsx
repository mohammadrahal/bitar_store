'use client'

import { OpeningQuantitiesTable } from '@/components/products/opening-quantities-table'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'

/** Where the first units are, and how many of each, as the model is saved. */
export function NewProductOpening({
  combos,
  branchId,
  quantities,
  onBranchChange,
  onQuantitiesChange,
}: {
  combos: { color: string; size: string }[]
  branchId: string
  quantities: Record<string, number>
  onBranchChange: (branchId: string) => void
  onQuantitiesChange: (quantities: Record<string, number>) => void
}) {
  return (
    <>
      <div className="form-grid">
        <Field label="Counted at" className="full" hint="A SKU is opened once per location.">
          <LocationSelect
            value={branchId}
            onChange={onBranchChange}
            onlyAccessible
            onlyFullAccess
            placeholder="Select a location"
            aria-label="Counted at"
          />
        </Field>
      </div>
      <OpeningQuantitiesTable combos={combos} quantities={quantities} onChange={onQuantitiesChange} />
    </>
  )
}
