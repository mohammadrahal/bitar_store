import { getApiClient } from '@/lib/api'
import { ApiError } from '@/lib/api/api-error'
import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'
import type { ApiAdjustmentReason } from '@/lib/api/types'
import { deleteBlob, getBlob, putBlob } from '@/lib/blob-store'
import { variantLabel } from '@/lib/variant-label'
import { getSkuCost, getStyleCost } from '@/services/catalog-costs.service'
import { readDb } from '@/lib/catalog-cache/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/** The locations a scope covers, after the signed-in user's own access. */
function branchIdsInScope(scope: BranchScope): string[] {
  const resolved = visibleScope(scope)
  const visible = visibleBranchIds(readDb())
  if (resolved === ALL_BRANCHES) return visible
  return visible.includes(resolved) ? [resolved] : []
}

/**
 * Stock corrections, and the receipts an older build left in this browser.
 *
 * **Supplier deliveries no longer live here.** They go to
 * `POST /goods-receipts` through `goods-receipts.service.ts`, which records the
 * supplier, their invoice number and the cost per piece as a real document and
 * grows the warehouse stock in the same transaction. This file used to do that
 * job with one `/stock/adjustments` call per line plus paperwork in
 * `localStorage`, because the endpoint did not exist when it was written.
 *
 * What is left is the part that is still only an adjustment:
 *
 * - **Corrections**. `postStockCorrection`, one SKU at one location. The only
 *   way to change a balance after a SKU has been opened there, and the way a
 *   mistake on a posted receipt is put right.
 * - **Reading the old receipts**, so nobody loses their history. Their
 *   quantities are on the server; the supplier and costs on them were only ever
 *   on the device that typed them, and every screen showing one says so.
 */

export interface StockReceiptLine {
  skuId: string
  /** `Model / Colour / Size`, captured now: the catalog can be renamed later. */
  label: string
  code: string
  quantity: number
  /** Cost per piece in USD. Zero means "not recorded", not "free". */
  unitCost: number
}

/**
 * Every variant of one model, as blank receipt lines.
 *
 * This is how `/stock-receipts/new?style=MD000124` arrives pre-loaded straight
 * after a model is created: the thirty rows you just defined are already there
 * with nothing in them, so the only thing left to type is what actually turned
 * up. Lines come back at quantity zero and are filtered out on post, so a row
 * nobody fills in costs nothing.
 */
