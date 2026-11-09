import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'

/** Per-SKU and per-style costs. no catalog cost field on the API yet (see ARCHITECTURE.md §9). */
const STORAGE_KEY = 'bitar:catalog-costs:v1'

interface CostStore {
  styles: Record<string, number>
  skus: Record<string, number>
}

function readStore(): CostStore {
  return readPersistentJson<CostStore>(STORAGE_KEY, { styles: {}, skus: {} })
}

function writeStore(store: CostStore) {
  writePersistentJson(STORAGE_KEY, store)
}

export function getStyleCost(styleId: string): number | undefined {
  const value = readStore().styles[styleId]
  return value === undefined ? undefined : value
}

export function getSkuCost(skuId: string): number | undefined {
  const value = readStore().skus[skuId]
  return value === undefined ? undefined : value
}

export function setStyleCost(styleId: string, unitCost: number) {
  const store = readStore()
  store.styles[styleId] = unitCost
  writeStore(store)
}

export function setSkuCost(skuId: string, unitCost: number) {
  const store = readStore()
  store.skus[skuId] = unitCost
  writeStore(store)
}

/** After SKUs are created, record what the admin entered for cost. */
export function applyModelCosts(
  styleId: string,
  defaultCost: number,
  skuByCombo: Map<string, string>,
  perComboCost: Record<string, number> = {},
) {
  setStyleCost(styleId, defaultCost)
  for (const [comboKey, skuId] of skuByCombo) {
    const cost = perComboCost[comboKey] ?? defaultCost
    setSkuCost(skuId, cost)
  }
}

export function forgetStyleCosts(styleId: string) {
  const store = readStore()
  delete store.styles[styleId]
  writeStore(store)
}
