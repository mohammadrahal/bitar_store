# Bitar — Multi-Branch Inventory Dashboard (Frontend)

Next.js dashboard for the Bitar fashion store: branches, staff, catalog, stock,
transfers, deliveries, returns, the cash drawer and till sales across several
shops and one warehouse.

Every balance and every sale comes from the Bitar backend. What the browser
keeps is either a copy of what the API returned (the catalog mirror, the saved
query cache) or a small set of records the backend has no route for yet. Both
are listed in [section 9](#9-what-is-stored-in-the-browser).

> **Every endpoint path in this file is an example.** The real routes are
> whatever your backend documents. Paths like
> `POST /auth/login` below stand for "the backend's sign-in route" and are only
> there to show the shape of a call.

---

## 1. Getting started

### Requirements

- Node.js 20+
- A running Bitar backend you can reach from the browser

### Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build + type check
npm run start   # serve the production build
```

### First sign-in

There is no public registration. An account must already exist on the backend;
sign in with it at `/login`, then create the rest from **Settings → Employees**
(`/admin`).

---

## 2. Stack

| Concern | Library |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts` for redirects), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 plus the tokens in `app/globals.css` and `app/operations.css` |
| UI primitives | Base UI (`@base-ui/react`) via shadcn, in `components/ui/` |
| Server data | TanStack Query (30s stale time, no retry on 4xx, cache saved to IndexedDB) |
| Client/UI state | Zustand |
| Forms and validation | react-hook-form + zod |
| Motion | `motion/react` — one entrance config in `components/motion/` |
| Toasts | sonner |
| Icons | lucide-react |
| Charts | recharts |
| Analytics | `@vercel/analytics`, production builds only |

Brand: Cormorant Garamond for titles, Inter for everything else (both
self-hosted through `@fontsource`), tabular figures in tables and stat cards.

---

## 3. Architecture

Data flows one way. A component never calls `fetch` and never reads the store.

```
Component ──► hook (TanStack Query) ──► service ──► API client ──► backend
                    │                       │
                    │                       └─► catalog mirror (localStorage)
                    └─► saved query cache (IndexedDB, per user)
```

| Layer | Folder | Responsibility |
|---|---|---|
| Pages | `app/` | Routes. Server components that render one client view. |
| Components | `components/` | UI only. Data through hooks, access through `<Can>` / `usePermission()`. |
| Hooks | `hooks/` | `useQuery` / `useMutation`. Mutations invalidate their keys and toast. |
| Services | `services/` | The only layer that talks to the API client. |
| API client | `lib/api/` | Typed calls. Adds the bearer token, turns failures into `ApiError`. |
| Catalog mirror | `lib/catalog-cache/` | Branches, styles and SKUs as returned by the API (see below). |
| Schemas | `schemas/` | zod: the single source of form validation. |
| Stores | `store/` | Zustand: session (`user-store.ts`), UI preferences (`ui-store.ts`). |
| Query keys | `lib/query-keys.ts` | Every query key in one place. |
| Permissions | `lib/permissions.ts`, `lib/api-access.ts` | `can(user, permission, locationId?)`, route rules, and checks on server-only keys such as transfers. |
| Redirects | `proxy.ts` | Old top-level URLs into the `/admin` and `/inventory` hubs. |

### Catalog mirror

`GET /stock` answers with SKU ids and quantities only. To show a name, colour,
size or category beside each balance, and to search SKUs without a request per
keystroke, services keep a copy of what the API returned in
`lib/catalog-cache/store.ts` (`localStorage`, key `bitar-fashion:catalog-db:v12`).

- `mirrorBranches()` runs whenever the branch list is fetched. It adds and
  updates branches but only removes them for users who see the whole network,
  because a manager's list holds only their own branch. The warehouse is the
  branch with `kind: 'warehouse'`.
