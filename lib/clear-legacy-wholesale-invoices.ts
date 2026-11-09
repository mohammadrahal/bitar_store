/** Removes the old browser-only wholesale invoice bucket (pre-API ledger). */
const LEGACY_KEY = 'bitar:wholesale-invoices:v1'

export function clearLegacyWholesaleInvoices() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* blocked storage */
  }
}
