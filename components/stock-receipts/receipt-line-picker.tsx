'use client'

import { Trash2 } from 'lucide-react'
import { CatalogLinePicker } from '@/components/sales/catalog-line-picker'
import { formatNumber, formatPrice } from '@/lib/format'
import { variantLabel } from '@/lib/variant-label'
import { getSkuCost } from '@/services/catalog-costs.service'
import type { StockReceiptLine } from '@/services/stock-receipts.service'
import type { VariantOption } from '@/types'

/**
 * The lines on a receipt: a variant, how many pieces arrived, and what each one
 * cost.
 *
 * It reuses the till's catalog picker with `enforceStock` off. Everywhere else
 * that picker stops you adding more than is on the shelf, which is right when
 * stock is going out — here the stock is coming *in*, so what is currently on
 * hand is no limit at all, and a receipt that refused to add a variant sitting
 * at zero would refuse exactly the first delivery of a new model.
 */
export function ReceiptLinePicker({
  branchId,
  lines,
  onChange,
  showCosts,
}: {
  branchId: string
  lines: StockReceiptLine[]
  onChange: (lines: StockReceiptLine[]) => void
  showCosts: boolean
}) {
  const inCart = Object.fromEntries(lines.map((line) => [line.skuId, line.quantity]))

  const add = (option: VariantOption, quantity: number) => {
    const existing = lines.find((line) => line.skuId === option.variantId)
    if (existing) {
      onChange(lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line)))
      return
    }
    onChange([
      ...lines,
      {
        skuId: option.variantId,
        code: option.sku,
        label: variantLabel({ productName: option.productName, color: option.color, size: option.size }),
        quantity,
        unitCost: getSkuCost(option.variantId) ?? 0,
      },
    ])
  }

  /* Clamped at zero rather than removing the row. A pre-loaded receipt arrives
     with every variant of a model at zero and most of them stay that way, so
     clearing a box must not delete the line the person is still looking at.
     Removing is the bin button, which is explicit. */
  const setQuantity = (skuId: string, quantity: number) => {
    const safe = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0
    onChange(lines.map((line) => (line.skuId === skuId ? { ...line, quantity: safe } : line)))
  }

  const remove = (skuId: string) => onChange(lines.filter((line) => line.skuId !== skuId))

  const setCost = (skuId: string, unitCost: number) => {
    onChange(lines.map((line) => (line.skuId === skuId ? { ...line, unitCost } : line)))
  }

  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0)
  /* Only the lines with something on them will be posted, so that is the count
     worth showing — a pre-loaded receipt of thirty variants where four arrived
     is "4 of 30", not "30 lines". */
  const filled = lines.filter((line) => line.quantity > 0).length

  return (
    <div className="transfer-line-picker">
      {!branchId ? (
        <p className="invoice-picker-hint">Choose the location the stock arrived at before adding variants.</p>
      ) : (
        <CatalogLinePicker
          branchId={branchId}
          inCart={inCart}
          onAdd={add}
          availability="ignore"
          addLabel="Add to receipt"
          searchPlaceholder="Search model, code or SKU"
          searchAriaLabel="Search catalog for this receipt"
          itemLabel="add to receipt"
          className="catalog-picker catalog-picker--panel"
        />
      )}

      {lines.length > 0 && (
        <section className="transfer-lines-section" aria-label="On this receipt">
          <h3 className="invoice-picker-subhead">On this receipt</h3>
          <div className="invoice-picker-table-wrap">
            <table className="invoice-picker-table">
              <caption className="sr-only">Lines on this receipt</caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">Qty</th>
                  {showCosts && <th scope="col" className="num">Unit cost</th>}
                  {showCosts && <th scope="col" className="num">Line total</th>}
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.skuId}>
                    <td>{line.label}</td>
                    <td className="tabular">{line.code}</td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        className="input input-sm tabular"
                        value={line.quantity === 0 ? '' : line.quantity}
                        placeholder="0"
                        aria-label={`Pieces received of ${line.label}`}
                        onChange={(event) => setQuantity(line.skuId, Number(event.target.value))}
                      />
                    </td>
                    {showCosts && (
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          className="input input-sm tabular"
                          value={line.unitCost === 0 ? '' : line.unitCost}
                          placeholder="0.00"
                          aria-label={`Cost per piece of ${line.label}`}
                          onChange={(event) => setCost(line.skuId, Number(event.target.value) || 0)}
                        />
                      </td>
                    )}
                    {showCosts && (
                      <td className="num tabular">
                        {line.unitCost > 0 ? formatPrice(line.quantity * line.unitCost) : '—'}
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => remove(line.skuId)}
                        aria-label={`Remove ${line.label}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    {filled === lines.length
                      ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`
                      : `${filled} of ${lines.length} lines`}
                  </td>
                  <td className="num tabular">{formatNumber(units)}</td>
                  {showCosts && <td />}
                  {showCosts && <td className="num tabular">{total > 0 ? formatPrice(total) : '—'}</td>}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
