'use client'

import { Trash2 } from 'lucide-react'
import { CatalogLinePicker } from '@/components/sales/catalog-line-picker'
import { QtyStepper } from '@/components/sales/qty-stepper'
import { formatNumber } from '@/lib/format'
import type { VariantOption } from '@/types'

export interface TransferLineDraft {
  skuId: string
  sku: string
  label: string
  quantity: number
}

export function TransferLinePicker({
  branchId,
  lines,
  onChange,
  purpose = 'transfer',
}: {
  branchId: string
  lines: TransferLineDraft[]
  onChange: (lines: TransferLineDraft[]) => void
  /** Branch staff replenishment requests vs manager transfer prep. */
  purpose?: 'transfer' | 'replenishment'
}) {
  const inCart = Object.fromEntries(lines.map((line) => [line.skuId, line.quantity]))
  /* A transfer draft moves nothing: the server checks the stock at dispatch,
     and accepts sending fewer than asked. So the picker shows what is at the
     source without refusing a line the warehouse is still waiting on. */
  const availability = purpose === 'transfer' ? 'warn' : 'ignore'
  const addLabel = purpose === 'replenishment' ? 'Add to request' : 'Add to transfer'
  const linesHeading = purpose === 'replenishment' ? 'On this request' : 'On this transfer'

  const add = (option: VariantOption, quantity: number) => {
    const label = `${option.productName} · ${option.color} / ${option.size}`
    const existing = lines.find((line) => line.skuId === option.variantId)
    if (existing) {
      onChange(lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line)))
      return
    }
    onChange([
      ...lines,
      { skuId: option.variantId, sku: option.sku, label, quantity },
    ])
  }

  const setQuantity = (skuId: string, quantity: number) => {
    if (quantity <= 0) onChange(lines.filter((line) => line.skuId !== skuId))
    else onChange(lines.map((line) => (line.skuId === skuId ? { ...line, quantity } : line)))
  }

  const emptyBranchMessage =
    purpose === 'replenishment'
      ? 'Choose your branch above before adding products.'
      : 'Choose the source location above before adding variants.'

  return (
    <div className="transfer-line-picker">
      {!branchId ? (
        <p className="invoice-picker-hint">{emptyBranchMessage}</p>
      ) : (
        <CatalogLinePicker
          branchId={branchId}
          inCart={inCart}
          onAdd={add}
          availability={availability}
          modelScope={purpose === 'transfer' ? 'branchStock' : 'catalog'}
          addLabel={addLabel}
          searchPlaceholder={
            purpose === 'transfer' ? 'Scan barcode or type SKU, model or code…' : 'Search model, code or SKU'
          }
          searchAriaLabel={
            purpose === 'transfer' ? 'Search products stocked at source' : 'Search catalog for transfer'
          }
          itemLabel={purpose === 'replenishment' ? 'add to request' : 'add to transfer'}
          className="catalog-picker catalog-picker--panel"
        />
      )}

      {lines.length > 0 && (
        <section className="transfer-lines-section prepare-transfer-lines" aria-label={linesHeading}>
          <h3 className="invoice-picker-subhead">{linesHeading}</h3>
          <div className="invoice-picker-table-wrap prepare-transfer-table-wrap">
            <table className="invoice-picker-table prepare-transfer-lines-table">
              <caption className="sr-only">{linesHeading}</caption>
              <thead>
                <tr>
                  <th scope="col">Item & specifications</th>
                  <th scope="col">SKU / model</th>
                  <th scope="col" className="num">
                    Transfer quantity
                  </th>
                  <th scope="col" className="num prepare-transfer-lines-action">
                    <span className="sr-only">Remove line</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.skuId}>
                    <td className="prepare-transfer-line-item">
                      <strong>{line.label}</strong>
                    </td>
                    <td className="tabular invoice-muted">{line.sku || '—'}</td>
                    <td className="num prepare-transfer-line-qty">
                      {purpose === 'transfer' ? (
                        <QtyStepper
                          value={line.quantity}
                          max={9999}
                          onChange={(qty) => setQuantity(line.skuId, qty)}
                          label={`Quantity for ${line.label}`}
                          hideHint
                        />
                      ) : (
                        <input
                          id={`qty-${line.skuId}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={9999}
                          className="invoice-qty-input tabular"
                          value={line.quantity}
                          onChange={(event) => setQuantity(line.skuId, Math.floor(Number(event.target.value)))}
                          aria-label={`Quantity for ${line.label}`}
                        />
                      )}
                    </td>
                    <td className="num prepare-transfer-lines-action">
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => setQuantity(line.skuId, 0)}
                        aria-label={`Remove ${line.label}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export function transferLinesSummary(lines: TransferLineDraft[]) {
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  return `${lines.length} ${lines.length === 1 ? 'variant' : 'variants'} · ${formatNumber(units)} units`
}
