/**
 * Branch code derived from the display name: "City Centre Mall – Beirut" ->
 * "CITYCENTREMALLBEIRUT". The API allows `-` and `_` too, but a plain token
 * reads better on a badge, and it uppercases whatever it is sent anyway.
 * Capped at the API's 20 characters.
 */
export function buildBranchCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 20)
}
