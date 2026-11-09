import Link from 'next/link'
import { variantLabel } from '@/lib/variant-label'

/**
 * How a variant is named in a table cell: `Model · Colour · Size` on top, with
 * the SKU in small muted text underneath.
 *
 * One component rather than the same two lines written out in each table, so
 * the order never drifts between screens. and because the colour and the size
 * are the only things telling two rows of the same model apart, they are not
 * optional detail that a tight column can drop.
 */
export function VariantCell({
  productName,
  color,
  size,
  sku,
  href,
}: {
  productName: string
  color?: string | null
  size?: string | null
  sku?: string | null
  /** When set, the name becomes the link to the record. */
  href?: string
}) {
  const label = variantLabel({ productName, color, size })
  return (
    <>
      {href ? (
        <Link href={href} className="link-cell">
          <strong>{label}</strong>
        </Link>
      ) : (
        <strong>{label}</strong>
      )}
      {sku && <small className="tabular">{sku}</small>}
    </>
  )
}
