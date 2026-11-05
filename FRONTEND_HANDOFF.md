# Frontend handoff for Mohamad

Backend API **v0.8** · written 31 Oct 2026 · target: **Checkpoint 1, Tuesday 3 Nov** (core flow live on a public URL), then **Checkpoint 2, Tuesday 10 Nov** (feature complete).

I read your repo (`mohammadrahal/bitar_store`, `main`), typechecked it (0 errors) and compared it with what the backend can do now. Your API client, idempotency hook and sale screen are solid. This file says **what is missing**, **what to fix**, and gives **every endpoint you still need** with a real request and response (taken from a running server, ids shortened).

Everything below is also in `API_REFERENCE.md` (all 48 endpoints) and `api.ts` (typed client you can copy types from).

---

## 1. What to build, in order

| # | Task | Why | Endpoints | Size |
|---|---|---|---|---|
| **P1** | **Transfers**: list, detail, new, send, receive, confirm lost, cancel | It is the heart of the demo flow. **Nothing exists in the front yet** | 7 | biggest |
| **P2** | **Stock of every place** (admin) + **What to send** (suggestions) with a "Prepare transfer" button | The owner sees the whole business and the system tells him what to do | 2 | medium |
| **P3** | **Dashboard from the reports endpoints** | Today it adds up `GET /sales` on the client for one day. The server now has proper reports with cash/Whish split and date ranges | 2 | small |
| **P4** | **Small fixes** (section 3) | They protect the live demo | | small |
| **P5** | Minimum levels screen, stock movements, audit log | Needed for Checkpoint 2 | 6 | medium |

**What already works and needs nothing:** login, `/auth/me`, users, branches (the wrapper already sends `kind`), styles, skus, barcodes, price, opening stock, stock list, sales (create, list, get). Your sale body matches the backend.

**Wrappers that exist but no screen uses them:** `stockOverview`, `listStockMovements`, `salesSummary`, `topSkus`, `auditEvents`, `listReorderLevels`, `setReorderLevel`, `setReorderLevelByStyle`, `deleteReorderLevel`, `replenishmentSuggestions`. They are typed as `unknown`: use the types below.

---

## 2. Rules that apply to every call

| Topic | Rule |
|---|---|
| Auth | `Authorization: Bearer <token>` on everything except `/health` and `/auth/login`. Your `send()` already does it |
| Errors | `{ "message": "..." }`. A shortage is `{ "message": "...", "details": [ ... ] }` (see fix F1) |
| Statuses | `400` bad input · `401` no or expired token · `403` not allowed · `404` not found (or you cannot see it) · `409` conflicts with the current state |
| Money | Always **strings**: `"89.00"`, never numbers |
| `Idempotency-Key` | **Required** on: `POST /sales`, `POST /stock/opening`, and on **every transfer step** that creates or moves something (create, dispatch, receive, resolve). New random uuid for each *action*, **same uuid when retrying the same action**. Your `useIdempotencyKey()` is exactly right: call `.current()` when sending, `.reset()` after success. If the server answers a retry from the first time it adds the header `Idempotent-Replay: true` |
| Paging | Lists take `limit` (default 50, max 200) and `offset`. The whole count is in the response header **`X-Total-Count`** (see fix F2) |
| Roles | **admin** (your `super_admin`) sees every place. **manager** only their own branches. **employee** sells and receives at their branch. The backend enforces it (`403`/`404`); the front should hide what a role cannot do |
| Warehouse | A place with `kind: "warehouse"`. One only. It **never sells to customers**: `POST /sales` there is `409`. Do not offer it in the till's branch picker |

---

## 3. Fixes in the existing code

**F1. Keep `details` on `ApiError` (important for the till).** Today `ApiError` only has `status` and `message`, so when stock is short the cashier sees a generic message and not *which* items. The server sends them:
```json
409 { "message": "Not enough stock for one or more items",
      "details": [ { "skuId": "2dae6572-…", "skuCode": "EVD-01-M-BLK", "requested": 500, "available": 44 } ] }
```
In `lib/api/api-error.ts` add `public readonly details?: unknown` and fill it in `send()` (`data.details`). In the sale screen, on `409` with `details`, list each item: *"EVD-01-M-BLK: 500 asked, 44 available"*. The same shape comes from a transfer dispatch when the sender is short.

**F2. Read `X-Total-Count`.** `send()` returns only the body, so lists cannot show "page 2 of 7" or "Load more". Add a variant that also returns the header:
```ts
export type Page<T> = { items: T[]; total: number }

export async function sendPage<T>(path: string, token: string | null): Promise<Page<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.()
    throw new ApiError(response.status, messageFrom(data, 'Request failed') /* + details, see F1 */)
  }
  return { items: data as T[], total: Number(response.headers.get('X-Total-Count') ?? (data as T[]).length) }
}
```
Browsers hide response headers from JavaScript unless the server lists them. The backend sends `Access-Control-Expose-Headers: X-Total-Count, Idempotent-Replay`. If you cannot read the header, tell Imad (the `exposedHeaders` setting in the backend CORS config).
Use it for `GET /stock` and `GET /transfers`. For the till and search, **"Load more"** (append the next `offset`); for admin tables, previous/next with `Math.ceil(total / limit)`.

**F3. Find the warehouse by `kind`.** `services/locations.service.ts` says "the API has no location type yet" and guesses the warehouse. The API has `kind` now: `branches.find((b) => b.kind === 'warehouse')`. Also remove the warehouse from the branch picker of the new-sale screen.

**F4. Dashboard numbers.** Replace the client-side sum in `analytics.service.ts` with `GET /reports/sales-summary` and `GET /reports/top-skus` (section 6, P3).

**F5. Rename `mocks/` to `mirror/`.** Per your README it is a local mirror of API data, not fake data, but a reviewer opening the repo will read "mocks" as fake. Same for `mock-ledger.ts`.

**F6. `NEXT_PUBLIC_API_URL` on Vercel.** It is baked in at build time. Set it to the backend URL (no trailing slash) in the Vercel project settings, then **redeploy**. Imad must set `CORS_ORIGIN` on the backend to your exact Vercel URL.

**F7. Known limitation to remember (not a bug to fix now).** `lib/user-access.ts` keeps per-branch access levels (`view_only`, `grants`) in the browser's localStorage because `/auth/me` returns only a flat list of branches and permissions. They differ between browsers. The backend still enforces the real rules, so the worst case is a button that answers `403`. For the demo, use the same browser or rely on `permissions` and `branchIds` from `/auth/me`.

---

## 4. New API module (your style)

Create `lib/api/transfers.api.ts` and add it to `create-api.ts`:
```ts
import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type { ApiTransfer, CreateTransferInput, TransferStatus } from '@/lib/api/types'

export function createTransfersApi(request: RequestFn) {
  return {
    createTransfer: (input: CreateTransferInput, idempotencyKey: string) =>
      request<ApiTransfer>('/transfers', 'POST', input, { idempotencyKey }),
    getTransfer: (id: string) => request<ApiTransfer>(`/transfers/${id}`),
    // list: use sendPage() from fix F2 to read X-Total-Count
    dispatchTransfer: (id: string, idempotencyKey: string, lines?: { skuId: string; quantity: number }[]) =>
      request<ApiTransfer>(`/transfers/${id}/dispatch`, 'POST', lines ? { lines } : {}, { idempotencyKey }),
    receiveTransfer: (id: string, lines: { skuId: string; accepted: number; damaged?: number }[], idempotencyKey: string) =>
      request<ApiTransfer>(`/transfers/${id}/receive`, 'POST', { lines }, { idempotencyKey }),
    resolveTransfer: (id: string, reason: string, idempotencyKey: string) =>
      request<ApiTransfer>(`/transfers/${id}/resolve`, 'POST', { reason }, { idempotencyKey }),
    cancelTransfer: (id: string) => request<ApiTransfer>(`/transfers/${id}/cancel`, 'POST'),
  }
}
```
Copy the types (`Transfer`, `TransferLine`, `StockOverview`, `ReplenishmentSuggestions`, `SalesSummary`, `AuditEvent`...) from `api.ts` into `lib/api/types.ts`.

---

## 5. P1: Transfers