- `mirrorCatalog()` runs after catalog, SKU and stock reads.
  `services/catalog-sync.service.ts` fetches the whole catalog once per session
  and drops anything the server no longer has.
- Services read it with `readDb()`. Hooks wait for `useMirroredBranches()`
  before querying stock, so no query runs against an empty mirror.

The mirror never holds a balance and never invents a record. It is reset on
sign-out.

### Saved query cache

`lib/query-persist.ts` saves successful queries to IndexedDB, one slot per user
and per API URL, at most every 10 seconds and when the tab is hidden. On the
next load `HydrationGate` restores it before the first render, so a tablet on a
dead network still shows the last figures it had. Snapshots older than a week
are dropped, search-as-you-type results are not saved, and the whole cache is
cleared on sign-out.

### Folder map

```
app/
  login/                     sign-in
  (dashboard)/               signed-in area (sidebar + top bar)
    dashboard/               network overview (owner roles)
    branches/[id]/           one branch, addressed by store code
    inventory/ [variantId]/  "Warehouse": stock by variant, one variant across locations
    stock-network/           stock at every location side by side
    reorder-levels/          branch minimums
    transfers/ new/ [id]/    transfers, with invoice/ and report/ per transfer
    stock-receipts/ new/ [receiptId]/  supplier deliveries
    suppliers/               supplier list
    products/ new/ [id]/     catalog: models, variants, prices, barcodes
    categories/              product categories
    sales/new/               the till
    sales/history/ [id]/     till sales and one sale
    sales/b2c/               retail sales list
    sales/invoices/ new/ [id]/  fiscal invoices
    cash/ [sessionId]/       cash drawer sessions
    returns/ inspection/ [returnId]/  customer returns
    admin/                   hub: employees, locations, opening stock, reports,
                             audit log, store settings (?section=…)
    users/[id]/              one employee
    account/                 your own profile, password and preferences
components/                  one folder per screen, plus shared/, ui/, motion/, blocks/
hooks/                       one use-*.ts per data area
services/                    one *.service.ts per data area
lib/api/                     backend client (section 5)
lib/catalog-cache/           catalog mirror
schemas/                     zod schemas
store/                       Zustand stores
types/                       shared domain types
providers/                   QueryProvider (+ 401 handling), AppProviders
proxy.ts                     legacy URL redirects
```

Old addresses still work: `/users`, `/branches`, `/opening-stock`, `/reports`,
`/audit` and `/settings` redirect to the matching `/admin?section=…` tab,
`/replenishment` to `/inventory?section=replenishment`, `/profile` to
`/account`, and `/sales/b2b` to `/sales/invoices`.

---

## 4. Authentication and session

### Sign-in

1. Email and password are submitted on `/login`.
2. `services/auth.service.ts` lowercases the email and posts them to the
   backend's sign-in route (example: `POST /auth/login`), which answers with a
   token and the user.
3. `services/session.service.ts` then reads the session route (example:
   `GET /auth/me`) and builds the app's `User`:

   ```ts
   interface User {
     id: string
     name: string            // fullName, tidied for display
     email: string
     role: 'super_admin' | 'manager' | 'employee'
     branchId: string | null // employees: their location; owner roles: null
     branchIds: string[]     // every location this user may see
     locations: { locationId: string; access: 'full' | 'view_only' }[]
     permissions: string[]   // permission keys from the backend
     grants: Record<string, string[]>
     canViewCosts: boolean
   }
   ```

4. Token and user go into the Zustand session store, persisted to
   **sessionStorage** (`bitar-fashion:session:v4`), so the session ends with the
   tab.
5. The login screen sends the user to the page they asked for, or to their home
   page.

Deactivated accounts are refused at sign-in.

### Restoring a session

`components/shared/hydration-gate.tsx` runs on every load. It clears data left
by older builds, rehydrates the session and UI stores, restores the saved query
cache for that user, then re-reads the session route when a token is present.
The session is read again when the tab regains focus, at most once a minute, so
a role or permission change made by an admin is picked up without signing out.

