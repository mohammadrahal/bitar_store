# Bitar Fashion — Architecture and API Status

This is the living picture of the frontend: what it does, how it is built, which backend APIs it already calls, and what still runs locally because the backend has no matching endpoints.

The original plan in `CLAUDE.md` was a mock-only dashboard. The app has since grown into a signed-in operations UI that talks to the Bitar Store API for auth, users, branches, catalog, opening stock, and retail sales. Everything else (transfers, invoices, stock control, replenishment, analytics) still lives in a local ledger.

The current HTTP contract is `bitar-frontend-plan.md`. `AGENTS.md` is an older slice of that contract (auth, users, branches only) and should not be treated as complete.

---

## 1. What the product is

Bitar is a multi-branch fashion inventory app. Staff sign in, work inside the branches they can see, and manage:

- The catalog (styles and size/color SKUs)
- On-hand stock at each branch
- Retail (B2C) sales at the till
- Wholesale (B2B) documents, invoices, transfers, counts, holds, and replenishment (local only for now)

There is no public storefront and no public registration. An admin creates accounts.

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

---

## 3. Architecture

### Data flow (the only allowed path)

```
Component  →  hook (TanStack Query / Zustand)  →  service  →  API client and/or local store
```

Components never import `lib/api/*` or `mocks/*`. When the real API later covers a mock feature, only the service (and sometimes a mapper) should change.

### Two backends, one UI

| Source of truth | What it owns |
|---|---|
| **Bitar Store HTTP API** | Session, users, branches, catalog (styles/SKUs/barcodes/prices), sellable/non-sellable/in-transit stock, opening stock, completed POS sales |
| **Local mock store** (`localStorage` key `bitar-fashion:catalog-db:v9`) | A mirror of catalog + branches for pickers, plus the whole operations ledger the API does not have yet: invoices, transfers, holds, counts, movements, colors, warehouse flag, cost price, extra product details, low-stock thresholds, idempotency replays |

The mock store is **not** seed data for products anymore. Catalog and branch lists are pulled from the API and **mirrored** so transfers, invoices, and pickers can still resolve SKU names without calling the server on every keystroke.

```
API catalog / branches / stock
        │
        ▼
  services (map + mirror)
        │
        ├── TanStack Query cache  →  screens
        └── local store           →  transfers, invoices, counts, holds, replenishment, charts
```

### Auth and session

1. `POST /auth/login` returns a bearer token.
2. `GET /auth/me` loads the user, permission keys, assigned `branchIds`, and `canViewCosts`.
3. Token + user sit in Zustand, persisted to **sessionStorage** (`bitar-fashion:session:v4`). Closing the tab ends the session. There is no logout endpoint; dropping the token is logout.
4. A 401 on any authenticated request signs the user out and sends them to `/login`.
5. `<AuthGate>` blocks the dashboard. `<BranchGuard>` sends scoped users away from `/dashboard` and other people's branches.

### Permissions

`lib/permissions.ts` is the only place role checks live.

- UI actions use `can(role, action)` and `<Can action="...">`.
- Backend keys from `/auth/me` **narrow** those actions; they never widen them:
  - `catalog.create` → product create/edit/archive
  - `sales.create` → B2C and B2B create
  - `discounts.apply` → sale discount
  - `adjustments.create` → purchases / opening-stock-style writes
  - `canViewCosts` → cost and margin columns

Roles:

| Role | Scope | Typical access |
|---|---|---|
| **admin** | All branches | Users, branches, catalog, stock, sales, void documents |
| **manager** | Assigned branches | Catalog, stock, transfers, sales, invoices; cannot create users or the branch network |
| **employee** | Assigned branch | Read stock, receive transfers, ring B2C sales; no costs, no branch admin |

### Query keys

Every cache key lives in `lib/query-keys.ts`. Mutations invalidate the related family (`queryKeys.stock.all`, `salesQueryKeys.all`, and so on) instead of guessing strings.

### Forms and errors

Zod schemas in `schemas/` validate forms. API errors (`400`, `409`, …) surface as the server `message` next to the field or as a toast. `401` clears the session. `403` is an access-denied state.

---

## 4. Folder map