### What a transfer is
Pieces moving from one place to another: **warehouse to branch** (the usual one: the branch is the warehouse's customer), a branch back to the warehouse, or branch to branch. There is **no payment** between places.

```
draft --dispatch--> dispatched --receive--> partially_received --receive--> received  (everything arrived)
  |                      \                           |
  +--cancel--> cancelled  +------- resolve (lost) ---+--------------------> closed    (the rest confirmed lost)
```

| Status | Meaning | Badge |
|---|---|---|
| `draft` | Prepared. **No stock has moved** | grey |
| `dispatched` | Sent. Pieces left the sender and are **on the road** | blue |
| `partially_received` | Some arrived, some still on the road | amber |
| `received` | Everything arrived | green |
| `closed` | The rest was confirmed **lost** | dark |
| `cancelled` | Cancelled while a draft | red |

**Where the pieces are** (10 pieces, warehouse to Hamra):

| Step | Warehouse | Hamra for sale | Hamra on hold | Hamra on the road |
|---|---|---|---|---|
| Draft | 50 | 10 | 0 | 0 |
| Dispatch | **40** | 10 | 0 | **10** |
| Receive 8 good + 1 damaged | 40 | **18** | **1** | **1** |
| Confirm 1 lost | 40 | 18 | 1 | **0** |

`inTransit` in `GET /stock` and `GET /stock/overview` is "coming to this place". Your inventory table already shows `inTransit`.

### Who can do what (hide buttons accordingly; the server enforces it anyway)

| Action | Permission (from `/auth/me`) | And the user must reach |
|---|---|---|
| Prepare, Send, Cancel | `transfers.dispatch` (admin, manager) | the **source** place |
| Receive | `transfers.receive` (admin, manager, **employee**) | the **destination** place |
| Confirm lost | `transfers.dispatch` (admin, manager; **not** employee) | the source or the destination |

A transfer that touches none of your places is `404` (it does not exist for you). The admin reaches every place.


#### `POST /transfers`

Prepare a draft. Moves nothing.

**Who:** admin, manager (from a place they reach).

**Request**
```http
POST /transfers
Idempotency-Key: <new random uuid for each action>

{
  "sourceBranchId": "e9a3c398-…",
  "destinationBranchId": "067e2225-…",
  "note": "weekly supply",
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "quantity": 10
    }
  ]
}
```

**Response**
```http
201 Created

{
  "id": "ca223193-…",
  "reference": "T-00000001",
  "status": "draft",
  "from": {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse",
    "kind": "warehouse"
  },
  "to": {
    "id": "067e2225-…",
    "code": "HAMRA",
    "name": "Hamra",
    "kind": "branch"
  },
  "note": "weekly supply",
  "requestedBy": {
    "id": "a404d402-…",
    "name": "Admin"
  },
  "requestedAt": "2026-11-04T09:01:20.254Z",
  "dispatchedBy": null,
  "dispatchedAt": null,
  "lines": [
    {
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK",
        "styleName": "Evening Dress",
        "size": "M",
        "color": "Jet Black"
      },
      "requested": 10,
      "dispatched": 0,
      "received": 0,
      "lost": 0,
      "onTheRoad": 0
    }
  ],
  "totals": {
    "requested": 10,
    "dispatched": 0,
    "received": 0,
    "lost": 0,
    "onTheRoad": 0
  }
}
```

**What the screen does**
- "New transfer" form: **from** (the user's places; admin any), **to** (any active place except from), a **note**, and lines (sku picker + quantity 1 to 10000, each sku once, 1 to 50 lines).
- Send one `Idempotency-Key` per form submit (`useIdempotencyKey`), reset on success.
- The suggestions screen can open this form pre-filled (section 6).

**Errors to handle**
- `400` bad lines · `403` not your place · `404` unknown place or sku · `409` inactive place or sku.


#### `GET /transfers`

List, newest first. Filters: `branchId`, `status`, `limit`, `offset`. Total in `X-Total-Count`.

**Who:** Admin sees all; anyone else sees the transfers that touch their places.

**Request**
```http
GET /transfers?branchId=067e2225-…&limit=2
```

**Response**
```http
200 OK
x-total-count: 1

[
  {
    "id": "ca223193-…",
    "reference": "T-00000001",
    "status": "closed",
    "from": {
      "id": "e9a3c398-…",
      "code": "WAREHOUSE",
      "name": "Main Warehouse",
      "kind": "warehouse"
    },
    "to": {
      "id": "067e2225-…",
      "code": "HAMRA",
      "name": "Hamra",
      "kind": "branch"
    },
    "note": "weekly supply",
    "requestedBy": {
      "id": "a404d402-…",
      "name": "Admin"
    },
    "requestedAt": "2026-11-04T09:01:20.254Z",
    "dispatchedBy": {
      "id": "a404d402-…",
      "name": "Admin"
    },
    "dispatchedAt": "2026-11-04T09:01:20.373Z",
    "lines": [
      {
        "sku": {
          "id": "ba8df1c9-…",
          "code": "EVD-01-M-BLK",
          "styleName": "Evening Dress",
          "size": "M",
          "color": "Jet Black"
        },
        "requested": 10,
        "dispatched": 10,
        "received": 9,
        "lost": 1,
        "onTheRoad": 0
      }
    ],
    "totals": {
      "requested": 10,
      "dispatched": 10,
      "received": 9,
      "lost": 1,
      "onTheRoad": 0
    }
  }
]
```

**What the screen does**
- Table: reference, **from → to**, status badge, requested / dispatched / received / lost totals, date.
- Filter chips by status. A branch screen "Coming to us" = `status=dispatched` and `status=partially_received` for its `branchId`.
- Use `sendPage()` (fix F2) for "Load more".


#### `GET /transfers/:id`

One transfer with its lines and quantities.

**Who:** Anyone who reaches one of its places (otherwise `404`).

**Request**
```http
GET /transfers/ca223193-…
```

**Response**
```http
200 OK

{
  "id": "ca223193-…",
  "reference": "T-00000001",
  "status": "closed",
  "from": {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse",
    "kind": "warehouse"
  },
  "to": {
    "id": "067e2225-…",
    "code": "HAMRA",
    "name": "Hamra",
    "kind": "branch"
  },
  "note": "weekly supply",
  "requestedBy": {
    "id": "a404d402-…",
    "name": "Admin"
  },
  "requestedAt": "2026-11-04T09:01:20.254Z",
  "dispatchedBy": {
    "id": "a404d402-…",
    "name": "Admin"
  },
  "dispatchedAt": "2026-11-04T09:01:20.373Z",
  "lines": [
    {
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK",
        "styleName": "Evening Dress",
        "size": "M",
        "color": "Jet Black"
      },
      "requested": 10,
      "dispatched": 10,
      "received": 9,
      "lost": 1,
      "onTheRoad": 0
    }
  ],
  "totals": {
    "requested": 10,
    "dispatched": 10,
    "received": 9,
    "lost": 1,
    "onTheRoad": 0
  }
}
```

**What the screen does**
- Header: reference, status badge, from → to, who prepared and who sent it, note.
- Lines table: sku, **requested, dispatched, received, lost, on the road**.
- Buttons by status and role (table above): Draft → **Send**, **Cancel**. Dispatched or partially received → **Receive** (destination), **Confirm lost** (only when `totals.onTheRoad > 0`).


#### `POST /transfers/:id/dispatch`

Send it: the pieces leave the sender and go **on the road**. The server locks and checks the sender's stock first.

**Who:** Admin, manager at the **source**.

**Request**
```http
POST /transfers/ca223193-…/dispatch
Idempotency-Key: <new random uuid for each action>
```

**Response**
```http
200 OK

{
  "id": "ca223193-…",
  "reference": "T-00000001",
  "status": "dispatched",
  "...": "same fields as GET /transfers/:id (from, to, note, requestedBy, dispatchedBy...)",
  "lines": [
    {
      "sku": {
        "code": "EVD-01-M-BLK"
      },
      "requested": 10,
      "dispatched": 10,
      "received": 0,
      "lost": 0,
      "onTheRoad": 10
    }
  ],
  "totals": {
    "requested": 10,
    "dispatched": 10,
    "received": 0,
    "lost": 0,
    "onTheRoad": 10
  }
}
```

**What the screen does**
- Body is optional: `{ "lines": [ { "skuId": "...", "quantity": 6 } ] }` sends **less** than asked on some lines.
- Disable the button while the request runs; one `Idempotency-Key` per click.
- On success refresh the transfer and the stock queries.

**Errors to handle**
- `409` with `details` when the sender is short: show each item (*requested / available*). **Nothing moved.**
- `409` "Only a draft can be dispatched" (already sent: just refresh).


#### `POST /transfers/:id/receive`

The destination says what arrived. `accepted` goes on sale, `damaged` goes on hold. Can be done in several rounds.

**Who:** Admin, manager, **employee** at the **destination**.

**Request**
```http
POST /transfers/ca223193-…/receive
Idempotency-Key: <new random uuid for each action>

{
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "accepted": 8,
      "damaged": 1
    }
  ]
}
```

**Response**
```http
200 OK

{
  "id": "ca223193-…",
  "reference": "T-00000001",
  "status": "partially_received",
  "...": "same fields as GET /transfers/:id (from, to, note, requestedBy, dispatchedBy...)",
  "lines": [
    {
      "sku": {
        "code": "EVD-01-M-BLK"
      },
      "requested": 10,
      "dispatched": 10,
      "received": 9,
      "lost": 0,
      "onTheRoad": 1
    }
  ],
  "totals": {
    "requested": 10,
    "dispatched": 10,
    "received": 9,
    "lost": 0,
    "onTheRoad": 1
  }
}
```

**What the screen does**
- "Receive" dialog: for every line with `onTheRoad > 0` two number inputs, **Good** and **Damaged** (0 or more, sum at most `onTheRoad`, at least one line with a piece).
- Show "still on the way: N" under each line.
- Status becomes `partially_received` if something is left on the road, `received` if all arrived.

**Errors to handle**
- `409` "Only N are still on the way for this sku" (someone else received meanwhile: refresh).


#### `POST /transfers/:id/resolve`

Confirm that what never arrived is **lost**. It leaves the road and the transfer becomes `closed`.

**Who:** Admin, manager (not employee).

**Request**
```http
POST /transfers/ca223193-…/resolve
Idempotency-Key: <new random uuid for each action>

{
  "reason": "One piece lost by the courier"
}
```

**Response**
```http
200 OK

{
  "id": "ca223193-…",
  "reference": "T-00000001",
  "status": "closed",
  "...": "same fields as GET /transfers/:id (from, to, note, requestedBy, dispatchedBy...)",
  "lines": [
    {
      "sku": {
        "code": "EVD-01-M-BLK"
      },
      "requested": 10,
      "dispatched": 10,
      "received": 9,
      "lost": 1,
      "onTheRoad": 0
    }
  ],
  "totals": {
    "requested": 10,
    "dispatched": 10,
    "received": 9,
    "lost": 1,
    "onTheRoad": 0
  }
}
```

**What the screen does**
- Dialog with a **reason** (3 to 200 characters, required) and a warning "This cannot be undone".
- Only show it when `totals.onTheRoad > 0`.

**Errors to handle**
- `400` missing or short reason · `403` employee · `409` nothing on the road.


#### `POST /transfers/:id/cancel`

Cancel a draft. No body and no key. Asking again changes nothing.

**Who:** Admin, manager at the source.

**Request**
```http
POST /transfers/c050f279-…/cancel
```

**Response**
```http
200 OK

{
  "id": "c050f279-…",
  "reference": "T-00000002",
  "status": "cancelled",
  "...": "same fields as GET /transfers/:id (from, to, note, requestedBy, dispatchedBy...)",
  "lines": [
    {
      "sku": {
        "code": "EVD-01-M-BLK"
      },
      "requested": 3,
      "dispatched": 0,
      "received": 0,
      "lost": 0,
      "onTheRoad": 0
    }
  ],
  "totals": {
    "requested": 3,
    "dispatched": 0,
    "received": 0,
    "lost": 0,
    "onTheRoad": 0
  }
}
```

**Errors to handle**
- `409` once it has been sent.


### Transfer screens to build

1. **`/transfers`**: the list above, with a "New transfer" button (admin and manager).
2. **`/transfers/new`**: the form.
3. **`/transfers/[id]`**: detail with the action buttons and the Receive / Confirm lost dialogs.
4. A sidebar item "Transfers" for admin and manager, and "Receive" (the dispatched list for their branch) for employees.

---

## 6. P2: Stock of every place and "What to send"


#### `GET /stock/overview`

Every place side by side, for every sku: the warehouse first, then the branches. `belowMinimum` is true when `sellable + inTransit` is under the branch's minimum. Query: `search`, `styleId`, `activeOnly`, `limit`, `offset`.

**Who:** **Admin only** (`403` for others; a manager uses `GET /stock` for their branch).

**Request**
```http
GET /stock/overview?search=evening&limit=20
```

**Response**
```http
200 OK

{
  "locations": [
    {
      "id": "e9a3c398-…",
      "code": "WAREHOUSE",
      "name": "Main Warehouse",
      "kind": "warehouse"
    }
  ],
  "items": [
    {
      "sku": {
        "id": "ba8df1c9-…",
        "styleId": "cfbd2416-…",
        "skuCode": "EVD-01-M-BLK",
        "size": "M",
        "color": "Jet Black",
        "standardPrice": "95.00",
        "currency": "USD",
        "isActive": true,
        "createdAt": "2026-11-04T09:01:19.418Z",
        "updatedAt": "2026-11-04T09:01:19.504Z",
        "style": {
          "id": "cfbd2416-…",
          "code": "EVD-01",
          "name": "Evening Dress"
        }
      },
      "totals": {
        "sellable": 70,
        "nonSellable": 0,
        "inTransit": 0
      },
      "locations": [
        {
          "branchId": "e9a3c398-…",
          "sellable": 60,
          "nonSellable": 0,
          "inTransit": 0,
          "minQuantity": null,
          "targetQuantity": null,
          "belowMinimum": false
        }
      ]
    }
  ]
}
// (lists shortened to one item)
```

**What the screen does**
- A matrix: one row per sku, one column per place (warehouse column highlighted), **for sale**, with on hold and on the road as small badges.
- A red marker where `belowMinimum` is true; a total column.
- Match `items[i].locations[j].branchId` with the `locations` array at the top.


#### `GET /replenishment/suggestions`

What the warehouse should send. For each sku below its minimum: `suggested` = target (or minimum) minus what the branch has and what is already on the road; `warehouseSellable` = what the warehouse has; **`fillable`** = the smaller of the two (what it can really send now). Biggest need first. Query: `branchId` (optional).

**Who:** Admin (all branches) or manager (their branches).

**Request**
```http
GET /replenishment/suggestions?branchId=067e2225-…
```

**Response**
```http
200 OK

{
  "warehouse": {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse",
    "kind": "warehouse"
  },
  "suggestions": [
    {
      "branch": {
        "id": "067e2225-…",
        "code": "HAMRA",
        "name": "Hamra",
        "kind": "branch"
      },
      "sku": {
        "id": "90fc23ed-…",
        "code": "NK-CLUB-S-RED",
        "styleName": "Nike Club Tee",
        "size": "S",
        "color": "Red"
      },
      "sellable": 10,
      "inTransit": 0,
      "minQuantity": 12,
      "targetQuantity": 20,
      "suggested": 10,
      "warehouseSellable": 50,
      "fillable": 10
    }
  ]
}
```

**What the screen does**
- A table: branch, sku, has, on the road, minimum, **send** (`fillable`), warehouse has.
- A **"Prepare transfer"** button per branch: opens `/transfers/new` with from = `warehouse`, to = that branch and one line per row with `quantity = fillable` (skip rows with `fillable = 0`; show them as "warehouse is short").
- `warehouse` is `null` until a warehouse exists.


---

## 7. P3: Dashboard from the reports endpoints


#### `GET /reports/sales-summary`

One row per branch per shop day: number of sales, items, revenue, discounts, **cash and Whish split**, in-store vs social. Query: `branchId` (optional, otherwise every branch you reach), `from`, `to` (`YYYY-MM-DD`, default today, at most 366 days). The shop day is the Lebanese day.

**Who:** Admin (all branches) or manager (their branches). Not employees (`403`).

**Request**
```http
GET /reports/sales-summary?branchId=067e2225-…
```

**Response**
```http
200 OK

{
  "from": "2026-11-04",
  "to": "2026-11-04",
  "totals": {
    "salesCount": 1,
    "items": 2,
    "revenue": "190.00",
    "discounts": "0.00",
    "cash": "100.00",
    "whish": "90.00",
    "inStore": "190.00",
    "socialMedia": "0.00"
  },
  "rows": [
    {
      "day": "2026-11-04",
      "branch": {
        "id": "067e2225-…",
        "code": "HAMRA",
        "name": "Hamra",
        "kind": "branch"
      },
      "salesCount": 1,
      "items": 2,
      "revenue": "190.00",
      "discounts": "0.00",
      "cash": "100.00",
      "whish": "90.00",
      "inStore": "190.00",
      "socialMedia": "0.00"
    }
  ]
}
```

**What the screen does**
- Cards from `totals`: revenue, sales count, cash, Whish, discounts.
- A chart with `rows` (revenue per day per branch). Money values are strings: convert with your `money` helper only for display.
- Date range picker (default today).


#### `GET /reports/top-skus`

Best sellers by quantity, with revenue. Query: `branchId`, `from`, `to`, `limit` (1 to 100, default 10).

**Who:** Admin or manager.

**Request**
```http
GET /reports/top-skus?branchId=067e2225-…&limit=3
```

**Response**
```http
200 OK

{
  "from": "2026-11-04",
  "to": "2026-11-04",
  "rows": [
    {
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK",
        "styleName": "Evening Dress",
        "size": "M",
        "color": "Jet Black"
      },
      "quantity": 2,
      "revenue": "190.00",
      "salesCount": 1
    }
  ]
}
```

**What the screen does**
- A "Top sellers" list or bar chart.


---

## 8. P5: Minimum levels, movements, audit

The **minimum** is the stock a branch should keep of a sku; below it the warehouse is asked to send more. The warehouse has no minimum (`409`).


#### `GET /reorder-levels`

The minimums of one branch. Query: `branchId` (required), `search`, `limit`, `offset`.

**Who:** Admin; manager for their branches.

**Request**
```http
GET /reorder-levels?branchId=067e2225-…&limit=20
```

**Response**
```http
200 OK

[
  {
    "id": "2bc15bf2-…",
    "branchId": "067e2225-…",
    "sku": {
      "id": "ba8df1c9-…",
      "code": "EVD-01-M-BLK",
      "styleName": "Evening Dress",
      "size": "M",
      "color": "Jet Black"
    },
    "minQuantity": 12,
    "targetQuantity": 20,
    "updatedAt": "2026-11-04T09:01:20.024Z"
  }
]
// (lists shortened to one item)
```

**What the screen does**
- Table: sku, minimum, target, with inline edit.


#### `PUT /reorder-levels`

Set the minimum of one sku at one branch (replaces the old one). `targetQuantity` is optional and cannot be below `minQuantity`.

**Who:** Admin; manager for their branch.

**Request**
```http
PUT /reorder-levels

{
  "branchId": "067e2225-…",
  "skuId": "ba8df1c9-…",
  "minQuantity": 12,
  "targetQuantity": 20
}
```

**Response**
```http
200 OK

{
  "id": "2bc15bf2-…",
  "branchId": "067e2225-…",
  "sku": {
    "id": "ba8df1c9-…",
    "code": "EVD-01-M-BLK",
    "styleName": "Evening Dress",
    "size": "M",
    "color": "Jet Black"
  },
  "minQuantity": 12,
  "targetQuantity": 20,
  "updatedAt": "2026-11-04T09:01:20.024Z"
}
```

**What the screen does**
- Save on blur or Enter; `PUT` again to change.

**Errors to handle**
- `409` the place is the warehouse or inactive · `400` target below minimum.


#### `PUT /reorder-levels/by-style`

The same minimum for **every active size and colour** of a model at one branch.

**Who:** Admin; manager for their branch.

**Request**
```http
PUT /reorder-levels/by-style

{
  "branchId": "067e2225-…",
  "styleId": "cfbd2416-…",
  "minQuantity": 4
}
```

**Response**
```http
200 OK

{
  "styleId": "cfbd2416-…",
  "skus": 1
}
```

**What the screen does**
- A "Set for the whole model" action on the product page.

**Errors to handle**
- `409` the style has no active skus.


#### `DELETE /reorder-levels/:id`

Remove a minimum.

**Who:** Admin; manager for their branch.

**Request**
```http
DELETE /reorder-levels/2bc15bf2-…
```

**Response**
```http
204 No Content
```


#### `GET /stock/movements`

Everything that changed the stock of one place: who, when, what. Newest first. Query: `branchId` (required), `skuId`, `type` (`sale`, `opening`, `transfer_dispatch`, `transfer_receipt`, `transfer_resolution`), `from`, `to`, `limit`, `offset`.

**Who:** Admin; manager for their branches.

**Request**
```http
GET /stock/movements?branchId=067e2225-…&limit=5
```

**Response**
```http
200 OK

[
  {
    "id": "000ee118-…",
    "occurredAt": "2026-11-04T09:01:19.808Z",
    "type": "sale",
    "bucket": "sellable",
    "quantityDelta": -2,
    "balanceAfter": 10,
    "sku": {
      "id": "ba8df1c9-…",
      "code": "EVD-01-M-BLK"
    },
    "by": {
      "id": "76609ae9-…",
      "name": "Sara Employee"
    },
    "saleId": "b4aefa8b-…",
    "reason": null
  }
]
// (lists shortened to one item)
```

**What the screen does**
- A history table on the inventory item page. Negative `quantityDelta` = pieces left.


#### `GET /audit-events`

Who changed what: minimums, branches, transfers. Filters: `entityType`, `entityId`, `actorId`, `branchId`, `from`, `to`.

**Who:** **Admin only.**

**Request**
```http
GET /audit-events?limit=3
```

**Response**
```http
200 OK

[
  {
    "id": "d1fd7e3f-…",
    "occurredAt": "2026-11-04T09:01:20.141Z",
    "action": "reorder_level.delete",
    "entityType": "reorder_level",
    "entityId": "2bc15bf2-…",
    "branchId": "067e2225-…",
    "by": {
      "id": "a9639d7f-…",
      "name": "Karim Manager"
    },
    "details": {
      "skuId": "ba8df1c9-…",
      "before": {
        "min": 4,
        "target": null
      }
    }
  }
]
// (lists shortened to one item)
```

**What the screen does**
- An "Activity" page for the owner.


---

## 9. Errors you must show properly

A cashier or a storekeeper reads these on screen, so never show only "Request failed".


**Sale with not enough stock**
```http
POST /sales
Idempotency-Key: <new random uuid for each action>

{
  "branchId": "067e2225-…",
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "quantity": 500
    }
  ],
  "payments": [
    {
      "method": "cash",
      "amount": "47500.00"
    }
  ]
}

409 Conflict

{
  "message": "Not enough stock for one or more items",
  "details": [
    {
      "skuId": "ba8df1c9-…",
      "skuCode": "EVD-01-M-BLK",
      "requested": 500,
      "available": 18
    }
  ]
}
```


**Sale at the warehouse**
```http
POST /sales
Idempotency-Key: <new random uuid for each action>

{
  "branchId": "e9a3c398-…",
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "quantity": 1
    }
  ],
  "payments": [
    {
      "method": "cash",
      "amount": "95.00"
    }
  ]
}

409 Conflict

{
  "message": "The warehouse does not sell to customers: it supplies the branches"
}
```


**Receiving more than is on the road**
```http
POST /transfers/ca223193-…/receive
Idempotency-Key: <new random uuid for each action>

{
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "accepted": 1
    }
  ]
}

409 Conflict

{
  "message": "Only a transfer on the road can be received"
}
```


---

## 10. Demo flow to test end to end (the 3 minutes)

1. **Till:** an employee scans a dress and sells it, paying part in cash and part by Whish. Stock goes down once.
2. **Admin:** opens **Stock of every place**; a branch is marked below its minimum.
3. **Admin:** opens **What to send**, presses **Prepare transfer** (the form is pre-filled).
4. **Warehouse manager:** presses **Send**. The stock moves to "on the road".
5. **Branch employee:** opens the transfer and presses **Receive**: 8 good, 1 damaged. One piece is still on the road.
6. **Branch manager:** presses **Confirm lost** with a reason. The transfer is `closed`.
7. **Admin:** opens the **Dashboard** (sales per branch, cash vs Whish) and **Activity** (who did what).

Run it on the **public URL**, with realistic Lebanese data (Hamra, Jounieh, Tripoli; USD prices). Also try the wrong paths: empty input, a shortage, a retry after turning the network off.

## 11. Where to look

| You need | File |
|---|---|
| Every endpoint with request, response, errors | `API_REFERENCE.md` |
| Guide, rules, flows | `API_GUIDE.md` |
| Typed client and types to copy | `api.ts` |
| Try everything in Postman | `Bitar-API-JWT.postman_collection.json` |
| A real database with demo users | run `npm run seed:dev` on the backend (admin@bitar.test, manager@bitar.test, employee@bitar.test, password `Password#123`, **development only**) |

Questions about the API: ask Imad, with the request, the response and the status code.


---

## 12. Added on 1 Nov (after the first version of this file)

Everything here is in `API_REFERENCE.md` (57 endpoints) and `api.ts` (typed methods). Backend v0.9.

### 12.1 The "Warehouse not linked" error on the Transfers screen (employee at Saida)

**Why it happens.** `GET /branches` returns only the branches the user reaches, and an employee of Saida does not reach the warehouse. So the screen cannot find the warehouse id and says "Warehouse not linked on this device". The backend rule is right (a branch user must not see the warehouse's stock); the front just needs another way to learn which place is the warehouse.

**The fix.** Remove the guessing (the name pattern, `NEXT_PUBLIC_WAREHOUSE_BRANCH_ID`, `locations.service.ts`) and call:


**`GET /warehouse`** (any logged-in user; only id, code and name)

```http
GET /warehouse
```
```http
200 OK

{
  "id": "e9a3c398-…",
  "code": "WAREHOUSE",
  "name": "Main Warehouse"
}
```


**`POST /transfers`** (a branch asks the warehouse to restock it)

```http
POST /transfers
Idempotency-Key: <new random uuid for each action>

{
  "sourceBranchId": "e9a3c398-…",
  "destinationBranchId": "067e2225-…",
  "note": "Running low on dresses",
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "quantity": 6
    }
  ]
}
```
```http
201 Created

{
  "id": "19fa0563-…",
  "reference": "T-00000003",
  "status": "draft",
  "from": {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse",
    "kind": "warehouse"
  },
  "to": {
    "id": "067e2225-…",
    "code": "HAMRA",
    "name": "Hamra",
    "kind": "branch"
  },
  "note": "Running low on dresses",
  "requestedBy": {
    "id": "76609ae9-…",
    "name": "Sara Employee"
  },
  "requestedAt": "2026-11-04T09:01:20.824Z",
  "dispatchedBy": null,
  "dispatchedAt": null,
  "lines": [
    {
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK",
        "styleName": "Evening Dress",
        "size": "M",
        "color": "Jet Black"
      },
      "requested": 6,
      "dispatched": 0,
      "received": 0,
      "lost": 0,
      "onTheRoad": 0
    }
  ],
  "totals": {
    "requested": 6,
    "dispatched": 0,
    "received": 0,
    "lost": 0,
    "onTheRoad": 0
  }
}
```


**What changed on the backend for this.** An employee or manager can now prepare a transfer **from the warehouse to their own branch**: it is a **draft = a restock request**. Nothing moves. The warehouse (admin, or the warehouse's manager) reviews it and presses **Send**; the branch then **Receives** it. The person who asked can **Cancel** their own draft, but cannot send it. Between two places that are not theirs it is still `403`.

**Screen behaviour.** On submit call `POST /transfers` with `sourceBranchId` = `warehouse.id` and `destinationBranchId` = the user's branch. Show "Request sent" and link to `/transfers/[id]`. The "Details for the team" box goes in `note`. Use the usual `useIdempotencyKey`.

### 12.2 Categories (add, edit, delete)
A category is now a list the owner manages. A product can only use a category that exists; an unknown one is `400 This category does not exist: add it in Categories first`. Renaming a category renames it on every product. Deleting one that products still use is `409` ("N product(s) use this category"): offer "Deactivate" instead.

Screens: a **Categories** page (table: name, products, active; add, rename, deactivate, delete) and the product form's category field as a **select from `GET /categories?activeOnly=true`** (not free text). Allowed for manager and admin (`catalog.create`); employees only read.


#### `GET /categories`

The list, with how many products use each.

**Who:** Manager, admin (anyone can read).

**Request**
```http
GET /categories
```

**Response**
```http
200 OK

[
  {
    "id": "9489d1a8-…",
    "name": "Accessories",
    "isActive": true,
    "productCount": 1,
    "createdAt": "2026-11-04T09:01:09.181Z"
  },
  {
    "id": "f866d84f-…",
    "name": "Clothing",
    "isActive": true,
    "productCount": 3,
    "createdAt": "2026-11-04T09:01:09.154Z"
  }
]
// (lists shortened to one item)
```


#### `POST /categories`

Add one (the same name in another case is `409`).

**Who:** Manager, admin (anyone can read).

**Request**
```http
POST /categories

{
  "name": "Evening Wear"
}
```

**Response**
```http
201 Created

{
  "id": "216e1902-…",
  "name": "Evening Wear",
  "isActive": true,
  "productCount": 0,
  "createdAt": "2026-11-04T09:01:20.897Z"
}
```


#### `PATCH /categories/:id`

Rename or deactivate.

**Who:** Manager, admin (anyone can read).

**Request**
```http
PATCH /categories/216e1902-…

{
  "name": "Evening & Party"
}
```

**Response**
```http
200 OK

{
  "id": "216e1902-…",
  "name": "Evening & Party",
  "isActive": true,
  "productCount": 0,
  "createdAt": "2026-11-04T09:01:20.897Z"
}
```


#### `DELETE /categories/:id`

Delete one that no product uses.

**Who:** Manager, admin (anyone can read).

**Request**
```http
DELETE /categories/3b15137c-…
```

**Response**
```http
204 No Content
```


### 12.3 Deleting: products, branches, users
A delete is allowed **only when nothing in the history points at the thing**. Otherwise the server answers `409` with a message that says "archive it instead" or "deactivate it instead", and **nothing is deleted**. In the UI: a confirm dialog; on `409` show the server message and offer the alternative (`PATCH` with `isActive: false`).

| Call | Who | Notes |
|---|---|---|
| `DELETE /styles/:id` | manager, admin | deletes its skus, barcodes and price history too, if none was ever sold, moved or transferred |
| `DELETE /skus/:id` | manager, admin | same rule |
| `DELETE /branches/:id` | admin | refused if it has sales, stock, transfers or recorded changes |
| `DELETE /users/:id` | admin | a **soft delete**: the user disappears from the list and cannot log in, but **everything they did stays** with their name. Not yourself (`409`), not the last active admin (`409`) |

All answer `204`. A deactivated user or branch (`isActive: false`) can be turned back on; a deleted user cannot.


```http
DELETE /styles/b041572c-…

204 No Content
```


```http
DELETE /branches/8b2c67c9-…

204 No Content
```


```http
DELETE /skus/ba8df1c9-…

409 Conflict

{
  "message": "This product has history (sales, stock or transfers): archive it instead (isActive: false)"
}
```


```http
DELETE /branches/067e2225-…

409 Conflict

{
  "message": "This place has history (sales, stock, transfers or recorded changes): deactivate it instead (isActive: false)"
}
```


```http
POST /styles

{
  "code": "BAD-CAT",
  "name": "Bad category",
  "category": "Not in the list"
}

400 Bad Request

{
  "message": "This category does not exist: add it in Categories first"
}
```


### 12.4 Sales history (today, last week, last year)
One screen **Sales history**: quick filters **Today, Yesterday, Last 7 days, This month, Last 12 months** and a custom range, a branch picker (the admin may pick "All branches"; anyone else sees only their own), a table, and "Load more" using `X-Total-Count`. The seller keeps their name even after their account is deleted. For totals and charts keep using `GET /reports/sales-summary`.


#### `GET /sales/history`

Every sale of a period for the branches you reach, newest first, with the cash and Whish split. Query: `branchId` (optional), `from`, `to` (`YYYY-MM-DD`, Lebanese shop day, at most 366 days; with only `from` you get that one day), `limit`, `offset`. The whole count is in `X-Total-Count`.

**Who:** Any logged-in user (admin: every branch; others: their branches).

**Request**
```http
GET /sales/history?branchId=067e2225-…&from=2026-10-01&to=2026-11-30&limit=2
```

**Response**
```http
200 OK
x-total-count: 1

{
  "from": "2026-10-01",
  "to": "2026-11-30",
  "sales": [
    {
      "id": "b4aefa8b-…",
      "reference": "S-00000001",
      "branch": {
        "id": "067e2225-…",
        "code": "HAMRA",
        "name": "Hamra"
      },
      "soldAt": "2026-11-04T09:01:19.785Z",
      "businessDate": "2026-11-04",
      "soldBy": {
        "id": "76609ae9-…",
        "name": "Sara Employee"
      },
      "status": "completed",
      "channel": "in_store",
      "items": 2,
      "total": "190.00",
      "discounts": "0.00",
      "cash": "100.00",
      "whish": "90.00"
    }
  ]
}
```

**What the screen does**
- Click a row to open `GET /sales/:id` (the receipt).

**Errors to handle**
- `403` a branch you do not reach · `400` bad dates or range over 366 days.


### 12.5 Permissions of one user (the new-user screen)
The **admin** can give a manager or an employee a **specific permission** on top of their role, or take one away: for example an **employee who may create products**. A **manager** can do the same for the **employees of their own branches**, but only with permissions the manager has too. The role stays the base (the employee is still an employee).

**Screen "New user" / "Edit user" (admin, and manager for their employees):** after name, email and role, a **Permissions** card: one checkbox per permission from `GET /permissions` (the `label` as the text, the `description` as the hint). Show the role's defaults ticked. Do not offer the ones with `grantable: false` (Manage users). Save in two calls: `POST /users`, then `PUT /users/:id/permissions` with only what changed. When editing, load the current state from `GET /users/:id/permissions` (`allowed` tells if the box is ticked, `source` says why: show a small badge "from role", "added", "removed").

It takes effect on the user's **next request**: no logout needed. A user whose permission was taken away will get `403` on the next call, so the screens should still handle `403` gracefully.


#### `GET /permissions`

Every permission with its words, whether it can be granted, and what each role has by default.

**Who:** Admin (managers and employees), or a manager (the employees of their own branches only).

**Request**
```http
GET /permissions
```

**Response**
```http
200 OK

{
  "permissions": [
    {
      "key": "sales.create",
      "label": "Sell at the till",
      "description": "Make sales at the branches they reach.",
      "grantable": true
    },
    {
      "key": "discounts.apply",
      "label": "Give discounts",
      "description": "Percent discounts and price overrides on a sale, with a reason.",
      "grantable": true
    }
  ],
  "roles": {
    "admin": [
      "sales.create",
      "discounts.apply"
    ],
    "manager": [
      "sales.create",
      "transfers.receive"
    ],
    "employee": [
      "sales.create",
      "transfers.receive"
    ]
  }
}
// (lists shortened to one item)
```


#### `PUT /users/:id/permissions`

Set the state you want for the permissions you list (`true` can, `false` cannot). The server keeps only what differs from the role. Send only what changed.

**Who:** Admin (managers and employees), or a manager (the employees of their own branches only).

**Request**
```http
PUT /users/061487bc-…/permissions

{
  "permissions": {
    "catalog.create": true,
    "adjustments.create": true
  }
}
```

**Response**
```http
200 OK

{
  "user": {
    "id": "061487bc-…",
    "fullName": "Rami Storekeeper",
    "role": "employee",
    "isActive": true
  },
  "permissions": [
    {
      "key": "sales.create",
      "label": "Sell at the till",
      "description": "Make sales at the branches they reach.",
      "allowed": true,
      "source": "role"
    },
    {
      "key": "discounts.apply",
      "label": "Give discounts",
      "description": "Percent discounts and price overrides on a sale, with a reason.",
      "allowed": false,
      "source": "none"
    }
  ],
  "overrides": [
    {
      "permission": "adjustments.create",
      "effect": "allow"
    },
    {
      "permission": "catalog.create",
      "effect": "allow"
    }
  ]
}
// (lists shortened to one item)
```

**Errors to handle**
- `409` yourself or an admin · `403` a manager on a manager or an admin, or giving a permission the manager does not have · `404` an employee of other branches · `400` an unknown key, `users.administer`, or a value that is not true or false.


#### `GET /users/:id/permissions`

What one user can do, and why (`source`: `role`, `granted`, `denied`, `none`).

**Who:** Admin (managers and employees), or a manager (the employees of their own branches only).

**Request**
```http
GET /users/061487bc-…/permissions
```

**Response**
```http
200 OK

{
  "user": {
    "id": "061487bc-…",
    "fullName": "Rami Storekeeper",
    "role": "employee",
    "isActive": true
  },
  "permissions": [
    {
      "key": "sales.create",
      "label": "Sell at the till",
      "description": "Make sales at the branches they reach.",
      "allowed": true,
      "source": "role"
    },
    {
      "key": "discounts.apply",
      "label": "Give discounts",
      "description": "Percent discounts and price overrides on a sale, with a reason.",
      "allowed": false,
      "source": "none"
    }
  ],
  "overrides": [
    {
      "permission": "adjustments.create",
      "effect": "allow"
    },
    {
      "permission": "catalog.create",
      "effect": "allow"
    }
  ]
}
// (lists shortened to one item)
```


### 12.6 A manager appointed to every branch
The owner's managers move between branches (Saida, Tripoli, Hamra...), so the admin can appoint a manager to **all branches** instead of ticking them one by one. Branches opened later are included automatically. The warehouse is **not** included: it is granted on its own.

On the new-user / edit-user screen (admin), for a manager: a **Branch access** switch: **All branches** or **Selected branches** (then the usual list from `PUT /users/:id/branches/:branchId`). The user's real branches always come from `GET /auth/me` (`branchIds`), so the screens do not change.


#### `PUT /users/:id/branch-access`

`{ "mode": "all" }` appoints a manager to every branch; `{ "mode": "selected" }` goes back to the list.

**Who:** Admin only.

**Request**
```http
PUT /users/7706faf3-…/branch-access

{
  "mode": "all"
}
```

**Response**
```http
200 OK

{
  "userId": "7706faf3-…",
  "mode": "all",
  "branchIds": []
}
```

**Errors to handle**
- `409` an employee (cannot be appointed to all) or an admin · `400` a mode that is not `all` or `selected`.


#### `GET /users/:id/branch-access`

Which mode, and the branches granted one by one.

**Who:** Admin only.

**Request**
```http
GET /users/7706faf3-…/branch-access
```

**Response**
```http
200 OK

{
  "userId": "7706faf3-…",
  "mode": "all",
  "branchIds": []
}
```


### 12.7 Stock adjustments (count corrections, damaged, lost, found)
A manager or the admin can correct the stock of one sku at one place without a sale or a transfer: the shelf count does not match, a piece is damaged or lost, a piece was found. **A reason and a note are always required**, and an adjustment can never be edited or deleted (a mistake is corrected with another adjustment). It is written to the ledger and the audit log with who did it.

**Screen "Adjust stock"** (admin and managers; also an employee if the admin gave them the permission **Manage stock**): on the inventory item row an **Adjust** button that opens a dialog:
- **Reason** (select): *Count correction*, *Data entry error*, *Other* (add or remove) · *Found* (adds) · *Loss* (removes) · *Damage* (removes).
- **Quantity**: a number, with a plus or minus depending on the reason (hide the sign for *Found*, *Loss* and *Damage*: the reason already says it). Show "Now: N" and "After: N + delta".
- **Where**: *For sale* (default) or *On hold*. The pieces **on the road** cannot be adjusted here.
- **Note** (required, 5 to 200 characters): "Counted 8 on the shelf, the system had 10".
- *Damage* from *For sale* moves the pieces **on hold** (say so in the dialog: "These pieces go on hold, they are not deleted"). Written off when taken from *On hold*.
One `Idempotency-Key` per submit (`useIdempotencyKey`). On `409` show the item with *asked* and *available*. A history tab ("Adjustments") from `GET /stock/adjustments`.


**`POST /stock/adjustments`**

```http
POST /stock/adjustments
Idempotency-Key: <new random uuid for each action>

{
  "branchId": "067e2225-…",
  "skuId": "ba8df1c9-…",
  "quantityDelta": -2,
  "reason": "count_correction",
  "note": "Counted 8 on the shelf, the system had 10"
}
```
```http
201 Created

{
  "id": "11fa1c1a-…",
  "reference": "A-00000001",
  "branch": {
    "id": "067e2225-…",
    "code": "HAMRA",
    "name": "Hamra"
  },
  "sku": {
    "id": "ba8df1c9-…",
    "code": "EVD-01-M-BLK",
    "styleName": "Evening Dress",
    "size": "M",
    "color": "Jet Black"
  },
  "bucket": "sellable",
  "quantityDelta": -2,
  "reason": "count_correction",
  "note": "Counted 8 on the shelf, the system had 10",
  "by": {
    "id": "a9639d7f-…",
    "name": "Karim Manager"
  },
  "createdAt": "2026-11-04T09:01:21.853Z",
  "balanceAfter": 16
}
```


**`POST /stock/adjustments (damage: the pieces go on hold)`**

```http
POST /stock/adjustments
Idempotency-Key: <new random uuid for each action>

{
  "branchId": "067e2225-…",
  "skuId": "ba8df1c9-…",
  "quantityDelta": -1,
  "reason": "damage",
  "note": "Torn at the seam, moved to hold"
}
```
```http
201 Created

{
  "id": "3920c15c-…",
  "reference": "A-00000002",
  "branch": {
    "id": "067e2225-…",
    "code": "HAMRA",
    "name": "Hamra"
  },
  "sku": {
    "id": "ba8df1c9-…",
    "code": "EVD-01-M-BLK",
    "styleName": "Evening Dress",
    "size": "M",
    "color": "Jet Black"
  },
  "bucket": "sellable",
  "quantityDelta": -1,
  "reason": "damage",
  "note": "Torn at the seam, moved to hold",
  "by": {
    "id": "a9639d7f-…",
    "name": "Karim Manager"
  },
  "createdAt": "2026-11-04T09:01:21.886Z",
  "balanceAfter": 15
}
```


**`GET /stock/adjustments`**

```http
GET /stock/adjustments?branchId=067e2225-…&limit=2
```
```http
200 OK
x-total-count: 2

[
  {
    "id": "3920c15c-…",
    "reference": "A-00000002",
    "branch": {
      "id": "067e2225-…",
      "code": "HAMRA",
      "name": "Hamra"
    },
    "sku": {
      "id": "ba8df1c9-…",
      "code": "EVD-01-M-BLK",
      "styleName": "Evening Dress",
      "size": "M",
      "color": "Jet Black"
    },
    "bucket": "sellable",
    "quantityDelta": -1,
    "reason": "damage",
    "note": "Torn at the seam, moved to hold",
    "by": {
      "id": "a9639d7f-…",
      "name": "Karim Manager"
    },
    "createdAt": "2026-11-04T09:01:21.886Z",
    "balanceAfter": 15
  },
  {
    "id": "11fa1c1a-…",
    "reference": "A-00000001",
    "branch": {
      "id": "067e2225-…",
      "code": "HAMRA",
      "name": "Hamra"
    },
    "sku": {
      "id": "ba8df1c9-…",
      "code": "EVD-01-M-BLK",
      "styleName": "Evening Dress",
      "size": "M",
      "color": "Jet Black"
    },
    "bucket": "sellable",
    "quantityDelta": -2,
    "reason": "count_correction",
    "note": "Counted 8 on the shelf, the system had 10",
    "by": {
      "id": "a9639d7f-…",
      "name": "Karim Manager"
    },
    "createdAt": "2026-11-04T09:01:21.853Z",
    "balanceAfter": 16
  }
]
```


**Errors to handle:** `409` not enough stock (with `details`) · `400` a wrong reason, a wrong sign (`found` adds, `loss` and `damage` remove), a short note · `403` an employee without the permission, or a place that is not theirs · `404` unknown sku or place.


### 12.8 The transfer form: "from" and "to" depend on what the user may do
A branch user does **not** see the other branches in `GET /branches` (only their own), so the form needs `GET /places` for the destinations. The form depends on the permissions in `/auth/me`:

| The user has | "From" | "To" | What it means |
|---|---|---|---|
| `transfers.dispatch` (admin, manager, or an employee the admin allowed) | their places (`GET /branches`; the admin: all) | `GET /places` except "From" | They **send** stock |
| only `transfers.receive` (a normal employee) | **fixed**: the warehouse (`GET /warehouse`) | **fixed**: their branch | A **restock request**: no choice to show, just the products and a note |

So an employee who was given the permission to send must see **both** "From" and "To". Also a manager sending stock back to the warehouse or to another branch needs `GET /places`.


#### `GET /places`

Every active place: `id`, `code`, `name`, `kind` only, the warehouse first. Nothing about stock.

**Who:** Anyone with `transfers.dispatch` or `transfers.receive`.

**Request**
```http
GET /places
```

**Response**
```http
200 OK

[
  {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse",
    "kind": "warehouse"
  },
  {
    "id": "067e2225-…",
    "code": "HAMRA",
    "name": "Hamra",
    "kind": "branch"
  },
  {
    "id": "f2b2b48e-…",
    "code": "JOUNIEH",
    "name": "Jounieh Kaslik",
    "kind": "branch"
  }
]
// (lists shortened to one item)
```

**Errors to handle**
- `403` with neither permission.


### 12.9 Goods receipt: a delivery from a supplier into the warehouse
When a supplier delivers, the warehouse keeper enters **one document** for the supplier's invoice instead of adding products one by one. The document keeps the **supplier name**, the **supplier's invoice number**, its **date**, and for each product the **quantity** and the **price paid per piece**. The warehouse stock grows from it in the same transaction. It cannot be edited or deleted afterwards (a mistake is corrected with a stock adjustment).

**Opening stock stays for the first count only** (when the system starts). Every delivery after that is a goods receipt.

**Screen "Receive goods"** (admin, and a manager who reaches the warehouse):
- Header: **Supplier** (free text), **Invoice number**, **Invoice date** (default today, not in the future), optional **Note**.
- A product table: search or scan a product, then **Quantity** and **Price per piece**. Show the **line total** and the **invoice total** while typing (the server computes the real total).
- A product that does not exist yet must be created first (`POST /styles` then `POST /skus`), then received: offer "Add a new product" inside this screen (two calls, then back to the table).
- One `Idempotency-Key` per submit (`useIdempotencyKey`). On `409` "This supplier invoice was already received as GR-..." show the message: it is a double entry.
- A **history** page: `GET /goods-receipts` with filters (supplier, invoice number, dates) and "Load more"; click a row for `GET /goods-receipts/:id` (all the lines).


#### `POST /goods-receipts`

Receive a delivery. The warehouse stock grows by every line (for sale).

**Who:** Admin, or a manager who reaches the warehouse.

**Request**
```http
POST /goods-receipts
Idempotency-Key: <new random uuid for each action>

{
  "supplierName": "Textile Co",
  "supplierInvoiceNumber": "INV-2041",
  "invoiceDate": "2026-11-01",
  "note": "First delivery of the winter collection",
  "lines": [
    {
      "skuId": "bb88512e-…",
      "quantity": 20,
      "unitCost": "12.50"
    },
    {
      "skuId": "ba8df1c9-…",
      "quantity": 30,
      "unitCost": "8.00"
    }
  ]
}
```

**Response**
```http
201 Created

{
  "id": "c791fa36-…",
  "reference": "GR-00000001",
  "warehouse": {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse"
  },
  "supplierName": "Textile Co",
  "supplierInvoiceNumber": "INV-2041",
  "invoiceDate": "2026-11-01",
  "currency": "USD",
  "note": "First delivery of the winter collection",
  "totalCost": "490.00",
  "receivedBy": {
    "id": "a404d402-…",
    "name": "Admin"
  },
  "createdAt": "2026-11-04T09:01:22.131Z",
  "lineCount": 2,
  "totalQuantity": 50,
  "lines": [
    {
      "sku": {
        "id": "bb88512e-…",
        "code": "CAP-BASIC-ONESIZE-BLACK",
        "styleName": "Basic Cap",
        "size": "One size",
        "color": "Black"
      },
      "quantity": 20,
      "unitCost": "12.50",
      "lineTotal": "250.00"
    },
    {
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK",
        "styleName": "Evening Dress",
        "size": "M",
        "color": "Jet Black"
      },
      "quantity": 30,
      "unitCost": "8.00",
      "lineTotal": "240.00"
    }
  ]
}
```

**Errors to handle**
- `409` the same supplier invoice again (the message gives the first reference), or an archived product · `404` an unknown product · `403` a branch manager or an employee · `400` a wrong field.


#### `GET /goods-receipts`

The history: a summary of each document, newest first. Filters: `supplier`, `invoiceNumber`, `skuId`, `from`, `to` (the date on the invoice), `limit`, `offset`. The whole count is in `X-Total-Count`.

**Who:** Admin, or a manager who reaches the warehouse.

**Request**
```http
GET /goods-receipts?supplier=textile&limit=5
```

**Response**
```http
200 OK
x-total-count: 1

[
  {
    "id": "c791fa36-…",
    "reference": "GR-00000001",
    "warehouse": {
      "id": "e9a3c398-…",
      "code": "WAREHOUSE",
      "name": "Main Warehouse"
    },
    "supplierName": "Textile Co",
    "supplierInvoiceNumber": "INV-2041",
    "invoiceDate": "2026-11-01",
    "currency": "USD",
    "note": "First delivery of the winter collection",
    "totalCost": "490.00",
    "receivedBy": {
      "id": "a404d402-…",
      "name": "Admin"
    },
    "createdAt": "2026-11-04T09:01:22.131Z",
    "lineCount": 2,
    "totalQuantity": 50
  }
]
```


#### `GET /goods-receipts/:id`

One document with all its lines.

**Who:** Admin, or a manager who reaches the warehouse.

**Request**
```http
GET /goods-receipts/c791fa36-…
```

**Response**
```http
200 OK

{
  "id": "c791fa36-…",
  "reference": "GR-00000001",
  "warehouse": {
    "id": "e9a3c398-…",
    "code": "WAREHOUSE",
    "name": "Main Warehouse"
  },
  "supplierName": "Textile Co",
  "supplierInvoiceNumber": "INV-2041",
  "invoiceDate": "2026-11-01",
  "currency": "USD",
  "note": "First delivery of the winter collection",
  "totalCost": "490.00",
  "receivedBy": {
    "id": "a404d402-…",
    "name": "Admin"
  },
  "createdAt": "2026-11-04T09:01:22.131Z",
  "lineCount": 2,
  "totalQuantity": 50,
  "lines": [
    {
      "sku": {
        "id": "bb88512e-…",
        "code": "CAP-BASIC-ONESIZE-BLACK",
        "styleName": "Basic Cap",
        "size": "One size",
        "color": "Black"
      },
      "quantity": 20,
      "unitCost": "12.50",
      "lineTotal": "250.00"
    },
    {
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK",
        "styleName": "Evening Dress",
        "size": "M",
        "color": "Jet Black"
      },
      "quantity": 30,
      "unitCost": "8.00",
      "lineTotal": "240.00"
    }
  ]
}
```


```http
POST /goods-receipts
Idempotency-Key: <new random uuid for each action>

{
  "supplierName": "TEXTILE CO",
  "supplierInvoiceNumber": "inv-2041",
  "lines": [
    {
      "skuId": "bb88512e-…",
      "quantity": 1,
      "unitCost": "1.00"
    }
  ]
}

409 Conflict

{
  "message": "This supplier invoice was already received as GR-00000001"
}
```


### 12.10 Invoices: the supply invoice (B2B) and the invoice of a sale (B2C)
Two kinds of invoice, one set of endpoints.

| | **Supply invoice (B2B)** | **Invoice of a sale (B2C)** |
|---|---|---|
| What | The warehouse invoices a branch for a transfer that was **sent** | The invoice of a customer's sale |
| Made from | `transferId` | `saleId` |
| Who | Admin, or a manager who reaches the warehouse | The cashier (or anyone with `sales.create`) at the branch where it was sold |
| Starts as | a **draft** (no number): its **prices can be adjusted** | **final at once** (numbered, locked) |
| Customer | the branch | **name and phone, both optional** (empty = "Walk-in customer") |
| PDF | yes | yes, with how it was paid (cash, Whish) |

**Draft, final, void.** A draft has no number and its prices can change. **Finalize** gives it the number `B2B-00000001` and locks it for ever (the database refuses any change). A mistake is **voided** (it stays, marked VOID, with the reason) and a new invoice can be made for the same transfer or sale. Only a draft can be deleted. There is **one live invoice per transfer and per sale**.

**Screens**
1. **On a sent transfer** (warehouse side): a button **"Make supply invoice"** (`POST /invoices` with `transferId`). It opens the draft: a table of products with **Quantity** (fixed, what was sent) and **Price** (editable, starts at the catalog price), the total, a note. **Save prices** (`PATCH`), **Finalize** (`POST .../finalize`), **Delete draft**, **Download PDF**. After finalizing show the number and the PDF button; add **Void** (asks a reason) for the admin and managers.
2. **On a sale** (till or sales history): a button **"Invoice"** opens a small form: customer name (optional), phone (optional) and **Create** (`POST /invoices` with `saleId`). Then open the PDF. If the sale already has an invoice (`409`), show it instead: find it with `GET /invoices?search=<the sale number>`.
3. **Invoices page**: `GET /invoices` with filters (kind, status, dates, search by number or customer), "Load more" with `X-Total-Count`; a row opens the invoice.
4. The branch that **receives** the supply sees the invoice too (read, PDF) but cannot edit or finalize it.

**The PDF needs the token**, so a plain link does not work. Fetch it and show or save the blob:
```ts
const response = await fetch(`${API_URL}/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
if (!response.ok) throw new Error('Could not load the invoice')
const url = URL.createObjectURL(await response.blob())
window.open(url, '_blank')            // or: a download link with the file name = the invoice reference
```
(`api.ts` has `downloadInvoicePdf(id)` that returns the blob.)

**Which price?** A supply invoice starts from the catalog price. Which price the owner wants between the warehouse and a branch is still to be confirmed with him: the draft lets the warehouse set it.


**`POST /invoices`** (a supply invoice from a transfer that was sent: a draft)

```http
POST /invoices

{
  "transferId": "ca223193-…",
  "note": "Winter collection"
}

201 Created

{
  "id": "7a9fae3c-…",
  "kind": "b2b",
  "status": "draft",
  "reference": null,
  "issuer": {
    "id": "e9a3c398-…",
    "name": "Main Warehouse"
  },
  "recipient": {
    "branchId": "067e2225-…",
    "name": "Hamra",
    "phone": null
  },
  "transfer": {
    "id": "ca223193-…",
    "reference": "T-00000001"
  },
  "sale": null,
  "currency": "USD",
  "subtotal": "950.00",
  "discountTotal": "0.00",
  "total": "950.00",
  "note": "Winter collection",
  "issuedBy": {
    "id": "a404d402-…",
    "name": "Admin"
  },
  "createdAt": "2026-11-04T09:01:22.212Z",
  "finalizedAt": null,
  "voided": null,
  "lineCount": 1,
  "lines": [
    {
      "lineNo": 1,
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK"
      },
      "description": "Evening Dress, M, Jet Black",
      "quantity": 10,
      "unitPrice": "95.00",
      "discount": "0.00",
      "lineTotal": "950.00"
    }
  ],
  "payments": []
}
```


**`PATCH /invoices/:id`** (adjust the prices of the draft)

```http
PATCH /invoices/7a9fae3c-…

{
  "lines": [
    {
      "skuId": "ba8df1c9-…",
      "unitPrice": "80.00"
    }
  ],
  "note": "Agreed price for the opening"
}
```


**`POST /invoices/:id/finalize`** (it gets its number and is locked)

```http
POST /invoices/7a9fae3c-…/finalize
```


**`POST /invoices` for a sale** (final at once, the customer is optional)

```http
POST /invoices

{
  "saleId": "b4aefa8b-…",
  "customerName": "Rami Khoury",
  "customerPhone": "+961 3 123 456"
}

201 Created

{
  "id": "b15ce834-…",
  "kind": "b2c",
  "status": "final",
  "reference": "B2C-00000001",
  "issuer": {
    "id": "067e2225-…",
    "name": "Hamra"
  },
  "recipient": {
    "branchId": null,
    "name": "Rami Khoury",
    "phone": "+961 3 123 456"
  },
  "transfer": null,
  "sale": {
    "id": "b4aefa8b-…",
    "reference": "S-00000001"
  },
  "currency": "USD",
  "subtotal": "190.00",
  "discountTotal": "0.00",
  "total": "190.00",
  "note": null,
  "issuedBy": {
    "id": "76609ae9-…",
    "name": "Sara Employee"
  },
  "createdAt": "2026-11-04T09:01:22.305Z",
  "finalizedAt": "2026-11-04T09:01:22.301Z",
  "voided": null,
  "lineCount": 1,
  "lines": [
    {
      "lineNo": 1,
      "sku": {
        "id": "ba8df1c9-…",
        "code": "EVD-01-M-BLK"
      },
      "description": "Evening Dress, M, Jet Black",
      "quantity": 2,
      "unitPrice": "95.00",
      "discount": "0.00",
      "lineTotal": "190.00"
    }
  ],
  "payments": [
    {
      "method": "cash",
      "amount": "100.00",
      "reference": null
    },
    {
      "method": "whish",
      "amount": "90.00",
      "reference": "WH-88421"
    }
  ]
}
```


**`POST /invoices/:id/void`**

```http
POST /invoices/7a9fae3c-…/void

{
  "reason": "Wrong price on the dresses"
}
```


**`GET /invoices/:id/pdf`**

```http
GET /invoices/b15ce834-…/pdf

200 OK
content-type: application/pdf
content-disposition: inline; filename="B2C-00000001.pdf"

"(the PDF file itself, 22643 bytes, it starts with %PDF-1.3)"
```


```http
POST /invoices

{
  "transferId": "ca223193-…"
}

409 Conflict

{
  "message": "This transfer already has a draft invoice (id 7a9fae3c-cd09-4119-bf59-6058de35bf6f): edit it, finalize it or delete it"
}
```


### 12.11 What is NOT built yet (do not build UI for it)
A separate **super admin** role (for IT and maintenance) is being designed with the owner's rules. Until then there are three roles: admin, manager, employee.
