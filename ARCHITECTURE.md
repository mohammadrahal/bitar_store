# Bitar Fashion — Architecture and API Status

This is the living picture of the frontend: what it does, how it is built, which backend APIs it already calls, and what still runs locally because the backend has no matching endpoints.

The original plan in `CLAUDE.md` was a mock-only dashboard. The app has since grown into a signed-in operations UI that talks to the Bitar Store API for auth, users, branches, catalog, stock, opening stock and retail sales. Transfers, documents, stock control, suppliers, receipts, replenishment and discount approvals still live in a local ledger and are marked **Preview** on screen.

The current HTTP contract is `bitar-frontend-plan.md`. `AGENTS.md` is an older slice of that contract (auth, users, branches only) and should not be treated as complete.

---

## 1. What the product is

Bitar is a multi-branch fashion inventory app. Staff sign in, work at the locations they are assigned to, and manage:

- The catalog (styles and size/color SKUs) for men, women and kids — categories come from the data, never hardcoded
- On-hand stock at each location
- Retail (B2C) sales at the till, paid in cash, Whish or both
- Supplier receipts into the warehouse, counts, holds, transfers, replenishment requests and documents (local only for now)

There is no public storefront and no public registration. An account is created for you.

---

## 2. Stack

| Layer | Choice |
|---|---|
| App | Next.js App Router, TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui, lucide-react |
| Server-like data | TanStack Query |
| Client / UI state | Zustand (`user-store`, `ui-store`) |
| Forms | react-hook-form + zod |
| HTTP | `fetch` in `lib/api/` — never called from components |
| Brand | Playfair Display for titles, Inter everywhere else, brass accent `#B08D57` |

Base URL comes from `NEXT_PUBLIC_API_URL`, falling back to `http://localhost:3000`. The Next app typically runs on `3001` so it matches the backend CORS default.

There is no lint config in this repo, so `npx tsc --noEmit -p tsconfig.json` is the check that gates a change.

---

## 3. Architecture

### Data flow (the only allowed path)

```
Component  →  hook (TanStack Query / Zustand)  →  service  →  API client and/or local store
```

Components never import `lib/api/*` or `mocks/*`. Where a screen needed something from the HTTP layer it goes through a neutral module instead: `lib/errors.ts` answers "was this a 401, a 409, what did the server say?", and a service re-exports the domain type (`Sale` from `services/sales.service.ts`). When the real API later covers a mock feature, only the service (and sometimes a mapper) should change.

### Two backends, one UI

| Source of truth | What it owns |
|---|---|
| **Bitar Store HTTP API** | Session, users, branches, catalog (styles/SKUs/barcodes/prices), sellable/non-sellable/in-transit stock, opening stock, completed POS sales |
| **Local ledger** (`localStorage` key `bitar-fashion:catalog-db:v10`) | A mirror of catalog + branches for pickers, plus the operations the API does not have yet: transfers, documents, holds, counts, movements, suppliers, receipts, replenishment requests, discount requests, opening-stock postings, colors, warehouse flag, extra product details, low-stock thresholds, idempotency replays |

The local store is **not** seed data for products. Catalog and branch lists are pulled from the API and **mirrored** so transfers, documents and pickers can resolve SKU names without calling the server on every keystroke.

```
API catalog / branches / stock / sales
        │
        ▼
  services (map + mirror)
        │
        ├── TanStack Query cache  →  screens
        └── local store           →  transfers, documents, counts, holds, receipts, replenishment
```

### Auth and session

1. `POST /auth/login` returns a bearer token.
2. `GET /auth/me` loads the user, permission keys, assigned `branchIds` and `canViewCosts`.
3. Token + user sit in Zustand, persisted to **sessionStorage** (`bitar-fashion:session:v4`). Closing the tab ends the session. There is no logout endpoint; dropping the token is logout.
4. A 401 on any authenticated request signs the user out and sends them to `/login`.
5. `<AuthGate>` blocks the dashboard. `<ActiveLocationGate>` makes an employee with several locations choose one. `<BranchGuard>` keeps everyone on pages they may open.

### Permissions

`lib/permission-keys.ts` names every key once, so the backend can use the same strings. `lib/permissions.ts` is the only place a role is checked, through one function:

```ts
can(user, permission, locationId?)
```