- `401` → session cleared, back to `/login`.
- Network error → the cached session is kept, so a blip doesn't sign everyone out.

### Authenticated requests

```http
Authorization: Bearer <token>
```

`Content-Type: application/json` is added only when there is a body. Tokens
never appear in URLs or logs. Writes that must not repeat also send an
`Idempotency-Key`: sales, opening stock, stock adjustments, goods receipts,
every transfer step (create, dispatch, receive, accept, resolve), every return
step and every cash drawer action. The key is made once per form
(`useIdempotencyKey`), so a double click or a retry after a timeout is a no-op
on the server.

### 401 handling

`providers/query-provider.tsx` registers `onUnauthorized()` from
`lib/api/client.ts`. On any protected `401` it clears the in-memory and saved
query caches, signs out (which also resets the catalog mirror), explains that
the session expired, and lets `AuthGate` redirect to `/login?next=<page>`.

### Route protection

| Component | Job |
|---|---|
| `AuthGate` | Sends signed-out visitors to `/login?next=…` |
| `BranchGuard` | `redirectPathFor()` keeps each role on pages it may open, and resolves a branch URL's store code |
| `proxy.ts` | Redirects old URLs only; it does no access checks |

Both are UX only. The backend's `401` / `403` are what count.

---

## 5. API client (`lib/api/`)

| File | Contents |
|---|---|
| `client.ts` | `send()`, `sendPage()` (lists with `X-Total-Count`), `createRequest(token)`, `onUnauthorized()`, `getApiBaseUrl()` |
| `auth.api.ts` | Sign-in, session and health calls |
| `capabilities.ts` | Probes optional routes (`/warehouse`, `/categories`, `/permissions`, branch access, sales history) once per sign-in, so older servers fall back cleanly |
| `users.api.ts` | Accounts, passwords, branch access |
| `branches.api.ts` | Locations, including the `branch` / `warehouse` kind |
| `catalog.api.ts` | Styles, SKUs, prices, price history, barcodes, code lookup |
| `categories.api.ts` | Product categories |
| `costs.api.ts` | Cost prices, for users allowed to see them |
| `stock.api.ts` | Stock list, opening stock, overview, movements, adjustments |
| `transfers.api.ts` | Create, dispatch, receive, accept and resolve transfers |
| `goods-receipts.api.ts` | Supplier deliveries into the warehouse |
| `suppliers.api.ts` | Supplier list |
| `sales.api.ts` | Create and read till sales |
| `invoices.api.ts` | Fiscal invoices |
| `returns.api.ts` | Receive, approve, release and refund returns |
| `cash-sessions.api.ts` | Open, move cash, hand over, close and correct a drawer session |
| `reorder-levels.api.ts` | Minimum / target per SKU, replenishment suggestions |
| `reports.api.ts` | Sales summary, top SKUs, audit events |
| `dashboard.api.ts` | Overview figures |
| `settings.api.ts` | Store settings, including the USD/LBP rate |
| `create-api.ts` | `createApi(token)` — everything above for one token |
| `get-api-client.ts` | `getApiClient()` for the signed-in session |
| `map-*.ts` | API payloads to UI types |
| `api-error.ts` | `ApiError { status, message, details }` |
| `types.ts` | Request/response types |
| `index.ts` | Public exports — import from `@/lib/api` |

### Example of a call

Shapes, not routes. Replace the path and fields with your backend's own.

```ts
// services/example.service.ts
const sale = await getApiClient().createSale(
  {
    branchId,
    channel: 'in_store',
    lines: [{ skuId, quantity: 2 }],
    payments: [{ method: 'cash', amount: '25.00', tendered: '30.00' }],
  },
  idempotencyKey,
)
```

```http
POST /example/sales HTTP/1.1
Authorization: Bearer <token>
Idempotency-Key: <uuid>
Content-Type: application/json
```

