'use client'

import { useEffect, useState } from 'react'
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister, type UseFormWatch } from 'react-hook-form'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { useBranchStock, useVariantSearch } from '@/hooks/use-invoices'
import { formatPrice } from '@/lib/format'
import { lineTotal } from '@/lib/invoice-totals'
import { pricedAtCost, stockSign } from '@/lib/invoices'
import type { InvoiceFormValues } from '@/schemas/invoice.schema'
import type { InvoiceKind, VariantOption } from '@/types'

const SEARCH_DEBOUNCE_MS = 250

export function InvoiceLineFields({
  control,
  register,
  watch,
  errors,
  kind,
  branchId,
  knownVariants,
}: {
  control: Control<InvoiceFormValues>
  register: UseFormRegister<InvoiceFormValues>
  watch: UseFormWatch<InvoiceFormValues>
  errors: FieldErrors<InvoiceFormValues>
  kind: InvoiceKind
  branchId: string
  /** Variants already on the document, so saved lines can label themselves. */
  knownVariants: VariantOption[]
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [labels, setLabels] = useState<Record<string, VariantOption>>(() =>
    Object.fromEntries(knownVariants.map((option) => [option.variantId, option])),
  )

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { data: options, isPending, isError } = useVariantSearch(term)
  const { data: onHand } = useBranchStock(branchId)
  const lines = watch('lines')
  const outbound = stockSign(kind) === -1
  const chosen = new Set(lines?.map((line) => line.variantId))

  const add = (option: VariantOption) => {
    setLabels((current) => ({ ...current, [option.variantId]: option }))
    append({
      variantId: option.variantId,
      quantity: 1,
      unitPrice: pricedAtCost(kind) ? option.costPrice : option.sellPrice,
    })
    setSearch('')
    setTerm('')
  }

  return (
    <div className="drawer-section">
      <div className="variant-heading">
        <div>
          <p className="section-label">Lines</p>
          <p className="field-hint">
            {outbound
              ? 'Quantities leave the branch when the document is issued.'
              : 'Quantities arrive at the branch when the document is issued.'}
          </p>
        </div>
      </div>

      <div className="search-field">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Scan a barcode, or search a SKU or product"
          aria-label="Search the catalog for a line to add"
        />
      </div>

      {isPending && <p className="field-hint">Searching the catalog…</p>}
      {isError && <p className="field-error">The catalog could not be searched. Try again.</p>}
      {options?.length === 0 && <p className="field-hint">Nothing in the catalog matches that.</p>}

      {options && options.length > 0 && (
        <ul className="picker-list">
          {options.map((option) => {
            const already = chosen.has(option.variantId)
            return (
              <li key={option.variantId}>
                <button type="button" className="picker-row" onClick={() => add(option)} disabled={already}>
                  <span className="demo-text">
                    <strong>
                      {option.productName} · {option.size} / {option.color}
                    </strong>
                    <small>
                      {option.sku}
                      {onHand ? ` · ${onHand[option.variantId] ?? 0} available` : ''}
                    </small>
                  </span>
                  {already ? <span className="pill pill-neutral">Added</span> : <Plus size={16} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {errors.lines?.root?.message && <span className="field-error">{errors.lines.root.message}</span>}
      {typeof errors.lines?.message === 'string' && <span className="field-error">{errors.lines.message}</span>}

      <ul className="variant-rows">
        {fields.map((field, index) => {
          const line = lines?.[index]
          const option = line ? labels[line.variantId] : undefined
          const available = line && onHand ? (onHand[line.variantId] ?? 0) : null
          const short = outbound && available !== null && line ? line.quantity > available : false

          return (
            <li key={field.id} className="line-row">
              <div className="line-label">
                <strong>{option ? `${option.productName} · ${option.size} / ${option.color}` : 'Unknown variant'}</strong>
                <small>
                  {option?.sku ?? line?.variantId}
                  {available !== null ? ` · ${available} available` : ''}
                </small>
              </div>
              <Field label="Qty" error={errors.lines?.[index]?.quantity?.message}>
                <input
                  {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Unit price" error={errors.lines?.[index]?.unitPrice?.message}>
                <input
                  {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                />
              </Field>
              <p className="line-total tabular">{line ? formatPrice(lineTotal(line)) : formatPrice(0)}</p>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => remove(index)}
                aria-label={`Remove line ${index + 1}`}
                title="Remove line"
              >
                <Trash2 size={16} />
              </button>
              {short && (
                <p className="line-warning" role="status">
                  Only {available} available here. Issuing will be refused until the quantity fits.
                </p>
              )}
              {errors.lines?.[index]?.variantId?.message && (
                <p className="line-warning">{errors.lines[index]?.variantId?.message}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
