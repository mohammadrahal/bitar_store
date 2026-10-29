'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useSetLowStockAt } from '@/hooks/use-stock'
import { usePermission } from '@/hooks/use-permission'

/**
 * The threshold is the one stock number a person sets by hand, so it is edited
 * in place. Saves on Enter or blur, reverts on Escape, and stays plain text for
 * anyone without `stock:manage`.
 */
export function ThresholdCell({
  variantId,
  branchId,
  value,
}: {
  variantId: string
  branchId: string
  value: number
}) {
  const { can } = usePermission()
  const save = useSetLowStockAt()
  const [draft, setDraft] = useState(String(value))

  /* A document or another edit can change this underneath the input. */
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  if (!can('thresholds.manage')) return <span className="tabular muted">{value}</span>

  const commit = () => {
    const next = Number(draft)
    if (!Number.isInteger(next) || next < 0 || next === value) {
      setDraft(String(value))
      return
    }
    save.mutate({ variantId, branchId, lowStockAt: next })
  }

  return (
    <span className="threshold-edit">
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        className="tabular"
        value={draft}
        aria-label="Low-stock threshold"
        disabled={save.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') setDraft(String(value))
        }}
      />
      {save.isSuccess && !save.isPending && draft === String(value) && (
        <Check size={14} className="threshold-saved" aria-hidden="true" />
      )}
    </span>
  )
}
