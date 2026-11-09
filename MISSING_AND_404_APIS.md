# Missing routes and 404-degraded APIs

Frontend inventory of **what is not on the server**, **what is probed as 404 on older backends**, and **what the UI does instead**.

**Last aligned with:** the 9 Nov notes ([`FRONTEND_NOTES_NOV9.md`](FRONTEND_NOTES_NOV9.md), [`FRONTEND_NOTES_CASH_SETTINGS.md`](FRONTEND_NOTES_CASH_SETTINGS.md)), `lib/api/capabilities.ts`, and the services under `services/`.

---

## Wired on 9 Nov

Everything in this section used to be on the "no API" or "workaround" lists below and is now a real call.

| Area | Routes | Front-end |
|------|--------|-----------|
| **Store settings** | `GET /settings`, `PUT /settings` | `lib/api/settings.api.ts`, `services/settings.service.ts`, `hooks/use-settings.ts`, Admin → Store settings |
| **Cash drawer** | `GET /cash-sessions/current`, `GET/POST /cash-sessions`, `GET /cash-sessions/:id`, `POST …/movements`, `…/handover`, `…/close`, `…/corrections`, `…/review` | `lib/api/cash-sessions.api.ts`, `services/cash-sessions.service.ts`, `hooks/use-cash-sessions.ts`, and the screens under `components/cash/` at `/cash` and `/cash/:sessionId` |
| **Suppliers** | `GET /suppliers`, `POST /suppliers`, `GET /suppliers/:id`, `PATCH /suppliers/:id` | `lib/api/suppliers.api.ts`, `services/suppliers.service.ts`, `hooks/use-suppliers.ts`, `components/stock-receipts/supplier-picker.tsx` |
| **Invoice of a transfer / sale** | `GET /invoices?transferId=`, `GET /invoices?saleId=`, `supplyInvoice` on `GET /transfers[/:id]` | `findSupplyInvoiceForTransfer`, `findB2cInvoiceForSale`, `hooks/use-transfer-invoice.ts` |
| **Supply invoice price source** | `priceSource` on invoice lines | `linesMissingPrice`, `priceSourceLabel`, invoice detail warns and blocks finalize |
| **Receiving notes** | `note` on `POST /transfers/:id/receive`, `receipts[]` on the transfer | `transfer-receive-panel.tsx` sends it; the report prints `receipts[]` |
| **Revenue by branch / by day** | `byBranch`, `byDay` on `GET /reports/sales-summary` | `analytics.service.ts`, `dashboard-trend.service.ts` |
| **Supplier on a goods receipt** | `supplierId` in, `supplier` out, `GET /goods-receipts?supplierId=` | `goods-receipts.service.ts` |

### Behaviour corrected at the same time

- **Receiving no longer waits for the invoice.** "Confirm for sale" used to require a *finalized* supply invoice and three characters of local note. In BL-03 the invoice is a draft from dispatch and is finalized **after** the movement is reconciled, so that gate stranded good stock at the branch. The invoice state is now shown as information. `transfer-detail-view.tsx`, `transfer-receiving-report-view.tsx`.
- **Revenue per branch is no longer multiplied by the days in the range.** `summary.rows` is a day × branch grid, so a branch that sold on five days was charted five times. `byBranch` replaces it, and the fallback folds `rows` by branch.
- **Cash permission keys renamed** to the four the server actually grants: `cash.open`, `cash.accept`, `cash.close`, `cash.move`. They were `cash.handover` and `cash.adjust` in `lib/permission-keys.ts`, which no server ever sent.
- **A goods receipt no longer needs an invoice number.** It is optional on the server, so the form stopped requiring one and the screens print "None given" rather than an empty cell.

### The cash drawer, on screen

`/cash` is one page per branch with two tabs, because the whole of a shift's cash handling interleaves and each action has to show the expected cash it is measured against:

| Where | What it does |
|-------|--------------|
| `/cash?section=drawer` | Open the drawer, record cash in/out, take it over, close it. Each panel checks its own key (`cash.open`, `cash.move`, `cash.accept`, `cash.close`) and explains itself when the key is missing instead of disappearing |
| `/cash?section=shifts` | Every session, opening on **To review** — the only reason a manager comes to the list |
| `/cash/:sessionId` | One shift read back: totals, who sold what, movements, handovers, and `closing` beside `effective` so a correction never erases the count it corrected. A manager corrects and signs off from here |
| `/sales/new` | `CashSessionGate`: when `requireOpenCashSession` is on and no drawer is open, the till says so **before** the first scan and opens the drawer inline, rather than letting `POST /sales` 409 away a finished sale. The complete-sale button is held while it is closed |

Route access is in `ROUTE_PERMISSIONS` (`lib/permissions.ts`): any one of the four keys gets in.

---