`<Can permission="..." locationId="...">` wraps it for components, and `usePermission().can(...)` fills in the active location so a screen asks "may this user do it *here*?". Hiding a control is for usability; the backend is the real check.

#### The three roles

| Role | Who | Access |
|---|---|---|
| `super_admin` | One of the four owners | Everything, at every location. No permission checks. |
| `manager` | The other three owners | Every business operation at every location, except the keys below. |
| `employee` | Staff | Only the keys granted to them, only at the locations they are assigned. |

A manager is **not** scoped to a branch: managers see and operate every location, like the super admin.

**Only the super admin may:**

- `settings.manage` — system settings, including creating, renaming and deactivating locations
- `users.deactivate` — deactivating any account
- `users.role.change` — promoting to Manager, demoting a Manager, changing any role

Managers **can** create employee accounts, assign locations, grant and remove employee keys, start password resets, and do every business operation (approve, confirm dispatch and receipt, confirm supplier receipts, approve discounts and refunds, holds, counts, corrections, disposal) at every location.

The API still calls the owner role `admin`. That word is translated in exactly one place — `toRole`/`toApiRole` in `services/session.service.ts` — and appears nowhere else in the UI.

#### Employee keys

Granted **per location**, except the catalog keys, which are platform-wide:

```
sales.create            sales.view_own          sales.view_branch
discounts.request       sales.cancel
returns.process         refunds.issue
catalog.create          catalog.edit            (platform-wide)
receipts.enter          costs.view
movements.request       movements.prepare_dispatch
stock.view              counts.enter
cash.open               cash.handover           cash.close    cash.adjust
reports.view_branch     reports.export
```

A new employee is created with `stock.view`, `sales.create` and `sales.view_own` at each assigned location.

Employees can never change permissions, apply a discount without approval, confirm dispatch or receipt, confirm a supplier receipt, apply a stock correction, release a hold, or approve a refund. Those are a separate manager tier in `lib/permission-keys.ts` (`MANAGER_PERMISSIONS`) that an employee cannot hold at all. `catalog.view` is baseline: any authenticated caller may read the catalog, which is what the API allows.

`canViewCosts` is true for `super_admin` and `manager`; for an employee it needs `costs.view`, or the API's own `canViewCosts` flag.

#### Locations and the active location

- An employee can be assigned **several** locations. Each assignment is **full access** or **view-only stock**.
- With more than one, they pick an **active location** before working. It shows in the header and every action is recorded against it.
- A view-only location shows stock and nothing else: it is left out of the pickers on screens that record something, and `<ViewOnlyNotice>` says why.
- `<BranchGuard>`: super admins and managers open every location and the combined overview; employees only their own.

The API returns a flat `branchIds` and a flat `permissions`, so the access level per location and the per-location keys are kept in this browser (`lib/user-access.ts`) until the backend can store them. The Users screen is marked Preview for that reason.

### Query keys

Every cache key lives in `lib/query-keys.ts`. Mutations invalidate the related family (`queryKeys.stock.all`, `queryKeys.receipts.all`, …) instead of guessing strings.

### Feature flags

`lib/features.ts` holds what is outside the MVP, all off:

- `b2bSales` — `/sales/b2b` and wholesale documents (BL-04 excludes warehouse business sales from the MVP). The route and its sidebar link are hidden.
- `replenishmentSuggestions` — the suggested-quantity logic (BL-05 marks it future). The manual request flow stays on.

Nothing is deleted; flipping a value brings the screen back.

### Forms and errors

Zod schemas in `schemas/` validate forms. API errors (`400`, `409`, …) surface as the server `message` next to the field or as a toast. `401` clears the session. `403` is an access-denied state.

---

## 4. Folder map

```
app/
  login/page.tsx                         sign-in
  (dashboard)/layout.tsx                 shell + AuthGate + ActiveLocationGate + BranchGuard
    dashboard/                           combined overview (owner roles)
    branches/  branches/[id]/            location list and one location
    products/  products/new  products/[id]
    inventory/  inventory/[variantId]
    opening-stock/                       counted opening quantities, posted once
    receiving/                           suppliers and supplier receipts
    sales/new  sales/b2c  sales/b2b  sales/[id]
    invoices/  invoices/[id]
    transfers/  transfers/new  transfers/[id]
    stock-control/
    replenishment/
    users/

components/     feature UI (never talks to fetch or mocks)
hooks/          TanStack Query wrappers
services/       business logic; the only layer that may call the API or the local store
lib/api/        typed HTTP client, mappers, error type
lib/            permissions, permission keys, features, query keys, errors, money/SKU/barcode helpers
mocks/          local ledger + catalog mirror
store/          Zustand session and UI
schemas/        zod
types/          app shapes (products, operations, receiving, …)
providers/      QueryClient + toasters
```

