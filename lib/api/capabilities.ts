import { ApiError } from '@/lib/api/api-error'
import { getApiBaseUrl } from '@/lib/api/client'
import type { ApiWarehouse } from '@/lib/api/types'

/** Optional routes from API handoff v0.9+. Older servers answer 404 `Resource not found`. */
export type ApiFeature = 'warehouse' | 'categories' | 'permissions' | 'branchAccess' | 'salesHistory'

type FeatureState = 'unknown' | 'available' | 'missing'

const FEATURES: ApiFeature[] = ['warehouse', 'categories', 'permissions', 'branchAccess', 'salesHistory']

const state: Record<ApiFeature, FeatureState> = {
  warehouse: 'unknown',
  categories: 'unknown',
  permissions: 'unknown',
  branchAccess: 'unknown',
  salesHistory: 'unknown',
}

export function isApiFeatureAvailable(feature: ApiFeature): boolean {
  return state[feature] === 'available'
}

export function isApiFeatureMissing(feature: ApiFeature): boolean {
  return state[feature] === 'missing'
}

/* ---- where the answers are kept -----------------------------------------------------------------
   Which routes a server has cannot change under a live token, so the probes are
   worth exactly one run per sign-in. They used to run inside `bootstrapSession`,
   which is also called on every page load and on every window focus: that put
   five speculative requests. `/categories` and `/permissions` among them. in
   front of screens such as Inventory, which ask for none of them. The answers
   now survive a reload in `sessionStorage`, beside the token they belong to. */

const STORE_KEY = 'bitar:api-capabilities:v1'

interface Snapshot {
  token: string
  state: Record<ApiFeature, FeatureState>
  warehouse: ApiWarehouse | null
}

/** What `GET /warehouse` answered during the probe, so nothing asks it twice. */
let warehouseFromProbe: ApiWarehouse | null = null

export function probedWarehouse(): ApiWarehouse | null {
  return warehouseFromProbe
}

let probedFor: string | null = null

function persist() {
  if (probedFor === null || typeof window === 'undefined') return
  try {
    const snapshot: Snapshot = { token: probedFor, state, warehouse: warehouseFromProbe }
    sessionStorage.setItem(STORE_KEY, JSON.stringify(snapshot))
  } catch {
    /* A full or blocked store only costs a re-probe on the next load. */
  }
}

function mark(feature: ApiFeature, available: boolean) {
  state[feature] = available ? 'available' : 'missing'
  persist()
}

/** Replays a snapshot taken under this same token. True when nothing needs probing. */
function restore(token: string): boolean {
  if (typeof window === 'undefined') return false
  let snapshot: Snapshot | null = null
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return false
    snapshot = JSON.parse(raw) as Snapshot
  } catch {
    return false
  }
  if (snapshot?.token !== token || typeof snapshot.state !== 'object' || snapshot.state === null) return false
  /* Every feature has to be decided, or the screens behind an undecided one
     would be told nothing for the rest of the session. */
  const decided = FEATURES.every(
    (feature) => snapshot.state[feature] === 'available' || snapshot.state[feature] === 'missing',
  )
  if (!decided) return false
  for (const feature of FEATURES) state[feature] = snapshot.state[feature]
  warehouseFromProbe = snapshot.warehouse ?? null
  return true
}

/** Dropped on sign-out: the next token gets its own answers. */
export function forgetApiCapabilities(): void {
  probedFor = null
  warehouseFromProbe = null
  for (const feature of FEATURES) state[feature] = 'unknown'
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORE_KEY)
  } catch {
    /* Nothing to do: a stale snapshot is keyed by the old token anyway. */
  }
}

/* ---- the probes ---------------------------------------------------------------------------------- */

async function probeGet(token: string, path: string): Promise<{ exists: boolean; body: string }> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const text = await response.text()
  if (response.status === 404 && text.includes('Resource not found')) {
    return { exists: false, body: text }
  }
  return { exists: true, body: text }
}

