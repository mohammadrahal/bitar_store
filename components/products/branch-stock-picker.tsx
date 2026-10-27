'use client'

import { ErrorState } from '@/components/shared/error-state'
import { useBranches } from '@/hooks/use-branches'
import { comboKey, openingKey } from '@/schemas/product.schema'

/**
 * Which branches carry a new model, and how many units each starts with.
 * Branches left out never list the model, so it cannot show as out of stock there.
 */
export function BranchStockPicker({
  combos,
  selected,
  opening,
  prices,
  defaultPrice,
  onSelectedChange,
  onOpeningChange,
  onPriceChange,
}: {
  combos: { color: string; size: string }[]
  selected: string[]
  opening: Record<string, number>
  prices: Record<string, number>
  /** Used for any variant that has not been given its own price. */
  defaultPrice: number
  onSelectedChange: (next: string[]) => void
  onOpeningChange: (next: Record<string, number>) => void
  onPriceChange: (next: Record<string, number>) => void
}) {
  const { data: branches, isPending, isError, error, refetch } = useBranches()

  if (isPending) return <p className="muted">Loading branches…</p>
  if (isError) return <ErrorState title="Could not load branches" error={error} onRetry={() => void refetch()} />
  const active = branches.filter((branch) => branch.isActive)
  if (active.length === 0) return <p className="muted">There are no active branches to stock this model in.</p>

  const chosen = active.filter((branch) => selected.includes(branch.id))
  const toggle = (branchId: string) =>
    onSelectedChange(selected.includes(branchId) ? selected.filter((id) => id !== branchId) : [...selected, branchId])
  const setRecord = (current: Record<string, number>, key: string, text: string, onChange: (next: Record<string, number>) => void) => {
    const next = { ...current }
    if (text === '') delete next[key]
    else next[key] = Number(text)
    onChange(next)
  }

  return (
    <>
      <ul className="chip-row" aria-label="Branches">
        {active.map((branch) => (
          <li key={branch.id}>
            <button type="button" className="chip" aria-pressed={selected.includes(branch.id)} onClick={() => toggle(branch.id)}>
              {branch.name}
            </button>
          </li>
        ))}
      </ul>

      {chosen.length > 0 && combos.length === 0 && (
        <p className="muted">Pick colors and sizes to enter opening quantities.</p>
      )}
      {chosen.length > 0 && combos.length > 0 && (
        <div className="table-wrap opening-grid">
          <table className="variant-grid">
            <caption className="sr-only">Opening units per variant and branch. Leave blank for none.</caption>
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col">Price</th>
                {chosen.map((branch) => (
                  <th key={branch.id} scope="col">{branch.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {combos.map(({ color, size }) => {
                const priceKey = comboKey(color, size)
                return (
                  <tr key={priceKey}>
                    <th scope="row">{color} / {size}</th>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="tabular"
                        value={prices[priceKey] ?? (Number.isFinite(defaultPrice) && defaultPrice > 0 ? defaultPrice : '')}
                        placeholder="0"
                        onChange={(event) => setRecord(prices, priceKey, event.target.value, onPriceChange)}
                        aria-label={`Sell price of ${color} / ${size}`}
                      />
                    </td>
                    {chosen.map((branch) => {
                      const key = openingKey(branch.id, color, size)
                      return (
                        <td key={branch.id}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            className="tabular"
                            value={opening[key] ?? ''}
                            placeholder="0"
                            onChange={(event) => setRecord(opening, key, event.target.value, onOpeningChange)}
                            aria-label={`Opening units of ${color} / ${size} at ${branch.name}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
