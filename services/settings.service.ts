import { getApiClient } from '@/lib/api'
import { statusOf } from '@/lib/errors'
import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'
import type { ApiSettings, UpdateSettingsInput } from '@/lib/api/types'

/**
 * `GET/PUT /settings`: the rules every branch shares.
 *
 * This is the server route that used to be a device-local exchange rate in
 * `localStorage` and a return window hardcoded in the UI. One row, read by
 * anyone signed in, written with `settings.manage`.
 *
 * Two things this module keeps on the device, and neither is the truth:
 *
 * - **A cache** (`CACHE_KEY`). The receipt printer is synchronous and cannot
 *   await a request, so the last rate the server gave is mirrored here and read
 *   back by `cachedExchangeRate()`. A reload prints the same figure the screen
 *   showed before it.
 * - **Nothing else.** There is no local history of rate changes any more: the
 *   server keeps one row, and who changed it is in `GET /audit-events`.
 */

const CACHE_KEY = 'bitar:settings:v1'

/** What the UI falls back to when the server has never answered. */
export const SETTINGS_FALLBACK: ApiSettings = {
  exchangeRateUsdLbp: null,
  returnPeriodDays: 14,
  defaultReservationDays: 3,
  requireOpenCashSession: false,
}

let inMemory: ApiSettings | null = null

function cache(settings: ApiSettings): ApiSettings {
  inMemory = settings
  if (typeof window !== 'undefined') {
    try {
      writePersistentJson(CACHE_KEY, settings)
    } catch {
      /* A full or blocked store costs one unprinted LBP line, never the sale. */
    }
  }
  return settings
}

/** The last settings seen, without a request. `null` before the first read. */
export function cachedSettings(): ApiSettings | null {
  if (inMemory) return inMemory
  const stored = readPersistentJson<ApiSettings | null>(CACHE_KEY, null)
  if (!stored || typeof stored !== 'object') return null
  inMemory = { ...SETTINGS_FALLBACK, ...stored }
  return inMemory
}

/**
 * `GET /settings`.
 *
 * A server that does not have the route yet answers 404; the till must still
 * open, so the cache is used and then the documented defaults. Any other
 * failure is the caller's to show.
 */
export async function getSettings(): Promise<ApiSettings> {
  try {
    return cache(await getApiClient().getSettings())
  } catch (error) {
    if (statusOf(error) === 404) return cachedSettings() ?? SETTINGS_FALLBACK
    throw error
  }
}

/** `PUT /settings`. Send only the fields that changed: an unknown key is a 400. */
export async function updateSettings(input: UpdateSettingsInput): Promise<ApiSettings> {
  return cache(await getApiClient().updateSettings(input))
}

/* ---- the exchange rate --------------------------------------------------------------------------- */

/** Whole pounds for 1 USD, or `null` when no rate is set: then show USD only. */
export function exchangeRateOf(settings: ApiSettings | null | undefined): number | null {
  const rate = settings?.exchangeRateUsdLbp
  return typeof rate === 'number' && rate > 0 ? rate : null
}

/** The rate without awaiting anything, for the synchronous receipt printer. */
export function cachedExchangeRate(): number | null {
  return exchangeRateOf(cachedSettings())
}

/** `usd` in pounds, rounded to the whole pound, or `null` with no rate set. */
export function usdToLbp(usd: number, rate: number | null): number | null {
  if (rate === null || rate <= 0) return null
  return Math.round(usd * rate)
}

export type { ApiSettings, UpdateSettingsInput }