### Errors

Every failure becomes an `ApiError` carrying the backend's own message, safe to
show. A network failure is `ApiError(0, 'Could not reach the server…')`.

| Status | Frontend behaviour |
|---|---|
| `0` | Network message; the query retries once |
| `400` | Message beside the form or in a toast |
| `401` | Global sign-out, or a login error on the sign-in form |
| `403` | Error state with the backend's message |
| `404` | Not-found message |
| `409` | Conflict inline — duplicate code, repeated idempotency key, insufficient stock |
| `5xx` | Generic error with "Try again" |

### Adding an endpoint

1. Types in `lib/api/types.ts`.
2. The call in the matching `*.api.ts` (new files are merged in `create-api.ts`).
3. A function in `services/`.
4. A hook in `hooks/` with a key from `lib/query-keys.ts`.
5. Components use the hook; nothing else changes.

---

## 6. Roles and permissions

Rules live in `lib/permissions.ts` and the key list in `lib/permission-keys.ts`.
Components never compare roles:

```tsx
<Can permission="locations.view_all">…</Can>

const { can, canAny, canAccessLocation, locationScoped } = usePermission()
```

There are three roles: **Admin** (`super_admin`), **Business manager**
(`manager`) and **Employee**. Admin and Business manager are equal owner
roles: both hold every key, and no tier sits above them.

| Tier | Who holds it |
|---|---|
| `BASELINE` | Anyone signed in (`catalog.view`) |
| `EMPLOYEE` | Granted per person: till keys, catalog keys, `stock.view`, the four cash drawer keys, `returns.create` / `returns.refund`, branch reports |
| `MANAGER` | Both owner roles, never an employee: `locations.view_all`, `users.manage`, `discounts.apply`, `opening_stock.post`, `stock.adjust`, `reports.view_all`, `settings.manage`, `users.deactivate`, `users.role.change` |

Catalog keys are held once for the business; everything else is held at a
location, and a **view-only** assignment allows only `catalog.view` and
`stock.view` there.

Some actions follow the server's own permission list from `GET /auth/me`
rather than the keys above. They are checked in `lib/api-access.ts`:

| Action | Rule |
|---|---|
| Dispatch a transfer | Owner role with `transfers.dispatch` |
| Receive a transfer | `transfers.receive` |
| Branch minimums | `adjustments.create` |
| Financial reports, invoices ledger | `reports.financial` |
| Approve, reject or release a return | Owner role only; there is no key to grant |
| See costs | Owner role only |
| Stock everywhere, audit log | Admin only, because the API refuses managers on `/stock/overview` and `/audit-events` |

The API returns a user's branch ids and a flat key list, but not the access
level per location or the per-location grants. Those are kept in this browser
(`lib/user-access.ts`) until the backend can store them. A signed-in user's own
branches always come from the session route.

### Landing pages

| User | Home |
|---|---|
| Admin / business manager | `/dashboard` |
| Employee with a location | `/branches/<store code>` |
| Employee without one | `/products`, with a banner explaining it |

---

## 7. Screens

Grouped as the sidebar shows them (`components/dashboard/nav-entries.ts`). A
link only appears for users who may open it.

