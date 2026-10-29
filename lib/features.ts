/**
 * What is outside the MVP. Each flag is off, so the screen and its sidebar
 * link are hidden, while the code stays where it is and switches back on by
 * flipping one value here.
 *
 * - `b2bSales`: wholesale documents. BL-04 keeps warehouse business sales out
 *   of the MVP.
 * - `replenishmentSuggestions`: the suggested-quantity logic. BL-05 marks it
 *   future; the manual request flow stays on.
 */
export const FEATURES = {
  b2bSales: false,
  replenishmentSuggestions: false,
} as const

export type FeatureFlag = keyof typeof FEATURES

export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag]
}
