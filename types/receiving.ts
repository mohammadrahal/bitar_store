/*
 * Shapes for the parts of the business the backend has no endpoints for yet:
 * the opening count, suppliers and their receipts, branch replenishment
 * requests, and discount approvals. Each one is kept in the local ledger behind
 * its service and marked "Preview" on screen.
 */

/** One posting of counted opening quantities at a location. Posted once. */
export interface OpeningStockPost {
  branchId: string
  postedAt: string
  postedBy: string
  /** How many SKU lines carried a quantity. */
  lines: number
}

export interface Supplier {
  id: string
  name: string
  phone: string
  archived: boolean
  createdAt: string
}

/** Draft has no stock effect; confirming applies it once, and never twice. */
export type ReceiptStatus = 'draft' | 'confirmed' | 'cancelled' | 'corrected'

export interface ReceiptLine {
  variantId: string
  /** Accepted units, which may be fewer than the supplier sent. */
  quantity: number
  unitCost: number
}

export interface Receipt {
  id: string
  number: string
  supplierId: string
  /** Receipts always land at the warehouse (BL-06). */
  branchId: string
  receivedOn: string
  invoiceReference?: string
  /** The chosen file's name. The file itself is not uploaded anywhere yet. */
  attachmentName?: string
  status: ReceiptStatus
  lines: ReceiptLine[]
  /** A correction is its own record, linked to the receipt it fixes. */
  correctsId?: string
  correctionReason?: string
  createdAt: string
  createdBy: string
  confirmedAt?: string
  confirmedBy?: string
}

/** A receipt with the names a table needs. */
export interface ReceiptRow extends Receipt {
  supplierName: string
  branchName: string
  units: number
  total: number
}

/** BL-010 section 5: a request ends Completed, Cancelled or Rejected. */
export type ReplenishmentStatus = 'requested' | 'approved' | 'rejected' | 'completed' | 'cancelled'

export interface ReplenishmentLine {
  variantId: string
  requested: number
  /** What the reviewer allowed; zero until they decide. */
  approved: number
}

export interface ReplenishmentRequest {
  id: string
  number: string
  /** The branch asking for stock. */
  branchId: string
  reason: string
  status: ReplenishmentStatus
  lines: ReplenishmentLine[]
  requestedBy: string
  requestedAt: string
  reviewedBy?: string
  reviewedAt?: string
  /** Required when rejecting. */
  decisionReason?: string
}

export interface ReplenishmentRequestRow extends ReplenishmentRequest {
  branchName: string
  requestedUnits: number
  approvedUnits: number
}

export type DiscountRequestStatus = 'pending' | 'approved' | 'rejected'

/** An employee asking for money off, which only an owner role may grant. */
export interface DiscountRequest {
  id: string
  branchId: string
  variantId: string
  /** Percentage off the line, 0 to 100. */
  percent: number
  reason: string
  status: DiscountRequestStatus
  requestedBy: string
  requestedAt: string
  decidedBy?: string
  decidedAt?: string
}