## How 404 probing works

After sign-in, the app probes optional routes once per token. If the server answers **404** with body `Resource not found`, the feature is marked **missing** and cached in `sessionStorage` (`bitar:api-capabilities:v1`).

| Probe flag | Route(s) tested | UI when missing |
|------------|-----------------|-----------------|
| `warehouse` | `GET /warehouse` | Warehouse id from branch list / replenishment heuristics (`warehouse-link.service.ts`) |
| `categories` | `GET /categories` | Categories admin shows empty state + hint (`categories-view.tsx`) |
| `permissions` | `GET /permissions`, user permission routes | Custom keys not loaded/saved via API; falls back to `lib/permission-keys.ts` + **local** grants (`user-access.ts`, `users.service.ts`) |
| `branchAccess` | `GET /users/:id/branch-access` | Manager branch pickers hidden or **local** mirror only (`user-form.tsx`, `use-users.ts`) |
| `salesHistory` | `GET /sales/history` | Sales history page blocked; dashboard recent sales uses **today only** via `GET /sales` (`recent-sales.service.ts`, `sales-history-view.tsx`) |

**User-facing hint text** (from `apiFeatureHint`):

- **warehouse:** `GET /warehouse`
- **categories:** `GET /categories`
- **permissions:** `GET /permissions` and `PUT /users/:id/permissions`
- **branchAccess:** `GET /users/:id/branch-access`
- **salesHistory:** `GET /sales/history` (must be registered **before** `GET /sales/:id` on the server)

The three routes added on 9 Nov are **not probed**, because they degrade on their own terms instead:

| Route | On an older server | Why not a probe |
|-------|--------------------|-----------------|
| `GET /settings` | 404 → cached settings, then the documented defaults (`returnPeriodDays: 14`, `defaultReservationDays: 3`, `requireOpenCashSession: false`, no rate) | The till must open either way, and one 404 per five minutes costs less than a probe on every sign-in |
| `GET /cash-sessions/current` | 404 → `null`, read as "no drawer open" | `requireOpenCashSession` cannot be on where the resource does not exist, so `null` is the correct answer |
| `GET /suppliers` | The error surfaces in the picker | The picker is the only screen that asks, and `supplierName` is still accepted by `POST /goods-receipts` |

### Server bugs (not “missing feature”)

| Route | Issue | UI behavior |
|-------|--------|-------------|
| `GET /permissions` | May return **500** on some deployments | Treated as unusable; local permission keys used (`ARCHITECTURE.md` §7) |
| `GET /sales/history` | Registered **after** `GET /sales/:id` | Path matches sale id `"history"` → broken history; UI falls back to today’s sales |

---

## No API yet — data stays on the device

These are **not** covered by capability probes. The UI intentionally uses **localStorage**, **sessionStorage**, or **IndexedDB** until a backend exists.

| Feature | Storage key / mechanism | What the server does today | Main code |
|---------|------------------------|----------------------------|-----------|
| **Catalog unit cost (COGS)** | `localStorage` `bitar:catalog-costs:v1` | SKUs have `standardPrice` only, no cost field | `catalog-costs.service.ts`, product forms, receipt lines |
| **Pending till sales** | `localStorage` `bitar:pending-sales:v1` | Real sales use `POST /sales`; pending cart is pre-submit only | `pending-sales.service.ts`, `b2c-retail-sales-panel.tsx` |
| **Legacy stock receipts** | `localStorage` `bitar:stock-receipts:v1` (+ blobs) | New deliveries use `POST /goods-receipts`; old paperwork is read-only legacy | `stock-receipts.service.ts`, legacy receipt views |
| **Goods receipt invoice photo** | **IndexedDB** `bitar-files` | `POST /goods-receipts` has no image field | `blob-store.ts`, `goods-receipts.service.ts` |
| **Per-user / per-location permission overlay** | `localStorage` `bitar:user-access:v1` | `GET /auth/me` is flat; full granular store not always available | `lib/user-access.ts`, `users.service.ts` |
| **Nav section open/closed** | `localStorage` `bitar:nav-open-sections:v1` | UI preference only | `sidebar-nav.tsx` |
| **Theme / user preferences** | `localStorage` `bitar:user-preferences:v1` | UI preference only | `user-preferences.service.ts`, `app/layout.tsx` |

**Cache, not truth:** `bitar:settings:v1` mirrors the last `GET /settings` answer so the **synchronous** receipt printer can read the exchange rate without awaiting a request (`cachedExchangeRate()`). It is written only from a server answer and is never the source of a saved value.

**Removed (no longer used by the app):**