---

## 5. What the app does today (by screen)

**Preview** means the screen runs on this browser's local ledger: the workflow is real, the numbers are not shared with another device, and nothing there moves server stock.

| Route | What it does | Data source |
|---|---|---|
| `/login` | Email/password sign-in, then `/auth/me` | API |
| `/dashboard` | Stat cards, low-stock list, sales charts. Owner roles only | Stock: API. Charts: `GET /sales` |
| `/branches/:id` | The same overview scoped to one location | API |
| `/branches` | List, create (`code` + `name`), rename, activate/deactivate, mark the warehouse. Create, rename and deactivate need `settings.manage`. Blocks deactivate while units remain | API (+ warehouse flag local) |
| `/products` | Search, category, active/archived. Cost column needs `canViewCosts` | API catalog, mirrored |
| `/products/new` | Style + variant grid, auto SKU, barcode, per-variant price. **No opening quantity and no cost**: creating a model never places stock (BL-01) | API styles/SKUs/barcodes |
| `/products/:id` | Edit name/category/price, add variants, barcodes, price history, archive. Archiving is refused while units exist anywhere (BL-01 P11) | API + `GET /stock` |
| `/inventory` | Five-balance table. On hand, non-sellable and in transit come from `GET /stock`; reserved and on hold read "not available yet" | API (movement history below is Preview) |
| `/inventory/:variantId` | Per-location balances from `GET /stock`, plus local movement history | API + **Preview** history |
| `/opening-stock` | Pick a location, enter counted quantities, an owner role posts once (BL-010 §3) | `POST /stock/opening`; the posting record is local |
| `/receiving` | Suppliers (name, phone) and supplier receipts into the warehouse: draft → confirmed, corrections as linked records | **Preview** |
| `/sales/new` | Till: pick model → variant → qty; cash, Whish or both with tendered and change; per-line discount, applied by an owner role or requested by an employee | API `POST /sales` + `GET /stock`. Discount requests **Preview** |
| `/sales/b2c` | Retail sales for a location and business date, plus the discount approvals waiting | API `GET /sales`; approvals **Preview** |
| `/sales/:id` | One completed POS sale | API `GET /sales/:id` |
| `/sales/b2b` | Wholesale documents. **Hidden behind the `b2bSales` flag** | **Preview** |
| `/invoices` | Purchases, sales, returns, adjustments | **Preview** |
| `/transfers` | Request → approve (reserve) → dispatch → receive. Employees may request and prepare; only an owner role confirms dispatch or arrival (BL-03) | **Preview** |
| `/stock-control` | Holds, physical count, disposal. An employee enters a count; an owner role applies it | **Preview** |
| `/replenishment` | A location requests stock, an owner role approves all, part, or rejects with a reason. Suggestions are behind the `replenishmentSuggestions` flag | **Preview** |
| `/users` | Create an account, set a password, assign several locations with full or view-only access, edit employee keys, deactivate. **No delete** | API + **Preview** local assignments and keys |

Shared shell: sidebar (links filtered by permission and by flag), header location switcher or branch filter, theme toggle, sign out, offline banner.

---

## 6. API client

`lib/api/create-api.ts` builds one authenticated client:

```
createApi(token)
  ├── auth:     loginWithApi, fetchMe, fetchHealth
  ├── users:    list / create / update / password / delete / grant+revoke branch
  ├── branches: list / create / PATCH
  ├── catalog:  styles, SKUs, lookup, price, price-history, barcodes
  ├── stock:    list, opening
  └── sales:    create, list, get
```

`getApiClient()` reads the session token. `send()` never puts the token in a URL or a log, and sends `cache: 'no-store'` so the browser does not answer with a 304 this client cannot read. Sales and opening stock send an `Idempotency-Key` header.

`deleteUser` is **deliberately unused**: accounts are deactivated, never removed, so history keeps pointing at whoever rang up a sale. The method stays in `lib/api/users.api.ts` for the day the backend turns it into a soft delete.

---

## 7. Backend APIs — wired vs not

