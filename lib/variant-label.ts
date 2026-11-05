/**
 * How a variant is named everywhere it appears: `Model name · Colour · Size`,
 * with the SKU in small muted text below it.
 *
 * Reports and pickers rank per SKU, so a model that sells in six colours
 * produces six rows whose model name is identical. Without the colour and the
 * size on the face of the row they are indistinguishable, and a list nobody can
 * tell apart cannot be acted on.
 */
export function variantLabel(parts: { productName: string; color?: string | null; size?: string | null }): string {
  return [parts.productName, parts.color, parts.size].filter((part) => part && String(part).trim()).join(' · ')
}

/** The same, for an aria-label or a chart tick where a dot would not be read. */
export function variantSpoken(parts: { productName: string; color?: string | null; size?: string | null }): string {
  return [parts.productName, parts.color, parts.size].filter((part) => part && String(part).trim()).join(', ')
}