- Wholesale invoices in `bitar:wholesale-invoices:v1`. Opening the invoices ledger clears this key (`lib/clear-legacy-wholesale-invoices.ts`). Fiscal invoices use **`GET/POST /invoices`** only.
- The device-local exchange rate in `bitar:exchange-rate:v1`, and its local change history. The rate is `GET/PUT /settings`; who changed it is in `GET /audit-events`. The dead key is purged (`lib/purge-local-mock-data.ts`, marker `v3`).
- The transfer receiving note in `sessionStorage` `transfer-report-note-<id>`. It goes with `POST /transfers/:id/receive` and comes back on `receipts[]`.

---

## API gaps — UI workaround (server may be “up” but incomplete)

| Gap | Expected API | Current workaround |
|-----|--------------|-------------------|
| **Create arbitrary wholesale invoice** | No body besides `{ transferId }` \| `{ saleId, … }` | “Create invoice” is a gateway → **New sale** or **Transfers** (`create-invoice-gateway.tsx`) |
| **Global search: sale by reference** | Resolver or searchable `GET /sales/history` | Search is catalog-only (`global-search.service.ts`) |
| **Top SKUs per branch** | Branch breakdown on `GET /reports/top-skus` | Scoped totals only (`analytics.service.ts`). `sales-summary` now has `byBranch`, `top-skus` does not |
| **SKU / style cost** | A cost field or a costs endpoint | `localStorage` per device (`catalog-costs.service.ts`) |
| **Receipt document number** | Server-issued sequence | Legacy local `nextReceiptNo()` for old receipts |
| **Upload / attach files** | Generic upload or receipt attachment | Photos in IndexedDB only |
| **Returns** | `POST /returns` and the custody → approval → hold → release → refund chain | Screen stub only. Not built on the server; see the BL-04 note below |

### Returns: what not to build

Per the 9 Nov notes, **customer credit is outside this MVP**. Do not build credit notes, store credit, the a/b/c/d condition grades with retention percentages, or the credit bonus. A return refunds **the amount actually paid for the returned units, after discounts**, by cash or Whish (`lib/return-grades.ts` already reflects this).

The approved flow, for when the API lands: receive into custody → manager approves → goods go to hold → release is a separate step → the refund is pending, then paid. A return can happen at any branch, linked to the original sale. An exchange is a linked return plus a new sale.

---

## Hybrid: API + local cache (not missing APIs)

| Piece | Role |
|-------|------|
| `mocks/store.ts` + `mocks/mirror.ts` | In-memory/**localStorage** mirror of branches, products, SKUs after API sync (pickers, search, labels) |
| React Query | HTTP response cache |
| Session token | `sessionStorage` (`store/user-store.ts`) |
| API capability snapshot | `sessionStorage` per token |
| Store settings | `localStorage` cache of the last server answer, for the synchronous printer |

---

## Invoices and sales (API map)

| Flow | API |
|------|-----|
| Till sale | `POST /sales` (409 when `requireOpenCashSession` is on and no drawer is open) |
| Retail fiscal invoice | `POST /invoices` `{ saleId, customerName?, customerPhone?, note? }` |
| Supply invoice | Raised by dispatch; else `POST /invoices` `{ transferId, note? }` → `PATCH` → `POST …/finalize` |
| Invoice of one transfer / sale | `GET /invoices?transferId=` · `GET /invoices?saleId=` |
| Ledger / detail / PDF | `GET /invoices`, `GET /invoices/:id`, `GET /invoices/:id/pdf`, `POST …/void` |
| Pending cart (not an invoice) | **localStorage** until `POST /sales` |

---

## Backend checklist (404 / missing → enable in UI)

1. Register **`GET /sales/history`** before **`GET /sales/:id`**.
2. Expose **`GET /warehouse`**, **`GET /categories`**, **`GET /permissions`**, **`GET/PUT /users/:id/permissions`**, **`GET/PUT /users/:id/branch-access`** (handoff v0.9+).
3. Fix **`GET /permissions`** if it returns 500.
4. Add **SKU/style cost** fields or a dedicated costs endpoint.
5. Add a **branch breakdown to `GET /reports/top-skus`**, as `sales-summary` now has.
6. Build **returns** to the approved BL-04 chain above.
7. Optional: **pending sale drafts** on server, **receipt image** upload, **sale reference search**.

---

## Related docs

| File | Purpose |
|------|---------|
| [`FRONTEND_NOTES_NOV9.md`](FRONTEND_NOTES_NOV9.md) | The 9 Nov API changes: transfers, invoices, suppliers, revenue |
| [`FRONTEND_NOTES_CASH_SETTINGS.md`](FRONTEND_NOTES_CASH_SETTINGS.md) | Settings and cash sessions |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | §7 wired routes, §8 hidden widgets, §9 local gaps |

When the backend adds a route, update probes in `lib/api/capabilities.ts` only if the detection path changes; otherwise deploying a new API version is enough for the next login probe to mark the feature **available**.
