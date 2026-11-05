'use client'

import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { comboKey } from '@/schemas/product.schema'

/** Optional first units at one location when saving a new model. */
export function VariantOpeningQuantities({
  combos,
  quantities,
  onChange,
}: {
  combos: { color: string; size: string }[]
  quantities: Record<string, number>
  onChange: (next: Record<string, number>) => void
}) {
  const setQty = (key: string, text: string) => {
    const next = { ...quantities }
    if (text === '' || text === '0') delete next[key]
    else next[key] = Math.max(0, Math.floor(Number(text) || 0))
    onChange(next)
  }

  const pagination = usePagination(combos, 20)

  if (combos.length === 0) return <p className="muted">Pick variants above to enter quantities.</p>

  return (
    <>
      <div className="table-wrap">
        <table className="opening-grid">
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col">Units</th>
            </tr>
          </thead>
          <tbody>
            {pagination.visible.map(({ color, size }) => {
              const key = comboKey(color, size)
              return (
                <tr key={key}>
                  <td>
                    {color} · {size}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={quantities[key] ?? ''}
                      placeholder="0"
                      onChange={(event) => setQty(key, event.target.value)}
                      aria-label={`Units for ${color} ${size}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPage={pagination.setPage}
      />
    </>
  )
}