| Menu | Screen | What it does |
|---|---|---|
| Overview | `/dashboard` | Network stat cards, today's takings and sales charts (owner roles) |
| Overview | `/branches/<code>` | One branch's figures and stock; an employee's home |
| Sell | `/sales/new` | The till: scan a barcode or tap a product then a size, adjust quantities and discounts in the cart, take cash or Whish |
| Sell | `/sales/invoices`, `/sales/invoices/new`, `/sales/invoices/<id>` | Fiscal invoices ledger, issuing an invoice, one invoice |
| Sell | `/sales/history`, `/sales/<id>` | Till sales with a date filter, and one sale |
| Sell | `/cash`, `/cash/<sessionId>` | Open, count, hand over and close the cash drawer; a manager's review list |
| Sell | `/returns`, `/returns/<id>`, `/returns/inspection` | Take goods back, inspect them, approve or reject, release to stock, pay the refund |
| Stock | `/inventory`, `/inventory/<variantId>` | **Warehouse** in the menu. Stock by variant with every balance, plus tabs for transfers, receiving and what to send. One variant across locations |
| Stock | `/transfers`, `/transfers/new`, `/transfers/<id>` | Request, prepare, dispatch, receive and resolve transfers between locations, with a transfer invoice and a receiving report |
| Stock | `/reorder-levels` | **Branch minimums**: the stock level each branch should keep per SKU |
| Stock | `/stock-network` | **Stock everywhere**: every location side by side (admin only) |
| Supplier to warehouse | `/stock-receipts/new`, `/stock-receipts`, `/stock-receipts/<id>` | Receive a supplier delivery, the list of deliveries, one delivery |
| Supplier to warehouse | `/suppliers` | Supplier list |
| Catalog | `/products`, `/products/new`, `/products/<id>` | Models, colours and sizes, per-SKU prices and barcodes. Creating a model places no stock |
| Catalog | `/categories` | Product categories |
| Admin | `/admin` | **Settings** in the menu. Tabs for employees, locations and store settings (USD/LBP rate, return window) |
| Admin | `/admin?section=opening-stock` | First units at a location, SKU by SKU |
| Admin | `/admin?section=reports` | Financial reports |
| Admin | `/admin?section=audit` | Audit log (admin only) |
| — | `/users/<id>` | One employee: role, locations, access level and permission keys |
| — | `/account` | Your own profile, password and preferences (theme, table density) |

Notes:

- **Stock only moves through the backend.** Units arrive with an opening count,
  a supplier delivery, an accepted transfer or a released return, and leave
  with a till sale or a dispatched transfer. Corrections go through
  `POST /stock/adjustments`. The app keeps no ledger of its own.
- **Balances.** The API reports sellable, non-sellable and in transit per SKU
  and location. The app shows non-sellable as **on hold**, counts draft
  transfer lines as **reserved** at the sender, and computes
  `available = sellable − reserved`, never below zero
  (`services/inventory.service.ts`).
- **Opening stock is per SKU, not per location.** A SKU that has never moved at
  a location can be opened there, which is how a model added later gets its
  first units at a location opened months ago.
- **Creating a model places no stock.** It starts at zero everywhere; the model
  page then offers the receipt form with its variants already listed.
- **Warehouse first.** Deliveries are received at the main warehouse and shops
  are stocked from it by transfer, so a receipt defaults to the warehouse and a
  posted receipt offers **Send to a branch** with From already filled in.
- **A branch URL carries its store code** (`/branches/hamra`). An id still
  resolves, and the page rewrites the address.

---

## 8. Validation

zod schemas in `schemas/` mirror the backend's rules, so most errors never reach
a request.

| Field | Rule | Schema |
|---|---|---|
| Email | Trimmed, lowercased, valid | `user.schema.ts`, `auth.schema.ts` |
| Full name | 2–100 characters | `user.schema.ts` |
| Password | 8+ characters, at most 72 UTF-8 bytes | `user.schema.ts`, `profile.schema.ts` |
| Role | `super_admin`, `manager`, `employee` | `user.schema.ts` |
| Branch code | 1–20 letters/digits/`-`/`_`, uppercased | `branch.schema.ts` |
| Branch name | 1–120 characters | `branch.schema.ts` |
| Model name / category | 2–120 / 2–60 characters | `product.schema.ts` |
| Model code | Optional (blank takes the next free `MD` code); up to 30 characters: letters, digits and `. _ / -`, uppercased | `product.schema.ts` |
| Colour / size | 1–40 / 1–20 characters | `product.schema.ts` |
| Barcode | 1–64 printable characters, no spaces | `product.schema.ts` |
| Prices | 0 or more, at most 1,000,000 | `product.schema.ts` |
| Opening quantity | Whole units, 0 to 99,999 | `product.schema.ts` |

