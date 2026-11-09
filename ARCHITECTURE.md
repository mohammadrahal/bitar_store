# Bitar Fashion — Architecture and API status

The companion to `README.md`. The README is the guide to running and working in
the app; this file records **what the dashboard shows, where each figure comes
from, and what the backend does not answer yet**.

Section 9 is the one to read before adding a widget: if the data is not there,
the widget is hidden and the missing route is written down here rather than
stubbed with a zero. Section 10 is the exception that proves the rule — the one
place a record is kept locally, and what that costs.

---

## 1. Layers

Data flows one way. A component never calls `fetch` and never reads a store
directly.

```
Component ──► hook (TanStack Query) ──► service ──► lib/api client ──► backend
                                            └─► catalog mirror (mocks/store.ts)
```

| Layer | Folder | Responsibility |
|---|---|---|
| Pages | `app/` | Routes. Server components rendering one client view. |
| Components | `components/` | UI only. Data via hooks, access via `<Can>` / `usePermission()`. |
| Hooks | `hooks/` | `useQuery` / `useMutation`, keyed from `lib/query-keys.ts`. |
| Services | `services/` | The only layer that talks to the API client. |
| API client | `lib/api/` | Typed calls, bearer token, `ApiError`. |
| Permissions | `lib/permissions.ts` | `can(user, permission, locationId?)`. |

Rules that have teeth:

- **Query keys** live in `lib/query-keys.ts`. Nothing builds a key inline.
- **Permissions** live in `lib/permissions.ts` and `lib/api-access.ts`.
  Components never compare roles.
- **Capability probing** lives in `lib/api/capabilities.ts`. Routes that older
  servers answer `404` for are probed once after sign-in, and the screens that
  need them hide instead of erroring.

---

## 2. The overview, band by band

`/dashboard` and a branch page both render `components/dashboard/overview-body.tsx`,
so the owner and a branch manager read the same figures the same way.

| Band | Component | Source |
|---|---|---|
| Needs attention | `needs-attention.tsx` | `GET /transfers` + computed stock health |
| KPI row | `kpi-row.tsx` | `GET /reports/sales-summary`, `GET /dashboard/overview`, stock health |
| Revenue by day / mix | `charts-row.tsx` | `GET /reports/sales-summary` |
| Recent sales | `recent-sales.tsx` | `GET /sales/history`, falling back to `GET /sales` |
| Best sellers | `best-sellers-list.tsx` | `GET /reports/top-skus` |

One range control (7 / 30 / 90 days) governs every time-dependent figure on the
page and says so in the band heading. The two stock counts are deliberately
outside it and say "right now" on their faces: a count of what is empty on a
shelf has no meaning averaged over ninety days.

---

## 3. Counting stock: why the server's figure is not used

`GET /dashboard/overview` returns `stock.outOfStock` as a count of
**variant-and-location pairs**. On the reference dataset that is `6,524` for a
catalog of `225` active SKUs across `29` locations — a number larger than the
catalog, which cannot be read as "how many things are we out of".

`services/stock-health.service.ts` answers the question a shopkeeper asks
instead, in **variants**:

| Figure | Meaning | On the reference dataset |
|---|---|---|
| `outOfStock` | Variants with nothing sellable anywhere in scope | 34 |
| `outElsewhere` | Sellable somewhere, but empty at a location that carries it | 11 |
| `lowStock` | Under its minimum at one or more locations | 1 |
| `variantCount` | Variants the counts were taken over | 225 |

`outOfStock` can never exceed `variantCount` by construction. A location
"carries" a variant when it holds units of it **or** has a minimum set for it,
which is what stops 29 branches that have never stocked an item from each
reporting it as a miss.

Two read paths:

- **Admin** — one paged sweep of `GET /stock/overview`, which carries every
  location's balances and its minimum, including the server's own
  `belowMinimum` (it counts stock already in transit, so a branch is not asked
  to restock twice).
- **Manager / employee** — `GET /stock` per location in scope, plus
  `GET /reorder-levels` for the thresholds, with the variant list taken from the
  catalog mirror: a location reports no row at all for something it has never
  held, and those are exactly the variants that are out.

