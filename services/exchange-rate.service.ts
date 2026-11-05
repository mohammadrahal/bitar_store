import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'
import { clampExchangeRate } from '@/lib/input-limits'

/** One USD → LBP rate for the whole business until the settings API ships. */
export interface ExchangeRateSetting {
  usdToLbp: number
  updatedAt: string
  updatedByName?: string
}

export interface ExchangeRateHistoryEntry {
  usdToLbp: number
  updatedAt: string
  updatedByName?: string
}

interface ExchangeRateStorageV2 {
  current: ExchangeRateSetting
  history: ExchangeRateHistoryEntry[]
}

const STORAGE_KEY = 'bitar:exchange-rate:v1'
const HISTORY_LIMIT = 10

function readStorage(): ExchangeRateStorageV2 | null {
  const raw = readPersistentJson<ExchangeRateSetting | ExchangeRateStorageV2 | null>(STORAGE_KEY, null)
  if (!raw) return null
  if ('current' in raw && raw.current?.usdToLbp) return raw as ExchangeRateStorageV2
  const legacy = raw as ExchangeRateSetting
  if (!legacy.usdToLbp || legacy.usdToLbp <= 0) return null
  return { current: legacy, history: [legacy] }
}

export function getExchangeRate(): ExchangeRateSetting | null {
  return readStorage()?.current ?? null
}

export function getExchangeRateHistory(): ExchangeRateHistoryEntry[] {
  return readStorage()?.history ?? []
}

export function saveExchangeRate(usdToLbp: number, updatedByName: string): ExchangeRateSetting {
  const next: ExchangeRateSetting = {
    usdToLbp: clampExchangeRate(usdToLbp),
    updatedAt: new Date().toISOString(),
    updatedByName: updatedByName.trim() || undefined,
  }
  const prev = readStorage()
  const history = [next, ...(prev?.history ?? [])].slice(0, HISTORY_LIMIT)
  writePersistentJson(STORAGE_KEY, { current: next, history } satisfies ExchangeRateStorageV2)
  return next
}

export function usdToLbpAmount(usd: number, rate: ExchangeRateSetting | null): number | null {
  if (!rate || rate.usdToLbp <= 0) return null
  return Math.round(usd * rate.usdToLbp)
}
