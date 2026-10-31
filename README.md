# Bitar — Multi-Branch Inventory Dashboard (Frontend)

Next.js dashboard for the Bitar fashion store: branches, staff, catalog, stock
and till sales across several shops.

Every figure on screen comes from the Bitar backend. The browser keeps **no
business data of its own** — the only thing stored locally is a mirror of the
branch and catalog records the API returned, so a picker or a table can name a
SKU without a request per keystroke.

> **Every URL and endpoint path in this file is an example.** The real base URL
> for your environment belongs in `.env` (never in the repo or in a component),
> and the real routes are whatever your backend documents. Paths like
> `POST /auth/login` below stand for "the backend's sign-in route" and are only
> there to show the shape of a call.

---

## 1. Getting started

### Requirements

- Node.js 20+
- A running Bitar backend you can reach from the browser

### Environment

Copy the example file and fill in your own backend URL:

```bash
cp .env.example .env
```

```env
# .env — example values, replace with your own
NEXT_PUBLIC_API_URL=https://api.example.com
```

| Variable | Purpose | Default if unset |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend, no trailing slash | `http://localhost:3000` |

`NEXT_PUBLIC_` variables are compiled into the client bundle, so treat the URL
as public and keep secrets out of this file. Read it only through
`getApiBaseUrl()` in `lib/api/client.ts`.

### Backend CORS

The backend must allow this app's origin. In its own environment, for example:

```env
# example, on the backend
CORS_ORIGIN=http://localhost:3000
```

Multiple origins are comma-separated, exact, with scheme and port, no trailing
slash.

### Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build + type check
npm run start   # serve the production build
```

### First sign-in

There is no public registration. An account must already exist on the backend;
sign in with it at `/login`, then create the rest from **Users**.

---

## 2. Stack

| Concern | Library |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 plus the tokens in `app/globals.css` |
| Server data | TanStack Query (30s stale time, no retry on 4xx) |
| Client/UI state | Zustand |
| Forms and validation | react-hook-form + zod |
| Motion | `motion/react` — one entrance config in `components/motion/` |
| Toasts | sonner |
| Icons | lucide-react |
| Charts | recharts |

Brand: Playfair Display for titles, Inter for everything else, tabular figures
in tables and stat cards.

---

## 3. Architecture

Data flows one way. A component never calls `fetch` and never reads the store.

```
Component ──► hook (TanStack Query) ──► service ──► API client ──► backend
                                            └─► catalog mirror (localStorage)
```

| Layer | Folder | Responsibility |
|---|---|---|
| Pages | `app/` | Routes. Server components that render one client view. |
| Components | `components/` | UI only. Data through hooks, access through `<Can>` / `usePermission()`. |
| Hooks | `hooks/` | `useQuery` / `useMutation`. Mutations invalidate their keys and toast. |
| Services | `services/` | The only layer that talks to the API client. |
| API client | `lib/api/` | Typed calls. Adds the bearer token, turns failures into `ApiError`. |
| Catalog mirror | `mocks/store.ts` | Branches, styles and SKUs as returned by the API, for naming and pickers. |
| Schemas | `schemas/` | zod: the single source of form validation. |
| Stores | `store/` | Zustand: session (`user-store.ts`), UI preferences (`ui-store.ts`). |
| Query keys | `lib/query-keys.ts` | Every query key in one place. |
| Permissions | `lib/permissions.ts` | `can(user, permission, locationId?)` and every rule. |

### Folder map

```
app/
  login/                   sign-in
  (dashboard)/             signed-in area (sidebar + top bar)
    dashboard/             network overview (owner roles)
    branches/ [id]/        branch list and one branch, addressed by store code
    inventory/ [variantId] stock by variant, and one variant across locations
    products/ new/ [id]/   catalog: models, variants, prices, barcodes
    sales/new/ b2c/ [id]/  till, today's sales, one sale
    opening-stock/         first units at a location
    users/                 staff accounts
    profile/               your own account
components/                auth, branches, dashboard, inventory, motion,
                           products, profile, sales, shared, stock, users, ui
hooks/                     use-auth, use-branches, use-products, use-stock, ...
services/                  auth, session, users, branches, products, stock,
                           inventory, sales, opening-stock, profile, ...