---

## 9. What is stored in the browser

**Copies of what the API returned.** Safe to lose; they are fetched again.

| What | Where | Cleared |
|---|---|---|
| Session token and user | sessionStorage `bitar-fashion:session:v4` | When the tab closes, or on sign-out |
| Which optional API routes exist | sessionStorage `bitar:api-capabilities:v1` | On sign-out |
| Catalog mirror (branches, styles, SKUs) | localStorage `bitar-fashion:catalog-db:v12` | On sign-out |
| Saved query cache | IndexedDB, one slot per user and API URL | On sign-out, or after a week |
| Store settings (USD/LBP rate for receipts) | localStorage `bitar:settings:v1` | Overwritten on each read |

**Records the backend cannot hold yet.** These live only on this device.

| What | Where | Why |
|---|---|---|
| Parked till carts | localStorage `bitar:pending-sales:v1` | A cart exists only until `POST /sales` posts it |
| Employee access level and per-location keys | localStorage `bitar:user-access:v1` | `GET /auth/me` returns branch ids and a flat key list only |
| Delivery paperwork and photos | localStorage `bitar:stock-receipts:v1`, IndexedDB `bitar-files` | The stock moves through the API; the paper copy is kept here |
| Cost prices entered in the product and delivery forms | localStorage `bitar:catalog-costs:v1` | Those forms still use this device copy; `/costs` holds a separate server copy |
| Theme, table density, open menu sections | localStorage `bitar:user-preferences:v1`, `bitar-fashion:ui:v1`, `bitar:nav-open-sections:v1` | UI preferences |

On sign-out, and once per purge version on startup,
`lib/purge-local-mock-data.ts` removes data from older builds, resets the
catalog mirror, deletes stored files and clears the saved query cache.

---

## 10. Security notes

- The bearer token lives in sessionStorage, so never render untrusted HTML.
- Passwords go only to the password route, never to a create or update call.
- The saved query cache is scoped per user and cleared on sign-out, so the next
  person at a shared till cannot read the previous user's figures.
- Pages are marked `noindex`; nothing here is meant to be found by search.

---

## 11. Known gaps

Still without a backend route, so they are either missing from the app or kept
on the device:

| Gap | Effect today |
|---|---|
| Physical counts and holds ("Stock control") | No screen; on hold is the API's non-sellable bucket only |
| Social orders | No screen |
| A user's access level and per-location keys | Kept in this browser (`lib/user-access.ts`), so they do not follow the employee to another device |
| Delivery paperwork and photos | Kept on the device that booked the delivery |
| Costs in the product and delivery forms | Read from `bitar:catalog-costs:v1` on the device, not from `/costs`, so the two can disagree |
| Stock everywhere and the audit log for managers | `/stock/overview` and `/audit-events` refuse managers, so only the Admin sees them |
| Editing a SKU code | `PATCH /skus/:id` takes colour and size only, so `MD000002-BLU-M` keeps its code after the colour is renamed |

---

## 12. Changes — November 2026

### Till (`/sales/new`)

**Layout**

- Two columns: the product catalog on the left, the cart on the right. The cart
  is the wider of the two (`.sale-till-grid` in `app/operations.css`, about 62%
  on desktop, about 57% under 1200px), because it is where the cashier works.
- On desktop the cart is pinned beside the catalog and as tall as the screen.
  Only its items scroll; the total and **Confirm sale** never scroll away.
- The fixed bar at the bottom of the screen is gone. The total, any warning and
  the buttons sit at the foot of the cart (`components/sales/sale-footer.tsx`).
  On phones and tablets the columns stack and the checkout sticks to the bottom
  of the screen.