```
app/
  login/page.tsx                         sign-in
  (dashboard)/layout.tsx                 shell + AuthGate + BranchGuard
    dashboard/                           admin overview
    branches/  branches/[id]/            branch list and one branch
    products/  products/new  products/[id]  products/clear
    inventory/  inventory/[variantId]
    sales/new  sales/b2c  sales/b2b  sales/[id]
    invoices/  invoices/[id]
    transfers/  transfers/new  transfers/[id]
    stock-control/
    replenishment/
    users/

components/     feature UI (never talks to fetch or mocks)
hooks/          TanStack Query wrappers
services/       business logic; the only layer that may call the API or the mock store
lib/api/        typed HTTP client, mappers, error type
lib/            permissions, query keys, money/SKU/barcode helpers
mocks/          local ledger + catalog mirror
store/          Zustand session and UI
schemas/        zod
types/          app shapes (products, invoices, transfers, …)
providers/      QueryClient + toasters
```

---

## 5. What the app does today (by screen)

| Route | What it does | Data source |
|---|---|---|
| `/login` | Email/password sign-in, then `/auth/me` | API |
| `/dashboard` | Stat cards, low-stock list, sales charts (admin) | Stock cards: API. Charts: local invoices |
| `/branches/:id` | Same overview scoped to one branch | Mix, as above |
| `/branches` | List, create (`code` + `name`), rename, activate/deactivate. Cannot delete. Blocks deactivate while units remain | API (+ stock units from API) |
| `/products` | Search, category, active/archived. Cost column hidden without `canViewCosts` | API catalog, mirrored |
| `/products/new` | Style + variant grid, auto SKU, barcode, optional opening qty per branch | API styles/SKUs/barcodes + `POST /stock/opening` |
| `/products/:id` | Edit name/category/price, add variants, barcodes, price history, archive | API |
| `/products/clear` | Archive every active style on the server | API |
| `/inventory` | Five-balance table (on hand, reserved, hold, available, in transit) | **Local ledger** (quantities here can disagree with `GET /stock`) |
| `/inventory/:variantId` | Per-location balances and movement history | **Local** |
| `/sales/new` | Till: pick model → variant → qty, cash, optional discount | API `POST /sales` + `GET /stock` for sellable |
| `/sales/b2c` | Retail sales for a branch and business date | API `GET /sales` |
| `/sales/:id` | One completed POS sale | API `GET /sales/:id` |
| `/sales/b2b` | Wholesale documents (draft → issue) | **Local invoices** |
| `/invoices` | Purchases, sales, returns, adjustments | **Local** |
| `/transfers` | Request → approve (reserve) → dispatch → receive | **Local** |
| `/stock-control` | Holds, physical count, disposal | **Local** |
| `/replenishment` | Low at stores vs warehouse, suggested transfer | **Local** |
| `/users` | Create user, set password, assign one branch, edit, deactivate, delete | API |

Shared shell: sidebar (links filtered by permission), header branch switcher (admins), theme toggle, sign out, offline banner.

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

`getApiClient()` reads the session token. `send()` never puts the token in a URL or a log. Sales and opening stock send an `Idempotency-Key` header.

---

## 7. Backend APIs — wired vs not

Legend: **Used** = a screen actually calls it. **Client only** = typed in `lib/api/` but no screen uses it. **Missing on backend** = the UI still fakes it.

### 7.1 Wired and used

| Method | Path | Used by |
|---|---|---|
| `POST` | `/auth/login` | Login |
| `GET` | `/auth/me` | Login and session restore |
| `GET` | `/users` | Users page |
| `POST` | `/users` | Create account |
| `PATCH` | `/users/:id` | Edit / activate |
| `PUT` | `/users/:id/password` | Initial and reset password |
| `PUT` | `/users/:id/branches/:branchId` | Assign branch |
| `DELETE` | `/users/:id/branches/:branchId` | Change or clear assignment |
| `DELETE` | `/users/:id` | Remove account |
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
| `POST` | `/skus/:id/barcodes` | Add / auto-mint EAN-13 |
| `DELETE` | `/barcodes/:id` | Remove barcode |
| `GET` | `/stock?branchId=` | Dashboard stats, branch stock, till availability |
| `POST` | `/stock/opening` | Opening quantities on new product |
| `POST` | `/sales` | New B2C sale (`in_store`, cash, optional percent discount) |
| `GET` | `/sales?branchId=` | B2C list |
| `GET` | `/sales/:id` | Sale detail |

### 7.2 Exist on the backend, not used by the UI yet