`minimumsKnown` is `false` when no minimum could be read (a `403`, or the
warehouse's `409`). The low-stock figures then hide rather than show a zero that
would read as good news.

---

## 4. Screens

| Screen | What it does |
|---|---|
| `/dashboard` | The overview above, across every location in scope |
| `/branches`, `/branches/<code>` | Locations; one location's overview and stock |
| `/inventory`, `/inventory/<sku>` | Stock by variant with its balances; one variant across locations |
| `/products`, `/products/new`, `/products/<id>` | Models, colours and sizes, per-SKU prices and barcodes |
| `/categories` | The category list a product must choose from |
| `/sales/new` | The till |
| `/sales/invoices` | B2B wholesale invoices with cash / Whish payment (browser-local until the documents API ships) |
| `/sales/history`, `/sales/<id>` | Completed sales and one receipt |
| `/transfers`, `/transfers/new`, `/transfers/<id>` | Stock moving between locations; receiving |
| `/replenishment`, `/reorder-levels`, `/stock-network` | What to send, branch minimums, stock everywhere |
| `/opening-stock` | First units at a location |
| `/stock-receipts`, `/stock-receipts/new`, `/stock-receipts/<id>` | Supplier deliveries booked in, and every correction the server holds (section 10) |
| `/users`, `/account` | Accounts and your own account |
 `/reports`, `/audit` | Sales summary and top SKUs; the audit log |
| `/settings` | Store-wide currency and rules (Super Admin) |

`/inventory` takes `?filter=` (`all`, `low`, `out`, `on_hold`, `in_transit`,
`archived`) and `/transfers` takes `?status=`, so every count on the overview
opens the list behind it already filtered.

---

## 5. Typography of figures

Every number — KPIs, tables, money, chart ticks, the revenue mix — is set in
**Inter with `tabular-nums`**. Playfair Display is a display face with
proportional digits and no `tnum`; a column of prices set in it never lines up
and a KPI jitters sideways as it ticks over. Playfair keeps the page titles and
the logo, and nothing else.

Money is always two decimals (`$10,510.40`) and right-aligned in tables.

---

## 6. Charts

- **Revenue by day is a bar chart**, one bar per shop day, including days that
  took nothing. A curve through daily totals implies trade at three in the
  afternoon on a closed Sunday, and an interpolated slope between two days is a
  shape the business never had. There are **no smooth curves anywhere** in the
  app.
- Unit axes use whole numbers (`allowDecimals={false}`): there is no half a
  dress.
- Best sellers are ranked per **variant**, labelled `Model · Colour · Size`.
  `GET /reports/top-skus` ranks per SKU, so a model that sells in six colours
  produced six rows with the same name until the variant was shown.

---

## 7. Backend routes the UI uses

`GET /health`, `POST /auth/login`, `GET /auth/me`,
`GET|POST|PATCH|DELETE /users…`, `GET|POST|PATCH /branches…`,
`GET|POST|PATCH /styles…`, `GET|POST|PATCH /skus…`, `GET /skus/lookup`,
`PUT /skus/:id/price`, `GET /skus/:id/price-history`,
`POST /skus/:id/barcodes`, `DELETE /barcodes/:id`,
`GET /stock`, `POST /stock/opening`, `GET /stock/overview`,
`GET /stock/movements`, `GET|PUT|DELETE /reorder-levels…`,
`GET /replenishment/suggestions`, `POST|GET /sales…`,
`GET /reports/sales-summary`, `GET /reports/top-skus`, `GET /audit-events`,
`GET|POST /transfers…` (`/dispatch`, `/receive`, `/resolve`, `/cancel`),
`GET|POST /stock/adjustments`, `GET /dashboard/overview`.

**Probed, because older servers answer `404`** (see
`lib/api/capabilities.ts`): `GET /warehouse`, `GET /categories`,
`GET /permissions`, `GET /users/:id/permissions`,
`GET /users/:id/branch-access`, `GET /sales/history`.

> `GET /dashboard/overview` is live on the server but is **not in
> `API_GUIDE.md`**. It should be documented, or the UI should stop depending on
> it — today only the "today" figure under Revenue comes from it, and that is
> also available from `GET /sales`.

> `GET|POST /stock/adjustments` is live on the server and is **not in
> `API_GUIDE.md`** either. It is the only way to change a balance after a SKU
> has been opened at a location, so it is worth documenting rather than leaving
> to be discovered. Its contract is in section 10.

> `GET /permissions` answers **500** on the reference deployment. It is one of
> the probed routes, so the UI falls back to its own `lib/permission-keys.ts`
> and nothing breaks — but the failure is a server bug, not a missing feature.

> `GET /sales/history` must be registered **before** `GET /sales/:id` on the
> server, or it is matched as a sale whose id is the word `history`. The
> reference deployment has this wrong, which is why Recent Sales can fall back
> to today and says so on its face.

---

## 8. Widgets hidden because the API cannot answer them

These are built nowhere and stubbed nowhere. Each one would be a row, a link or
a panel the moment its route exists.

| Hidden | Where it would go | What is missing |
|---|---|---|
| Supplier receipts waiting for confirmation | Needs attention row | A receipt has no *state*: `POST /stock/adjustments` books stock in immediately, so there is nothing to confirm and nothing to count |
| Discount and refund requests waiting for approval | Needs attention row | A request resource with an approval state |
| Social media orders past their pickup time | Needs attention row | An order resource with a pickup time |
| Social orders | Sidebar, **Sell** | As above |
| Suppliers | Sidebar, **Catalog** | Any supplier route. A supplier is a name typed onto a receipt, not a record |
| Supplier, cost and the invoice photo on a shared record | Stock receipts | Nothing on an adjustment holds a price, a document number or a vendor, and the API has **no upload route at all**, so the paperwork and the photograph are kept per-device (section 10) |
| A server-issued receipt number | Stock receipts | `nextReceiptNo()` counts this device's receipts, so two devices reach the same number on the same day (section 10) |
| Unit cost on a model / SKU | New model, edit model | `POST /skus` only has `standardPrice`; cost is stored in this browser (`canViewCosts`) until the catalog API adds it |
| Stock control | Sidebar, **Stock** | Physical counts and holds |
| Invoices | Sidebar, **Stock** | Wholesale documents. The screen exists but is **browser-local**, so it is out of the nav |
| Sale references in global search | Header search | No route resolves a reference to a sale; `GET /sales/history` takes no search term |
| Reserved / on hold per variant | Inventory balance columns | `GET /stock` reports three buckets; these two come back `null` |
| Overdue shipments as a fact | Needs attention detail | No expected-arrival date on a transfer. The UI calls a shipment overdue after **3 days** from `dispatchedAt` (`OVERDUE_DAYS`), which is the frontend's own threshold, not the server's |
| Best sellers over a period, for non-financial roles | Best sellers panel | `GET /sales` is one shop day; only `reports.financial` reaches `GET /reports/top-skus`, so the panel says "today" for everyone else |
| Per-branch split of best sellers | Best sellers panel | `GET /reports/top-skus` returns scoped totals with no branch breakdown |

---

## 9. What still needs to exist on the backend

In the order that would unlock the most screen:

1. **A `purchase` reason on `POST /stock/adjustments`** — the enum is
   `count_correction, damage, loss, found, data_entry_error, other`, all of them
   corrections. A delivery is none of those, so `/stock-receipts` posts it as
   `other` with the document reference in the note. One new enum value stops a
   supplier delivery reading as "found on a shelf" in the audit log.
2. **Goods receipts / suppliers** — a supplier resource, and a receipt document
   that holds its own lines with a **unit cost**, a vendor, a reference and a
   server-issued number. Today `/stock-receipts` keeps that per-device
   (section 10) and only the quantities are shared. Also unlocks the
   supplier-receipts attention row and the **Suppliers** link.
3. **A file upload route** — e.g. `POST /uploads` returning a url, or an
   attachment collection on a receipt. There is nothing of the kind on this API,
   so a photograph of a supplier's invoice is held in the browser that took it
   and is lost with that browser's site data. This is the single largest gap
   between what `/stock-receipts` shows and what it should be.
4. **Approval requests** — discounts and refunds as a resource with a pending
   state and an approver. Unlocks the approvals attention row; today a discount
   is applied at the till with no request behind it.
5. **Orders with a pickup time** — a social-media order that is placed, promised
   for a time and collected. Unlocks the **Social orders** link and the overdue
   pickup row. `channel: social_media` on a sale records where a *completed*
   sale came from, which is a different thing.
6. **Returns** — listed as "coming next" in `API_GUIDE.md` section 9. Needed
   before refunds can be requested or reported.
7. **Stock control** — physical counts and holds, or fold them into adjustments.
   Unlocks the **Stock control** link and the two `null` balance columns.
8. **An expected-arrival date on a transfer** — replaces the frontend's 3-day
   guess with a fact.
9. **Sale lookup by reference** — `GET /sales?reference=` or a search term on
   `GET /sales/history`. Lets the header search find a receipt, which is what
   someone holding a printed one wants.
10. **Wholesale documents** — purchase, wholesale sale, returns, adjustments,
   draft → post → void, with idempotency. Replaces the browser-local invoice
   ledger and puts **Invoices** back in the nav.
11. **A branch breakdown on `GET /reports/top-skus`** — so best sellers can be
   read per location without one request per branch.
12. **`GET /dashboard/overview` documented, with `outOfStock` counted in
    variants** — or dropped. As it stands the field cannot be displayed, and the
    frontend computes the figure itself (section 3).
13. **Store settings API** — persisted USD/LBP exchange rate with history, return
    period (days), and default social-order reservation (hours). Until then,
    `/settings` keeps currency on `localStorage` and sales rules stay disabled.
14. **Self-service password change with current password** — e.g.
    `PUT /auth/password` or `PUT /users/me/password` accepting `currentPassword`
    and `newPassword`. The Security tab collects the current password; today the
    client only sends the new password via `PUT /users/:id/password`.

Two of these are specified endpoint by endpoint in **`BACKEND_REQUESTS.md`**:
the transfer receive & confirm chain (item 1 there is a live block — the branch
cannot confirm received stock for sale when the supply invoice is not found from
the transfer) and returns (item 6 above).

Until those exist, the rule holds: **component → hook → service**. When a route
lands, change the service and its mapper; the screens do not move.

---

## 10. Receiving stock: half shared, half local

Getting stock onto a shelf has three routes, and only one of them is a document:

| How | Endpoint | When |
|---|---|---|
| Opening count | `POST /stock/opening` | A SKU's **first** units at a location. Refused once it has moved there. Its own screen, `/opening-stock` |
| Transfer | `POST /transfers` → dispatch → receive | Stock already in the business moving between locations |
| Receipt / correction | `POST /stock/adjustments` | Everything after that: a supplier delivery (normally at the warehouse), or a count that disagrees with the figure |

A new model is created with **nothing anywhere** — adding it to the catalog
never places stock — so one of the three has to happen before it can be sold.

### How stock reaches a shop

The business works warehouse-first. A delivery arrives at the **main warehouse**,
and shops are stocked from it by transfer:

```
new model (0 everywhere)
   └─► receive at the warehouse      POST /stock/adjustments
         └─► transfer to a branch    POST /transfers → dispatch → receive
               └─► sell              POST /sales
```

Each step hands off to the next with the context already filled in, because the
alternative is re-finding on one screen what you were just looking at on another:

| From | Action | Lands on |
|---|---|---|
| Model saved | **Receive stock** | `/stock-receipts/new?style=<code>` — every variant listed as a blank line |
| Receipt posted | **Send to a branch** | `/transfers/new?from=<warehouseId>` — From already set |

`Arrived at` on a receipt therefore **defaults to the warehouse** rather than
starting empty: the answer is the same on nearly every delivery. The select
stays, because a supplier who drops a box at a shop has to be recordable where
it actually landed — choosing a shop shows a note saying the warehouse was
bypassed, since that is a real and occasionally correct thing to do.

**Send to a branch** is hidden when nothing was received, when the viewer cannot
prepare a transfer, or when there is no other location to send to — a
single-site business never sees it.

**The create-model form does not take quantities**, and that is deliberate:

- Defining what a thing *is* and asserting how many you *have* are two acts with
  two permissions. `catalog.create` is in `DEFAULT_EMPLOYEE_PERMISSIONS`;
  `opening_stock.post` and `stock.adjust` are manager tier. The step was only
  ever visible to a minority of the people who use the form.
- `POST /stock/opening` is **one-shot per SKU per location**. A figure typed
  wrong while entering thirty variants could not be re-opened, only corrected —
  a trap at exactly the point where someone is least sure of the data.
- It could only ever post to the main warehouse, so a delivery that went
  straight to a shop had nowhere to go.

Saving a model therefore lands on the model page with `?created=1`, which leads
with "Stock is zero everywhere" and offers
`/stock-receipts/new?style=<code>` — the receipt form with every variant of that
model already listed as a blank line, so the only thing left to type is what
actually turned up.

`POST /stock/adjustments` is the only one that works at any time. Its contract,
read off the running server (it is **not in `API_GUIDE.md`**):

```
POST /stock/adjustments          Idempotency-Key required (8-200 chars)
  branchId       uuid
  skuId          uuid            one SKU per call
  quantityDelta  integer != 0, |x| <= 100000, negative removes
  reason         count_correction | damage | loss | found | data_entry_error | other
  note           string, 5-200 chars, kept in the audit log
GET  /stock/adjustments?branchId=&skuId=&reason=&from=&to=&limit=&offset=
```

**`/stock-receipts` is therefore two records, not one**, and the screens say so
rather than implying otherwise:

- **The quantities are shared and permanent.** One `POST` per line, under the
  caller's name, visible to everyone, and in the audit log.
- **The supplier, their document number, the per-line cost and the photograph
  are local.** There is nowhere on this API to put them — no supplier resource,
  no receipt resource, no upload route of any kind. The text lives in this
  browser against `bitar:stock-receipts:v1`, the same way
  `wholesale-invoices.service.ts` keeps its invoices. Another machine sees the
  stock arrive and the receipt number in the note, never the vendor, the cost or
  the picture.

### The receipt number

Posting generates one: `RCV-<year>-<nnnn>`, from `nextReceiptNo()`. Nobody types
it, and it leads the audit note so a stock movement on the server can be traced
back to the document and its photograph on a device. The supplier's own number
is a separate, optional field (`reference`) — one field doing both jobs meant
neither was reliable.

Its limit, stated because it matters: the sequence counts **this device's**
receipts, so two people receiving on the same day both reach the same number.
The receipt's `id` stays a UUID and the number is a label for people rather than
a key, so a clash is cosmetic rather than two records merging. A receipts
endpoint would issue these instead.

### The photograph

`lib/image-downscale.ts` re-encodes the picked file to a JPEG bounded at
**2000px on the long edge at quality 0.82**, which keeps printed digits legible
and turns a 3-8 MB phone photo into 250-600 KB. The original is never kept.

It is stored in **IndexedDB** (`lib/blob-store.ts`, database `bitar-files`), not
`localStorage`. `localStorage` is a ~5 MB quota for the whole origin shared with
every other key the app keeps there; one invoice photo would fill most of it and
the second would throw, taking the receipts index down with it.

Order matters: the blob is written **after** the stock has moved. If the store is
full or blocked, the receipt is still saved with `photo.stored = false`, and its
page says the picture was lost rather than looking like none was attached.
Deleting a receipt deletes its blob, so nothing is orphaned.

There is **no text extraction from the photograph.** It is attached as the source
document and shown beside the lines; the quantities and costs are typed by a
person reading it.

Two consequences worth stating plainly:

- **Posting is not atomic.** The server has no multi-line adjustment, so a
  five-line receipt is five requests. A line that fails leaves the lines before
  it received; the failure is recorded on the document and shown on its page,
  rather than reported as "nothing happened".
- **A delivery is filed as `other`.** Every reason the server accepts is a
  correction. `found` would record a supplier delivery as stock discovered on a
  shelf, so `other` plus `Stock received on <ref> from <supplier>` in the note is
  used until the enum gains a `purchase` (section 9 item 1).

Correcting one variant at one location is the same endpoint from the variant
page. The form asks for the **counted total** and sends the difference: a total
would overwrite whatever was sold while the box was open, a delta applies on top
of it.

---

## 11. Environment

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

The backend's `CORS_ORIGIN` must include this app's origin — scheme, host and
port, no trailing slash.

There is **no linter in this project**: `package.json` has no `lint` script and
no ESLint dependency. "Lint and type check" means `npx tsc --noEmit` and
`npm run build`.
