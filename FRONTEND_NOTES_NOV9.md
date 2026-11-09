# For Mohamad: what changed in the API (9 Nov)

All additive: nothing you use today is removed or renamed.

## Invoices of a transfer (your blocker 1.1)
- `GET /transfers/:id` and `GET /transfers` now have **`supplyInvoice`**: `{ id, reference, status, total } | null` (the live, not void, supply invoice). `reference` is `null` while it is a draft.
- `GET /invoices?transferId=<id>` and `GET /invoices?saleId=<id>` return exactly that invoice (a list of 0 or 1; add `status=void` to see voided ones). `search` already matched the transfer reference and the sale reference, and still does.
- **Dispatching from the warehouse now raises the draft supply invoice by itself**, with the quantities really sent. The answer of the dispatch already has `supplyInvoice`.
- **Do not gate "Confirm for sale" / receiving on the invoice.** In BL-03 the linked invoice is a draft from the start and is finalized AFTER the movement is reconciled. The receiving branch never waits for it.

## Prices of a supply invoice
- Lines have **`priceSource`**: `cost` (average purchase cost of the warehouse), `manual` (typed in the draft), `missing` (no cost known: price is 0.00), `sale` (the invoice of a sale), `null` (an old invoice).
- Show a warning on `missing` lines. `POST /invoices/:id/finalize` answers **409** while one is left; set the price with `PATCH /invoices/:id` `{ lines: [{ skuId, unitPrice }] }` (the line becomes `manual`).
- The supply invoice is priced at COST, not at the selling price of the shop.

## Receiving a transfer (your blocker 1.2)
- `POST /transfers/:id/receive` takes an optional **`note`** (1 to 500 characters). Remove the `sessionStorage` note.
- The transfer has **`receipts[]`**: `{ id, at, by: { id, name }, note, lines: [{ skuId, accepted, damaged }] }`, oldest first: print the receiving report from it.
- Every line has `received`, `accepted`, `damaged`, `lost`, `onTheRoad`; `totals` has the same.

## Suppliers
- `GET /suppliers?search=&active=&limit=&offset=` (count in `X-Total-Count`), `POST /suppliers { name, phone, note? }`, `GET /suppliers/:id`, `PATCH /suppliers/:id { name?, phone?, note?, isActive? }`. Admin or manager only.
- `POST /goods-receipts` takes **`supplierId`** (pick from the list) or `supplierName` (still works). `supplierInvoiceNumber` is **optional** now.
- A receipt has `supplier: { id, phone }`, `supplierName` (the name on the day), `supplierInvoiceNumber` (can be `null`).
- `GET /goods-receipts?supplierId=`.

## Revenue
- `GET /reports/sales-summary?from=&to=&branchId?` returns `totals` (all branches in scope together), **`byBranch`** (one entry per branch, also the ones with no sales), **`byDay`** (all branches together) and the old `rows`. Each has `revenue`, `inStore`, `socialMedia` (online), `cash`, `whish`, `discounts`.

## Please do NOT build these (they contradict the approved BL-04)
- Credit notes / store credit, the a/b/c/d grades with retention percentages, the credit bonus: "customer credit is outside this MVP". A return refunds **the amount actually paid for the returned units, after discounts**, by cash or Whish.
- Returns follow: receive into custody, manager approves, goods go to hold, release is separate, the refund is pending then paid, and a return can happen at any branch (linked to the original sale). An exchange is a linked return plus a new sale. The API for this is not built yet.