| Method | Path | Why unused |
|---|---|---|
| `GET` | `/health` | Client has `fetchHealth`. No status screen. |
| Sale `channel: "social_media"` + `socialPlatform` | `POST /sales` | Till always sends `in_store`. |
| Payment `method: "whish"` | `POST /sales` | Till always sends cash for the full total. |
| Line discount `type: "override"` | `POST /sales` | UI only spreads a cart percent. |
| `tendered` / change on cash | `POST /sales` | Tendered is set equal to the amount (no till drawer). |

### 7.3 Frontend features with no backend API

These screens work, but only on this browser's local ledger. A refresh on another device will not see them. They also **do not move server stock** (except POS sales, which do).

| Feature | Local service | Backend today |
|---|---|---|
| Transfers (request, approve/reserve, dispatch, receive, discrepancy) | `transfers.service.ts` | No transfer endpoints |
| Invoices: purchase, purchase return, sale return, adjustment | `invoices.service.ts` | No document endpoints |
| B2B wholesale sales | Same invoice ledger | `POST /sales` is retail-shaped, not wholesale documents |
| Holds / release | `holds.service.ts` | No hold endpoints |
| Physical count and count reports | `counts.service.ts` | No count endpoints |
| Disposal / write-off | stock-control | No adjustment-out endpoint beyond opening stock |
| Replenishment suggestions | `replenishment.service.ts` | Derived from local transfers + local thresholds |
| Inventory five-balance view and movement history | `inventory.service.ts` | `GET /stock` only has sellable / nonSellable / inTransit |
| Dashboard sales charts and top sellers | `analytics.service.ts` | No analytics endpoints (charts read local invoices, so POS API sales are missing from them) |
| Main warehouse flag | `locations.service.ts` | Branch has no type/location field |
| Color palette | `attributes.service.ts` | Color is a free string on the SKU |
| Cost price | mirrored onto the product locally | API has sell price only |
| Extra product details (season, brand, material, description) | local fields on the style mirror | API has code, name, category, isActive |
| Low-stock threshold per variant × branch | local `stock.lowStockAt` | API has no threshold |
| User's assigned branches as a list | remembered in this browser after grant | No `GET /users/:id/branches` |
| Logout | drop token | No logout endpoint (fine) |
| Delete a branch | deactivate only | No `DELETE /branches/:id` (by design) |

### 7.4 Data the API returns that the UI only partly shows

| API field | UI treatment |
|---|---|
| Branch `code` | Shown; also copied into `location` because the API has no address/phone |
| Stock `nonSellable` | Mapped, but inventory screen still prefers the local five-balance model |
| Stock `inTransit` | Used in dashboard/stock maps; transfer in-transit is still local |
| Sale `soldBy`, `businessDate`, `reference` | Shown on B2C list and detail |
| `permissions[]` from `/auth/me` | Combined with role in `canUser()` |

---

## 8. Known split (important)

There are **two stock pictures**:

1. **Server stock** (`GET /stock`, moved by `POST /sales` and `POST /stock/opening`) — dashboard cards, branch stock, till picker.
2. **Local ledger stock** (invoices, transfers, holds, counts) — inventory page, stock control, replenishment, charts.

A POS sale reduces server stock. It does **not** write a local invoice, so charts and the inventory table will not show it. A local invoice sale moves local stock only. Until transfers and documents exist on the API, treat those screens as a prototype of the workflow, not as the live warehouse.

---

## 9. What still needs to exist on the backend (to replace mocks)

In the order that would collapse the local ledger:

1. **Transfers** — create request, approve/reserve, dispatch, receive, cancel, discrepancy; stock reservation and in-transit.
2. **Documents / invoices** — purchase, purchase return, wholesale sale, sale return, stock adjustment; draft → post → void; idempotency.
3. **Stock control** — holds, counts, write-offs (or fold them into adjustments).
4. **Richer stock read** — on hand, reserved, on hold, available, in transit, and a low-stock threshold (or a policy endpoint).
5. **Analytics** — sales by branch and top SKUs from posted sales, including `POST /sales`.
6. **Catalog extras** — cost price, optional details, shared color list (optional).
7. **Branch extras** — warehouse flag, address/phone (optional).
8. **User branches** — `GET` the assignments so the users form does not remember them only in this browser.

Until those exist, keep the rule: **components → hooks → services**. When an endpoint lands, change the service and mapper; leave the screens.

---

## 10. Environment

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Backend `CORS_ORIGIN` must include the frontend origin (scheme + host + port, no trailing slash), e.g. `http://localhost:3001`.