- With no location chosen, the catalog shows "Where are you selling from?" with
  the location picker in it. Once one is chosen, the picker moves to the page
  header for switching.
- "Held sale" and the last completed sale show as small status pills under the
  title.

**Picking products** (`components/sales/till-catalog.tsx`)

- Products are a grid of cards (name, code, number of sizes). Tapping one opens
  its sizes in a panel above the grid. Tapping another product switches the
  panel; the grid never moves.
- Each size is a compact tile: size and colour on the first line, price and
  stock left on the second. Low stock is amber, out of stock is greyed and
  sorted last. One tap adds one; a gold badge on the corner shows how many are
  in the cart.
- No quantity box or Add button per row. Quantities are corrected in the cart.
- Products load 24 at a time with **Show more products**. Loading shows grey
  placeholder cards.
- The invoice and transfer screens keep the table picker
  (`components/sales/catalog-line-picker.tsx`).

**Barcodes**

- The search box is focused on load, ready for a scanner.
- A full barcode (8–14 digits, with or without the spaces printed on the tag)
  finds its exact size and colour, with or without Enter. A SKU code such as
  `MD000002-BLU-M` does the same after Enter.
- The scan does **not** add the item. It opens the product showing only the
  scanned tile, outlined in gold; the cashier taps it to add it. **Show all
  sizes of this product** brings the rest back.
- `findVariantByCode()` in `services/variant-search.service.ts` matches exactly
  (never partially) and asks the API when the code is not in the local mirror,
  so a second barcode on a SKU works too.
- Enter in the search box never submits the sale form. Before, a scanner's Enter
  could confirm a sale mid-basket.

**Cart**

- Each item: name, colour / size, price each, line total, **− / +** quantity
  (capped at the stock available) and a remove button.
- Discounts are behind an **Add discount** link per item, with Cancel, instead of
  a form open under every line (`components/sales/line-discount.tsx`).
- **Clear** empties the cart, with **Undo** in the toast.
- Customer name and phone are behind **Add customer (optional)**; once filled in,
  the customer's name shows instead.
- Payment and **Sold through** (channel) appear only once there is something in
  the cart. The payment block no longer repeats the total
  (`components/sales/payment-fields.tsx`).
- A disabled **Confirm sale** turns grey instead of faded gold. Why it is
  disabled (drawer closed, offline, payment problem) shows in an amber box above
  it.

**Printing**

- Confirming a sale no longer opens the print dialog.
- The completed-sale pill has **Print receipt** and **View invoice** (or **View
  sale** if no fiscal invoice was created). The invoice page keeps its **Print
  invoice** button and the sale page its **Print receipt** button.

**Cash drawer**

- The "no cash drawer is open" box (`components/cash/cash-session-gate.tsx`) no
  longer renders a `<form>` inside the sale form, which was invalid HTML. It
  uses a button and handles Enter itself.

### Catalog (`/products/<id>`)

- Each variant row has an **Edit** button that opens one dialog for colour, size
  and sell price, with the price history underneath
  (`components/products/sku-price-dialog.tsx`, `SkuEditDialog`). Colour and size
  go through `PATCH /skus/:id`; a new price through the price route, so it is
  still recorded. The SKU code and barcodes do not change.
- The row actions column is pinned to the right edge of the table on desktop, so
  Edit is never scrolled out of view.
- The header button is now **Edit model** (name, category, cost, price for all
  variants).

### Sidebar (`components/dashboard/nav-entries.ts`)

- **Inventory** is renamed **Warehouse**, also in the quick-command search, the
  tab title and the page eyebrow. The URL is still `/inventory`.
- **Suppliers** appears once, under **Supplier to warehouse**. The duplicate
  under Admin is gone.
- **Settings** is new, first under Admin. It opens `/admin` on the Employees tab,
  with Locations and Settings beside it, and shows for anyone with
  `users.manage`, `locations.view_all` or `settings.manage`.