lib/api/                   backend client (section 5)
mocks/store.ts             catalog mirror
schemas/                   zod schemas
store/                     Zustand stores
types/                     shared domain types
providers/                 QueryProvider (+ 401 handling), AppProviders
```

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

`components/shared/hydration-gate.tsx` rehydrates the stores on every load and
re-reads the session route when a token is present, so a role or location change
is picked up at once.

- `401` → session cleared, back to `/login`.
- Network error → the cached session is kept, so a blip doesn't sign everyone out.

### Authenticated requests

```http
Authorization: Bearer <token>
```

`Content-Type: application/json` is added only when there is a body. Tokens
never appear in URLs or logs. Writes that must not repeat (a sale, an opening
count) also send an `Idempotency-Key`.

### 401 handling

`providers/query-provider.tsx` registers `onUnauthorized()` from
`lib/api/client.ts`. On any protected `401` it clears the cache, signs out,
explains that the session expired, and lets `AuthGate` redirect to
`/login?next=<page>`.

### Route protection

| Component | Job |
|---|---|
| `AuthGate` | Sends signed-out visitors to `/login?next=…` |
| `BranchGuard` | `redirectPathFor()` keeps each role on pages it may open, and resolves a branch URL's store code |

Both are UX only. The backend's `401` / `403` are what count.

---

## 5. API client (`lib/api/`)

| File | Contents |
|---|---|
| `client.ts` | `send()`, `createRequest(token)`, `onUnauthorized()`, `getApiBaseUrl()` |
| `auth.api.ts` | Sign-in, session and health calls |
| `users.api.ts` | Accounts, passwords, branch access |
| `branches.api.ts` | Locations, including the `branch` / `warehouse` kind |
| `catalog.api.ts` | Styles, SKUs, prices, price history, barcodes, code lookup |
| `stock.api.ts` | Stock list, opening stock, overview, movements |
| `sales.api.ts` | Create and read till sales |
| `reorder-levels.api.ts` | Minimum / target per SKU, replenishment suggestions |
| `reports.api.ts` | Sales summary, top SKUs, audit events |
| `create-api.ts` | `createApi(token)` — everything above for one token |
| `get-api-client.ts` | `getApiClient()` for the signed-in session |
| `map-*.ts` | API payloads to UI types |
| `api-error.ts` | `ApiError { status, message }` |
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

| Tier | Who holds it |
|---|---|
| `BASELINE` | Anyone signed in (`catalog.view`) |
| `EMPLOYEE` | Granted per person: till keys, catalog keys, `stock.view`, cash drawer, branch reports |
| `MANAGER` | Every manager and super admin: `locations.view_all`, `users.manage`, `discounts.apply`, `opening_stock.post`, … |
| `SUPER_ADMIN` | `settings.manage`, `users.deactivate`, `users.role.change` |

Catalog keys are held once for the business; everything else is held at a
location. An employee's assignments, access level and keys are kept in this
browser (`lib/user-access.ts`) because the backend has no endpoint for them yet
— a signed-in user's own reach always comes from the session route.

### Landing pages

| User | Home |
|---|---|
| Super admin / manager | `/dashboard` |
| Employee with a location | `/branches/<store code>` |
| Employee without one | `/products`, with a banner explaining it |

---

## 7. Screens

| Screen | What it does | Backend |
|---|---|---|
| `/dashboard` | Network stat cards and today's takings, plus the sales charts | stock + sales reads |
| `/branches`, `/branches/<code>` | Locations, create a branch or warehouse, one branch's figures and stock | branch + stock reads |
| `/inventory`, `/inventory/<sku>` | Stock by variant with the five balances; one variant across locations | stock reads |
| `/products`, `/products/new`, `/products/<id>` | Models, colours and sizes, per-SKU prices and barcodes, optional opening count on create | catalog + opening stock |
| `/sales/new` | The till: pick a model, size and colour, discount a line, take cash or Whish | sale create |
| `/sales/b2c`, `/sales/<id>` | Today's sales and one sale | sale reads |
| `/opening-stock` | First units at a location, SKU by SKU | stock movements + opening stock |
| `/users` | Accounts, roles, location access and permission keys | user endpoints (keys stay local) |
| `/profile` | Your own name and password | user endpoints |

Notes:

- **Stock only moves through the backend.** Units arrive with an opening count
  and leave with a till sale; the app has no local ledger.
- **Opening stock is per SKU, not per location.** A SKU that has never moved at
  a location can be opened there, which is how a model added later gets its
  first units at a location opened months ago.
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
| Prices | 0 or more, at most 1,000,000 | `product.schema.ts` |
| Opening quantity | Whole units, 0 or more | `product.schema.ts` |

---

## 9. Security notes

- The bearer token lives in sessionStorage, so never render untrusted HTML.
- Passwords go only to the password route, never to a create or update call.
- `.env` holds the backend URL. Keep the real one out of commits — `.env.example`
  is the file to edit in the repo.
- On startup the app clears data left by older builds (previous session and
  mirror keys).

---

## 10. Known gaps

The backend has no routes for these, so the screens that used a local ledger
were removed rather than left pretending:

| Gap | What it would unlock |
|---|---|
| Goods receipt / adjustment | Receiving, supplier costs, stock corrections |
| Transfers between locations | Moving stock, in-transit balances |
| Documents (purchase, returns, adjustments) | An invoice ledger and B2B sales |
| Counts and holds | Physical counts, non-sellable stock |
| Replenishment requests | A branch asking the warehouse for stock |
| Discount requests | An employee asking for money off |
| Reorder levels in the UI | Low-stock thresholds and suggestions (client calls exist in `lib/api/reorder-levels.api.ts`) |
| Reports in the UI | Sales summary and top SKUs (client calls exist in `lib/api/reports.api.ts`) |
| A user's locations and keys | Replaces `lib/user-access.ts` |
