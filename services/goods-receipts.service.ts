import { getApiClient } from '@/lib/api'
import { putBlob, getBlob } from '@/lib/blob-store'
import { priceOf } from '@/lib/api/map-catalog'
import type {
  ApiGoodsReceipt,
  ApiGoodsReceiptSummary,
  ListGoodsReceiptsParams,
} from '@/lib/api/types'
import type { ReceiptPhotoDraft, ReceiptPhotoMeta, StockReceiptLine } from '@/services/stock-receipts.service'
import { receiptPhotoKey } from '@/services/stock-receipts.service'

/**
 * A supplier delivery, as `POST /goods-receipts`.
 *
 * This replaces the device-local paperwork that `stock-receipts.service.ts`
 * used to keep. The whole document is now the server's: supplier, their invoice
 * number, its date, and the cost per piece on every line. The warehouse stock
 * grows in the **same transaction**, so a delivery is all-or-nothing instead of
 * one adjustment per line that could half-land.
 *
 * Two things the endpoint does not take, and this module is explicit about:
 *
 * - **A location.** The delivery always arrives at the warehouse; branches are
 *   stocked from it by transfer. There is no `branchId` to send, and the
 *   warehouse comes back on the answer.
 * - **A photograph.** There is no field for one, so the picture of the
 *   supplier's invoice stays in this browser, keyed by the id the server
 *   issued. The numbers are shared; the snapshot of the paper is not, and every
 *   screen that shows one says so.
 *
 * A receipt cannot be edited or deleted. A mistake is corrected with a stock
 * adjustment, which is what `postStockCorrection` is for.
 */
export interface GoodsReceiptDraft {
  supplierName: string
  /** The number printed on the supplier's own invoice. Required by the server. */
  supplierInvoiceNumber: string
  /** `yyyy-mm-dd` — the date on their document, which is not always today. */
  invoiceDate: string
  note: string
  lines: StockReceiptLine[]
  photo?: ReceiptPhotoDraft
}

/** Server limits, from the API guide. A `400` here would be our bug, not theirs. */
const MAX_LINES = 200
const MAX_QUANTITY = 10_000

export function filledLines(lines: StockReceiptLine[]): StockReceiptLine[] {
  return lines.filter((line) => line.quantity > 0)
}

function hasTooManyDecimals(value: number): boolean {
  return Math.round(value * 100) !== Number((value * 100).toFixed(4))
}

/** The first thing wrong with the draft, in the words the form will show. */
export function validateGoodsReceipt(draft: GoodsReceiptDraft): string | null {
  if (!draft.supplierName.trim()) return 'Enter the supplier’s name.'
  if (!draft.supplierInvoiceNumber.trim()) {
    return 'Enter the number on the supplier’s invoice — the server files the delivery under it.'
  }
  if (!draft.invoiceDate) return 'Enter the date on the supplier’s invoice.'

  const lines = filledLines(draft.lines)
  if (lines.length === 0) return 'Add at least one variant with a quantity.'
  if (lines.length > MAX_LINES) return `A delivery holds up to ${MAX_LINES} products. Split it across two receipts.`

  const seen = new Set<string>()
  for (const line of lines) {
    if (seen.has(line.skuId)) return `${line.label} is on this receipt twice. Raise its quantity instead.`
    seen.add(line.skuId)
    if (!Number.isInteger(line.quantity)) return 'Quantities are whole pieces.'
    if (line.quantity > MAX_QUANTITY) {
      return `${line.label}: a line holds up to ${MAX_QUANTITY.toLocaleString()} pieces.`
    }
    if (line.unitCost < 0) return `${line.label}: a unit cost cannot be negative.`
    if (hasTooManyDecimals(line.unitCost)) return `${line.label}: a unit cost has at most 2 decimals.`
  }
  return null
}

/** Total of what was typed, for the form's running summary. The server computes its own. */
export function draftTotal(lines: StockReceiptLine[]): number {
  return filledLines(lines).reduce((sum, line) => sum + line.quantity * line.unitCost, 0)
}

export function draftUnits(lines: StockReceiptLine[]): number {
  return filledLines(lines).reduce((sum, line) => sum + line.quantity, 0)
}

export interface PostedGoodsReceipt {
  receipt: ApiGoodsReceipt
  /** Set when a photograph was offered; `stored: false` means it could not be written. */
  photo?: ReceiptPhotoMeta
}

/**
 * Post the delivery. One request, atomic on the server.
 *
 * The idempotency key is taken once so a retry after a lost answer replays the
 * first receipt instead of receiving the goods twice.
 */
export async function postGoodsReceipt(draft: GoodsReceiptDraft): Promise<PostedGoodsReceipt> {
  const problem = validateGoodsReceipt(draft)
  if (problem) throw new Error(problem)

  const receipt = await getApiClient().receiveGoods(
    {
      supplierName: draft.supplierName.trim(),
      supplierInvoiceNumber: draft.supplierInvoiceNumber.trim(),
      invoiceDate: draft.invoiceDate,
      note: draft.note.trim() || undefined,
      lines: filledLines(draft.lines).map((line) => ({
        skuId: line.skuId,
        quantity: Math.floor(line.quantity),
        /* A string with 2 decimals: the API takes either, and sending the text
           keeps a cost like 12.10 out of float rounding on the way out. */
        unitCost: line.unitCost.toFixed(2),
      })),
    },
    crypto.randomUUID(),
  )

  /* Written after the stock, never before: a delivery that is already on the
     shelf must not fail because this browser would not store a picture.
     `stored: false` is recorded so the detail page can say the photo was lost
     rather than quietly showing none. */
  let photo: ReceiptPhotoMeta | undefined
  if (draft.photo) {
    const stored = await putBlob(receiptPhotoKey(receipt.id), draft.photo.blob).catch(() => false)
    photo = {
      width: draft.photo.width,
      height: draft.photo.height,
      bytes: draft.photo.blob.size,
      stored,
    }
  }

  return { receipt, photo }
}

/** `GET /goods-receipts` — summaries, newest first, with the whole count. */
export async function listGoodsReceipts(params: ListGoodsReceiptsParams = {}) {
  return getApiClient().listGoodsReceiptsPage({ limit: 50, ...params })
}

/** `GET /goods-receipts/:id` — one document with its lines. */
export async function getGoodsReceipt(id: string): Promise<ApiGoodsReceipt> {
  return getApiClient().getGoodsReceipt(id)
}

/** The invoice photograph for a server receipt, or null when this device has none. */
export function getGoodsReceiptPhoto(receiptId: string): Promise<Blob | null> {
  return getBlob(receiptPhotoKey(receiptId))
}

export function receiptTotalCost(receipt: ApiGoodsReceiptSummary): number {
  return priceOf(receipt.totalCost)
}

export type { ApiGoodsReceipt, ApiGoodsReceiptSummary }