/* `GET /warehouse` answers `{ id, code, name }`. Keeping the id turns the probe
   into the lookup `resolveWarehouseId` would otherwise send straight after it. */
async function probeWarehouse(token: string): Promise<boolean> {
  const { exists, body } = await probeGet(token, '/warehouse')
  if (!exists) return false
  try {
    const warehouse = JSON.parse(body) as ApiWarehouse | null
    if (warehouse && typeof warehouse.id === 'string') warehouseFromProbe = warehouse
  } catch {
    /* A 403, or any other answer that is not the warehouse: the route is there,
       the id is not. */
  }
  return true
}

/* A probe that could not be sent says nothing about the route, so the feature
   stays `unknown`: the screen then calls it and reports the real error, instead
   of being told the server does not have it. */
async function attempt(probe: Promise<boolean>): Promise<boolean | null> {
  try {
    return await probe
  } catch {
    return null
  }
}

/** `GET /sales/history` must be registered before `GET /sales/:id`, or the server looks up a sale id "history". */
async function probeSalesHistory(token: string): Promise<boolean> {
  const response = await fetch(
    `${getApiBaseUrl()}/sales/history?from=2000-01-01&to=2000-01-01&limit=1`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  const text = await response.text()
  if (response.status === 404 && text.includes('Sale not found')) return false
  if (response.status === 404 && text.includes('Resource not found')) return false
  return response.ok || response.status === 400 || response.status === 403
}

async function probeBranchAccess(token: string, userId: string): Promise<boolean> {
  const response = await fetch(`${getApiBaseUrl()}/users/${userId}/branch-access`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (response.status === 404) {
    const text = await response.text()
    if (text.includes('Resource not found')) return false
  }
  return response.ok || response.status === 403
}

/**
 * Runs once per token, and sends nothing at all when a reload can replay the
 * last answers. Stops the UI from calling routes the server does not have.
 */
export async function refreshApiCapabilities(token: string, userId: string): Promise<void> {
  if (probedFor === token) return
  probedFor = token
  if (restore(token)) return

  const [warehouse, categories, permissions, branchAccess, salesHistory] = await Promise.all([
    attempt(probeWarehouse(token)),
    attempt(probeGet(token, '/categories').then((result) => result.exists)),
    attempt(probeGet(token, '/permissions').then((result) => result.exists)),
    attempt(probeBranchAccess(token, userId)),
    attempt(probeSalesHistory(token)),
  ])

  /* Nothing reached the server: do not keep this token marked as probed, or the
     app would spend the whole session with every feature `unknown`. */
  const answers = [warehouse, categories, permissions, branchAccess, salesHistory]
  if (answers.every((answer) => answer === null)) {
    probedFor = null
    return
  }

  if (warehouse !== null) state.warehouse = warehouse ? 'available' : 'missing'
  if (categories !== null) state.categories = categories ? 'available' : 'missing'
  if (permissions !== null) state.permissions = permissions ? 'available' : 'missing'
  if (branchAccess !== null) state.branchAccess = branchAccess ? 'available' : 'missing'
  if (salesHistory !== null) state.salesHistory = salesHistory ? 'available' : 'missing'
  persist()
}

export function noteMissingApiFeature(error: unknown, feature: ApiFeature): void {
  if (error instanceof ApiError && error.status === 404) {
    mark(feature, false)
  }
}

export function apiFeatureHint(feature: ApiFeature): string {
  const labels: Record<ApiFeature, string> = {
    warehouse: 'GET /warehouse',
    categories: 'GET /categories',
    permissions: 'GET /permissions and PUT /users/:id/permissions',
    branchAccess: 'GET /users/:id/branch-access',
    salesHistory: 'GET /sales/history (must be registered before GET /sales/:id on the server)',
  }
  return `This server does not expose ${labels[feature]} yet. Update the backend to match API handoff v0.9+, or ignore screens that need it.`
}
