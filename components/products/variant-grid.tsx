'use client'

import { useColors } from '@/hooks/use-attributes'

/** Color rows × size columns. Each tick is one variant; existing ones are ticked and locked. */
export function VariantGrid({
  colors,
  sizes,
  isOn,
  isLocked = () => false,
  onToggle,
}: {
  colors: string[]
  sizes: string[]
  isOn: (color: string, size: string) => boolean
  isLocked?: (color: string, size: string) => boolean
  onToggle: (color: string, size: string) => void
}) {
  const { data: palette } = useColors()
  const hexOf = (name: string) => palette?.find((entry) => entry.name === name)?.hex

  if (colors.length === 0 || sizes.length === 0) {
    return <p className="muted">Pick at least one color and one size to see the combinations.</p>
  }

  return (
    <div className="table-wrap">
      <table className="variant-grid">
        <caption className="sr-only">Variants to create. Untick a combination you do not stock.</caption>
        <thead>
          <tr>
            <th scope="col">Color</th>
            {sizes.map((size) => (
              <th key={size} scope="col" className="tabular">
                {size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colors.map((color) => (
            <tr key={color}>
              <th scope="row">
                <span className="grid-color">
                  <span className="swatch" style={{ background: hexOf(color) }} aria-hidden="true" />
                  {color}
                </span>
              </th>
              {sizes.map((size) => {
                const locked = isLocked(color, size)
                return (
                  <td key={size}>
                    <input
                      type="checkbox"
                      checked={locked || isOn(color, size)}
                      disabled={locked}
                      onChange={() => onToggle(color, size)}
                      aria-label={`${color} / ${size}${locked ? ' (already exists)' : ''}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