Legend: **Used** = a screen actually calls it. **Client only** = typed in `lib/api/` but no screen uses it. **Missing on backend** = the UI still keeps it locally.

### 7.1 Wired and used

| Method | Path | Used by |
|---|---|---|
| `POST` | `/auth/login` | Login |
| `GET` | `/auth/me` | Login and session restore |
| `GET` | `/users` | Users page |
| `POST` | `/users` | Create account |
| `PATCH` | `/users/:id` | Edit, change role, activate/deactivate |
| `PUT` | `/users/:id/password` | Initial and reset password |
| `PUT` | `/users/:id/branches/:branchId` | Assign a location |
| `DELETE` | `/users/:id/branches/:branchId` | Remove an assignment |
| `GET` | `/branches` | Lists, pickers, mirroring |
| `POST` | `/branches` | Create (`code`, `name`) |
| `PATCH` | `/branches/:id` | Rename, activate/deactivate |
| `GET` | `/styles` | Product list, catalog sync |
| `POST` | `/styles` | New product |
| `GET` | `/styles/:id` | Product detail |
| `PATCH` | `/styles/:id` | Name, category, archive (`isActive`) |
| `GET` | `/skus` | Catalog sync |
| `POST` | `/skus` | New variants |
| `GET` | `/skus/lookup?code=` | Scanner / exact SKU search |
| `GET` | `/skus/:id` | Barcodes on the product page |
| `PATCH` | `/skus/:id` | Activate / deactivate a SKU |
| `PUT` | `/skus/:id/price` | Model or variant price change |
| `GET` | `/skus/:id/price-history` | Price history dialog |
| `POST` | `/skus/:id/barcodes` | Add / auto-mint EAN-13 (in-store range 200–299) |
| `DELETE` | `/barcodes/:id` | Remove barcode |
| `GET` | `/stock?branchId=` | Dashboard, inventory, branch stock, archive checks, till availability |
| `POST` | `/stock/opening` | Opening-stock screen |
| `POST` | `/sales` | Till: `in_store`, cash/Whish/split, tendered, per-line percent discount |
| `GET` | `/sales?branchId=` | B2C list and the dashboard charts |
| `GET` | `/sales/:id` | Sale detail |

### 7.2 Exist on the backend, not used by the UI yet

| Method | Path | Why unused |
|---|---|---|
| `GET` | `/health` | Client has `fetchHealth`. No status screen. |
| Sale `channel: "social_media"` + `socialPlatform` | `POST /sales` | The till is in-store only; social selling is not in the MVP. |
| Line discount `type: "override"` | `POST /sales` | The till takes a percentage, which is what BL-04 describes. |
| `DELETE` | `/users/:id` | Accounts are deactivated, never deleted (see section 6). |

### 7.3 Frontend features with no backend API

These screens work, but only on this browser's local ledger, and they do **not** move server stock.

| Feature | Local service | Backend today |
|---|---|---|
| Transfers (request, approve/reserve, dispatch, receive, discrepancy) | `transfers.service.ts` | No transfer endpoints |
| Documents: purchase, purchase return, sale return, adjustment | `invoices.service.ts` | No document endpoints |
| B2B wholesale sales | Same document ledger | `POST /sales` is retail-shaped |
| Suppliers | `suppliers.service.ts` | No supplier endpoints |
| Supplier receipts, confirmation and corrections | `receipts.service.ts` | No goods-receipt endpoint; `POST /stock/opening` only accepts a SKU with no movement yet |
| Cost price | the newest confirmed receipt line | API has sell price only |
| Holds / release | `holds.service.ts` | No hold endpoints |
| Physical count and count reports | `counts.service.ts` | No count endpoints |
| Disposal / write-off | stock-control | No adjustment-out endpoint |
| Replenishment requests and decisions | `replenishment-requests.service.ts` | No endpoints |
| Replenishment suggestions | `replenishment.service.ts` | Derived from local thresholds (flag off) |
| Discount requests and approvals | `discount-requests.service.ts` | `POST /sales` records an approver but has no "ask" |
| Reserved and on-hold balances | — | `GET /stock` has sellable / nonSellable / inTransit only |
| Movement history per variant | `inventory.service.ts` | No movement endpoint |
| Opening-stock postings per location | `opening-stock.service.ts` | `POST /stock/opening` succeeds, but nothing records that a location has been opened |
| Which location is the warehouse | `locations.service.ts` | Branch has no type field |
| Color palette | `attributes.service.ts` | Color is a free string on the SKU |
| Extra product details (season, brand, material, description) | local fields on the style mirror | API has code, name, category, isActive |
| Low-stock threshold per variant × location | local `stock.lowStockAt` | API has no threshold |
| A user's locations, access level and per-location keys | `lib/user-access.ts` | No `GET /users/:id/branches`, no grants |
| Sales over a period | — | `GET /sales` answers one business date at a time |