export function blankLinesForStyle(styleCode: string): StockReceiptLine[] {
  const code = styleCode.trim().toLowerCase()
  if (!code) return []
  const db = readDb()
  const product = db.products.find((candidate) => candidate.code.toLowerCase() === code)
  if (!product) return []
  const defaultCost = getStyleCost(product.id) ?? 0
  return db.variants
    .filter((variant) => variant.productId === product.id)
    .map((variant) => ({
      skuId: variant.id,
      code: variant.sku,
      label: variantLabel({ productName: product.name, color: variant.color, size: variant.size }),
      quantity: 0,
      unitCost: getSkuCost(variant.id) ?? defaultCost,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** A photograph picked and shrunk in the form, not yet stored. */
export interface ReceiptPhotoDraft {
  blob: Blob
  width: number
  height: number
  originalBytes: number
}

/** What is remembered about a stored photograph. The bytes live in IndexedDB. */
export interface ReceiptPhotoMeta {
  width: number
  height: number
  bytes: number
  /** False when the blob could not be written. a full or blocked store. */
  stored: boolean
}

export interface StockReceiptDraft {
  branchId: string
  /** The number on the supplier's paperwork. Optional; ours is generated. */
  reference: string
  supplierName: string
  /** `yyyy-mm-dd` - the date on the document, which is not always today. */
  receivedOn: string
  note: string
  lines: StockReceiptLine[]
  /** A picture of the supplier's invoice, already downscaled. */
  photo?: ReceiptPhotoDraft
}

export interface StockReceiptLineResult extends StockReceiptLine {
  /** The server's adjustment id, or null when this line did not post. */
  adjustmentId: string | null
  error?: string
}

export interface StockReceipt extends Omit<StockReceiptDraft, 'lines' | 'photo'> {
  id: string
  /**
   * **Our** number for the document, generated on submit: `RCV-2026-0014`.
   *
   * Distinct from `reference`, which is the supplier's own number copied off
   * their paperwork. One is what we call this delivery, the other is what they
   * call it, and a single field doing both jobs meant neither was reliable.
   */
  receiptNo: string
  postedAt: string
  postedByName: string
  lines: StockReceiptLineResult[]
  photo?: ReceiptPhotoMeta
}

const PHOTO_PREFIX = 'receipt-photo:'

export function receiptPhotoKey(receiptId: string): string {
  return `${PHOTO_PREFIX}${receiptId}`
}

const STORAGE_KEY = 'bitar:stock-receipts:v1'

function readAll(): StockReceipt[] {
  return readPersistentJson<StockReceipt[]>(STORAGE_KEY, [])
}

function writeAll(receipts: StockReceipt[]) {
  try {
    writePersistentJson(STORAGE_KEY, receipts)
  } catch {
    /* Blocked site data. The stock still moved and the audit log still has the
       note; only this device's copy of the paperwork is lost. */
  }
}

export function listStockReceipts(scope: BranchScope): StockReceipt[] {
  const allowed = new Set(branchIdsInScope(scope))
  return readAll()
    .filter((row) => allowed.has(row.branchId))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
}

export function getStockReceipt(id: string): StockReceipt | undefined {
  return readAll().find((row) => row.id === id)
}

/** The stored photograph, or null if there is none or it could not be read. */
export function getReceiptPhoto(receiptId: string): Promise<Blob | null> {
  return getBlob(receiptPhotoKey(receiptId))
}


export function receiptUnits(receipt: Pick<StockReceipt, 'lines'>): number {
  return receipt.lines.reduce((sum, line) => sum + (line.adjustmentId ? line.quantity : 0), 0)
}

export function receiptTotal(receipt: Pick<StockReceipt, 'lines'>): number {
  return receipt.lines.reduce((sum, line) => sum + (line.adjustmentId ? line.quantity * line.unitCost : 0), 0)
}

/** Lines of a legacy receipt that never reached the server. */
export function receiptFailures(receipt: Pick<StockReceipt, 'lines'>): StockReceiptLineResult[] {
  return receipt.lines.filter((line) => !line.adjustmentId)
}

/** Whether any line recorded a cost, so a column of zeroes is not shown. */
export function receiptHasCosts(receipt: Pick<StockReceipt, 'lines'>): boolean {
  return receipt.lines.some((line) => line.unitCost > 0)
}

/**
 * The note a legacy receipt wrote into the audit log, rebuilt so its detail
 * page can show what the server was told. Read-only now: deliveries go through
 * `POST /goods-receipts`, which records the supplier and the invoice number as
 * fields rather than as prose in a note.
 */
export function receiptNote(receipt: Pick<StockReceipt, 'reference' | 'supplierName' | 'receiptNo'>): string {
  const reference = receipt.reference.trim()
  const supplier = receipt.supplierName.trim()
  const parts = ['Stock received', receipt.receiptNo]
  if (reference) parts.push(`(their ref ${reference})`)
  if (supplier) parts.push(`from ${supplier}`)
  return parts.join(' ').slice(0, 200)
}

export interface StockCorrection {
  branchId: string
  skuId: string
  /** Signed: positive puts pieces in, negative takes them out. Never zero. */
  quantityDelta: number
  reason: ApiAdjustmentReason
  note: string
}

/**
 * One correction to one variant at one location: the "edit the quantity" path,
 * as opposed to a whole received document.
 *
 * It is a delta and not a new total, because that is what the endpoint takes
 * and because a total typed into a box silently overwrites whatever was sold
 * while the box was open. The form asks for the counted total and works out the
 * difference, so what reaches the server is the change the person meant.
 */
/**
 * Which reasons the server accepts in which direction, read off `API_GUIDE.md`:
 * `found` only adds, `loss` and `damage` only remove, the rest go either way.
 * Checked here so the form can say so, instead of the server answering `400`
 * once the person has already committed.
 */
const REASON_DIRECTION: Record<ApiAdjustmentReason, 'add' | 'remove' | 'both'> = {
  count_correction: 'both',
  data_entry_error: 'both',
  other: 'both',
  found: 'add',
  loss: 'remove',
  damage: 'remove',
}

/** Why this reason cannot carry this sign, in the words the form will show. */
export function reasonDirectionProblem(reason: ApiAdjustmentReason, quantityDelta: number): string | null {
  const allowed = REASON_DIRECTION[reason]
  if (allowed === 'both' || quantityDelta === 0) return null
  if (allowed === 'add' && quantityDelta < 0) {
    return `“${REASON_LABELS[reason]}” can only add pieces. Pick another reason to take pieces out.`
  }
  if (allowed === 'remove' && quantityDelta > 0) {
    return `“${REASON_LABELS[reason]}” can only take pieces out. Pick another reason to add pieces.`
  }
  return null
}

export async function postStockCorrection(input: StockCorrection, idempotencyKey: string) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error('Enter a counted quantity that differs from what is on hand.')
  }
  if (Math.abs(input.quantityDelta) > 100_000) {
    throw new Error('A single correction cannot exceed 100,000 pieces.')
  }
  const direction = reasonDirectionProblem(input.reason, input.quantityDelta)
  if (direction) throw new Error(direction)
  const note = input.note.trim()
  if (note.length < 5) throw new Error('Say what happened, in at least five characters.')

  const api = getApiClient()
  /* The key belongs to the caller and is held across retries. Generating one
     here meant a second tap after a lost answer posted the correction twice. */
  return api.createStockAdjustment({ ...input, note: note.slice(0, 200) }, idempotencyKey)
}

/** Plain words for the server's reason codes. Never show the raw value. */
export const REASON_LABELS: Record<ApiAdjustmentReason, string> = {
  count_correction: 'Counted and corrected',
  damage: 'Damaged',
  loss: 'Lost or stolen',
  found: 'Found',
  data_entry_error: 'Entered wrong',
  other: 'Other',
}

export async function deleteStockReceipt(id: string): Promise<void> {
  /* Deletes this device's copy of the paperwork only. The stock it placed and
     the audit entries behind it are the server's and stay where they are.
     The photograph goes with it. an orphaned blob would hold megabytes for a
     record nothing can reach any more. */
  writeAll(readAll().filter((row) => row.id !== id))
  await deleteBlob(receiptPhotoKey(id))
}

const ADJUSTMENT_PAGE = 50

/**
 * Corrections and receipts the server knows about, newest first.
 *
 * `GET /stock/adjustments` takes one `branchId`, so every location in scope is
 * read and the pages merged. A branch that refuses the read is dropped rather
 * than failing the panel: one location a manager cannot see should not hide the
 * corrections at the ones they can.
 */
export async function fetchStockAdjustments(scope: BranchScope) {
  const api = getApiClient()
  const branchIds = branchIdsInScope(scope)
  if (branchIds.length === 0) return []
  const pages = await Promise.all(
    branchIds.map((branchId) =>
      api.listStockAdjustments({ branchId, limit: ADJUSTMENT_PAGE }).catch(() => []),
    ),
  )
  return pages
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, ADJUSTMENT_PAGE)
}