### 7.4 Data the API returns that the UI only partly shows

| API field | UI treatment |
|---|---|
| Branch `code` | Shown; also copied into `location` because the API has no address/phone |
| Stock `nonSellable` | Its own column, and what drives the "non-sellable" status |
| Stock `inTransit` | Shown on inventory and the dashboard; transfer in-transit is still local |
| Sale `soldBy`, `businessDate`, `reference` | Shown on the B2C list and detail, and on the charts |
| `permissions[]` from `/auth/me` | Read as the employee's keys, together with the per-location grants |

---

## 8. Known split (important)

Server stock is now the only stock number on screen. `/inventory`, the branch pages, the dashboard cards and the till all read `GET /stock`, so they cannot disagree about the same variant at the same location.

What is still local is **everything that would move that number**: a transfer, a confirmed supplier receipt, a count, a hold, a write-off and a local document all record the workflow without changing server stock. Only `POST /sales` and `POST /stock/opening` do. So:

- Units get into the system through the opening count, and leave through a till sale.
- A confirmed receipt is a record of what arrived, not an increase — which is why the confirm dialog says so.
- Reserved and on hold are shown as "not available yet" rather than filled in from the local ledger.

Treat the Preview screens as a working prototype of the workflow, not as the live warehouse.

---

## 9. What still needs to exist on the backend

In the order that would collapse the local ledger:

1. **Location type** — a `type` or `isWarehouse` on a branch, so `locations.service.ts` can stop deciding which location is the warehouse from its name. First, because receipts, replenishment and B2B all need to know.
2. **Transfers** — create request, approve/reserve, prepare dispatch, confirm dispatch, confirm receipt, cancel, discrepancy; with stock reservation and in-transit on the server.
3. **Suppliers and receipts** — supplier CRUD; a goods receipt with lines of accepted quantity and unit cost, `draft → confirmed` under an idempotency key so confirming twice cannot add stock twice, cancellation, and corrections as linked records. Confirming must move stock, which `POST /stock/opening` cannot do.
4. **Five-balance stock read** — on hand, reserved, on hold, available and in transit per variant and location, plus a low-stock threshold (or a policy endpoint), so `/inventory` can stop saying "not available yet".
5. **User locations and per-location grants** — `GET /users/:id/branches` with an access level (full or view-only), and the permission keys a user holds at each one. Until then `lib/user-access.ts` remembers them in one browser only.
6. **Discount requests** — an employee asks, an owner role approves or rejects, and the sale carries the approval. The API already records the approver on a line discount; it has no record of the ask.
7. **User deactivation as a soft delete** — `DELETE /users/:id` should deactivate and keep history rather than remove the row, so the client method can finally be used.
8. **Analytics** — sales by location and top SKUs over a date range from posted sales. `GET /sales` answers one business date per branch, so the dashboard covers today only.
9. **Documents** — purchase, purchase return, wholesale sale, sale return, stock adjustment; draft → post → void with idempotency.
10. **Stock control** — holds, counts and write-offs (or fold them into adjustments).
11. **Catalog extras** — optional product details and a shared color list.
12. **Branch extras** — address and phone.

Two notes for the backend rather than endpoints:

- **Barcodes.** The frontend mints in-store EAN-13 codes in the GS1 internal range: a leading `2`, so every minted code starts 200–299 and can never clash with a supplier's registered code. If the backend starts minting them, keep that range.
- **Replenishment statuses.** BL-010 section 5 ends a request at Completed, Cancelled or Rejected; the local flow uses `requested → approved → completed`, plus `rejected` and `cancelled`.

Until those exist, keep the rule: **components → hooks → services**. When an endpoint lands, change the service and the mapper; leave the screens.

---

## 10. Environment

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Backend `CORS_ORIGIN` must include the frontend origin (scheme + host + port, no trailing slash), e.g. `http://localhost:3001`.
