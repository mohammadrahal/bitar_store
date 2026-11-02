# Bitar Fashion API: guide for the frontend developer

Version 0.10: **login**, **users**, **branches**, **branch access**, **catalog**, **stock and sales**, the **warehouse view** (every place at once, minimums, what to send, reports, audit log) and **transfers** (the warehouse sends to a branch, a branch confirms what arrived). Every example below is a real response from the running server.

| Area | Status |
|---|---|
| Login (token), who am I | available |
| Users and roles | available |
| Branches and branch access | available |
| Catalog: styles, SKUs, barcodes, prices and price history, scanner lookup | available |
| Stock per branch, opening stock, **sales** (cash and Whish, discounts, receipts) | available |
| Transfers, returns, social media orders, branch prices | **not built yet**: don't call them |

---

## 1. Quick start

- **Base URL (dev):** `http://localhost:3000`. Keep it in one env var: `NEXT_PUBLIC_API_URL`.
- JSON in and out. Send `Content-Type: application/json` on every request that has a body.
- Get a token with `POST /auth/login`, then send `Authorization: Bearer <token>` on **every other request**.
- Ask the backend developer for an admin's email and password for development.

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@bitar.test","password":"Password#123"}' | jq -r .token)
curl http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
```

---

## 2. Login and the token

| Step | Call | Result |
|---|---|---|
| Log in | `POST /auth/login` with email and password | `200` with `token` and `user` |
| Remember who I am | `GET /auth/me` with the token | the user, `permissions`, `branchIds`, `canViewCosts` |
| Every other call | header `Authorization: Bearer <token>` | |
| Log out | throw the token away (there is no server call) | |

- A token is valid for **8 hours**. After that every call returns `401`: send the user back to the login screen. There is no refresh token yet.
- Call `/auth/me` right after login **and on every page reload** (the token is all you keep). Use `permissions` and `canViewCosts` to decide what to show.
- **Where to keep the token:** the simplest place is `localStorage`, but any script running on your page can read it (XSS). Never put third-party scripts you don't trust on the app. Never put the token in a URL.
- **Deactivated users are locked out at once**: their token stops working on the very next call, even if it hasn't expired.
- Changing a user's password does **not** end sessions that are already open (they expire after 8 hours).
- Development only: if the backend runs with `AUTH_MODE=dev` it also accepts the header `X-User-Id: <uuid>` instead of a token. Don't build on it; it never exists in production.

`POST /auth/login`
```json
{ "email": "admin@bitar.test", "password": "Password#123" }
```
`200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": "c11e1fcb-c268-4146-9cbd-f55c8e9f69f2",
    "email": "admin@bitar.test",
    "fullName": "Admin",
    "role": "admin",
    "isActive": true,
    "hasPassword": true,
    "deactivatedAt": null,
    "createdAt": "2026-10-24T20:12:28.090Z",
    "updatedAt": "2026-10-24T20:12:28.090Z"
  }
}
```
Wrong email, wrong password, **or a user who has no password yet**: `401 { "message": "Invalid email or password" }` (the same message on purpose: show it as is, it never reveals whether the account exists). Missing field: `400`.

`GET /auth/me` returns:
```json
{
  "user": { "id": "c11e1fcb-...", "email": "admin@bitar.test", "fullName": "Admin", "role": "admin", "isActive": true, "hasPassword": true, "deactivatedAt": null, "createdAt": "...", "updatedAt": "..." },
  "permissions": ["adjustments.create", "catalog.create", "discounts.apply", "reports.financial", "returns.create", "sales.create", "transfers.dispatch", "transfers.receive", "users.administer"],
  "branchIds": [],
  "canViewCosts": true
}
```
`branchIds` is the list of branches this user was given. For an **admin** it can be empty: admins reach every branch.

---

## 3. Conventions

- **Ids** are uuid strings. **Field names** are camelCase.
- **Dates** are ISO 8601 strings in UTC, e.g. `"2026-10-25T07:50:17.815Z"`. Use `new Date(value)`.
- A field that is empty is `null` (never missing, never `""`).
- **Success codes:** `200` read/update, `201` created, `204` success with **no body** (don't call `.json()`).
- **Errors** always have this shape, with a message you can show to the user:

```json
{ "message": "A user with this email already exists" }
```

| Status | Meaning | What the UI should do |
|---|---|---|
| 400 | Bad input (validation) | Show `message` next to the form |
| 401 | No token, expired, invalid, or the user was deactivated | Clear the token, go to the login screen |
| 403 | Logged in but not allowed | Show "not allowed"; hide that screen in the menu |
| 404 | Unknown id or route | Show "not found" |
| 409 | Conflict (duplicate email/code, forbidden self-change) | Show `message` |
| 500 | Server bug | Show a generic error; tell the backend developer |

- **No pagination yet**: list endpoints return everything.
- **The password is never returned**, by any endpoint.
- **CORS:** browser calls are accepted only from the origins in the backend's `CORS_ORIGIN`. Tell the backend developer your dev origin (e.g. `http://localhost:3001`). Calls made from Next.js server code are not affected by CORS.

---

## 4. Roles

Roles: `"admin"`, `"manager"`, `"employee"`.

| Action | admin | manager | employee |
|---|---|---|---|
| `GET /branches` | yes | yes | yes |
| `POST /branches` | yes | no (403) | no (403) |
| `/users` (list, create, update) and branch access | yes | no (403) | no (403) |

Hide screens the user can't use, but never rely on that: the server answers 403 anyway.

**Catalog:** reading (lists, details, the scanner lookup) needs a login only, so every employee can search and scan. **Changing** the catalog (create or edit styles and skus, change a price, add or remove barcodes) and reading the **price history** need the `catalog.create` permission: admins and managers have it, employees do not (`403` with the message `Missing permission: catalog.create`).

**Branch visibility:** an **admin** sees every branch (including inactive ones). **Everyone else** (manager included) sees only the **active branches an admin granted them**. A new employee gets `[]` until an admin grants a branch, so build an empty state such as "Ask your admin for access to a branch".

---

## 5. Endpoints

### `GET /health`
No token needed. `200 { "status": "ok" }`

### Users (admin only)

#### `POST /users`: create a user

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | yes | valid email, up to 254 chars. Stored in lower case, so `Sara@Bitar.test` and `sara@bitar.test` are the same user |
| `fullName` | string | yes | 2 to 100 characters (trimmed) |
| `role` | string | yes | `admin`, `manager` or `employee` |

```json
{ "email": "Sara.Khoury@Bitar.test", "fullName": "Sara Khoury", "role": "employee" }
```
`201`: the user object (as in the login response). The user is created **without a password**: `hasPassword` is `false` and they **cannot log in yet**. Set a password with `PUT /users/:id/password` (below). Sending a `password` field here is refused with `400`. Other errors: `409` (email already used), `401`, `403`.

#### `GET /users`
`200`: an array of user objects (oldest first). Use `hasPassword` to show a badge such as "No password yet" and a "Set password" button.

#### `DELETE /users/:id`: delete a user permanently (admin only)
No body. `204`. **This only works for a user nothing else refers to**, for example an account created by mistake. A user who has created records, sold, or moved stock cannot be deleted: the server answers `409` and changes nothing. Their branch access is removed together with them when the delete succeeds.

Errors: `404` (unknown or malformed id), `409` (`You cannot delete your own account`, or `This user has history ... Deactivate the user instead.`), `401`, `403`.

Typical screen: a confirm dialog "Delete this user permanently?". If the server answers `409`, show its `message` and offer a **Deactivate** button (a `PATCH` with `isActive: false`).

#### `PUT /users/:id/password`: set or reset a password (admin only)
This is the **only** way to give a user a password: the same call sets the first one and resets a forgotten one. Calling it again replaces the old password.

| Field | Type | Required | Rules |
|---|---|---|---|
| `password` | string | yes | at least 8 characters, at most 72 bytes |

```json
{ "password": "Password#123" }
```
`204` (no body). Errors: `400` (missing or weak password), `404` (unknown or malformed id), `401`, `403`.

Typical screen: **create user** (email, full name, role) then straight away a **set password** dialog that calls this endpoint. Until it succeeds the user cannot log in. Existing sessions of that user are not ended by a password change (they expire after 8 hours).

#### `PATCH /users/:id`: change a user
Send **only** the fields you want to change. All are optional: `email`, `fullName`, `role`, `isActive`. A `password` field is refused with `400`: use `PUT /users/:id/password`.

```json
{ "fullName": "Sara K. Khoury", "role": "manager" }
```
`200`: the updated user. Errors: `400`, `404` (unknown or malformed id), `409`.

- To stop someone using the app, **deactivate** them with `{ "isActive": false }`: their next request returns `401`. Prefer this to deleting: it keeps their history.
- An admin **cannot** deactivate or change the role of **their own** account (`409`). Another admin can.
- Admins can create other admins (`role: "admin"`). The very first admin is created by the backend developer.

#### `PUT /users/:id/branches/:branchId`: give a user access to a branch
No body. `204`. Safe to repeat. Errors: `404` (`User not found` or `Branch not found`), `409` (`Cannot grant access to an inactive branch`).

#### `DELETE /users/:id/branches/:branchId`: take that access away
No body. `204`. Safe to repeat. Error: `404` (`User not found`).

### Branches

#### `GET /branches`
Any logged-in user. **Admin:** every branch. **Others:** only the active branches granted to them. `200`:
```json
[
  { "id": "477d4fe3-05cf-479a-859c-d0d035343295", "code": "HAMRA", "name": "Hamra", "isActive": true, "kind": "branch", "createdAt": "2026-10-25T07:50:18.231Z" }
]
```
`kind` is `"branch"` or `"warehouse"`. The **warehouse is the main inventory**: it supplies the branches and **never sells to customers** (a sale there is refused with `409`). There is **only one**. Show it differently in the UI and never offer it on the till.

#### `POST /branches`: admin only
| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | 1 to 20 characters: letters, digits, `-` and `_`. The server **uppercases** it (`hamra` becomes `HAMRA`). Must be unique |
| `name` | string | yes | 1 to 120 characters |
| `kind` | string | no | `"branch"` (default) or `"warehouse"`. Only one warehouse can exist (`409 There is already a warehouse`) |

```json
{ "code": "hamra", "name": "Hamra" }
```
`201`: the branch. Errors: `400`, `409` (code already used), `401`, `403`.

#### `PATCH /branches/:id`: admin only
Send at least one of `name`, `isActive`, `kind`. `200`: the branch. Every real change is written to the audit log with the values before and after. Asking for what is already true changes nothing.
`409` when a second warehouse is requested, or when the branch **already has sales or minimums** (it can no longer become the warehouse). `404` unknown id. `400` anything else.

### Catalog

Three levels, and the names matter:

| Word | What it is | Example |
|---|---|---|
| **style** | the MODEL of a garment | "Nike Club Tee" |
| **sku** | one **sellable variant**: a style in one size and one color, with its standard price. This is what is sold and counted | "Nike Club Tee, M, Red, 25.00" |
| **barcode** | a code on the label of a sku. One sku has many barcodes; one barcode belongs to **one** sku in the whole catalog | `5901234123457` |

Rules that apply everywhere:

- **Money is a string with 2 decimals** (`"25.00"`), never a JSON number, in every response. When you **send** a price, a string or a number is fine (`25`, `25.5`, `"25.50"`). Not allowed: negative, more than 2 decimals, text, empty. Currency is `"USD"` unless you send another 3-letter code.
- **Codes** (`style.code`, `sku.skuCode`) are stored **UPPER CASE** (you can type `nk-100`), may contain letters, digits and `. _ / -`, and **never change** after creation. **Barcodes** keep the exact case scanned (visible characters only, no spaces, up to 64).
- **Nothing is deleted** except barcodes. A style or sku that is no longer used is deactivated (`isActive: false`).
- **Lists never return everything**: `limit` (default 50, maximum 200) and `offset` (default 0). A bad value is `400`.
- A **style** can have many skus; two skus of the same style cannot share the same size **and** color (case and spaces are ignored).

#### `GET /styles`: search styles
Query (all optional): `search` (matches code or name, any case), `activeOnly=true`, `limit`, `offset`. Sorted by name.
```json
[
  { "id": "ddc454ed-...", "code": "NK-CLUB", "name": "Nike Club Tee", "category": "Clothing", "isActive": true, "createdAt": "2026-10-26T20:04:24.064Z", "updatedAt": "2026-10-26T20:04:24.064Z" }
]
```

#### `GET /styles/:id`: one style with its skus
`200`: the style fields plus `"skus": [ ...sku objects... ]`. Unknown or malformed id: `404`.
```json
{
  "id": "ddc454ed-...", "code": "NK-CLUB", "name": "Nike Club Tee", "category": "Clothing", "isActive": true,
  "createdAt": "...", "updatedAt": "...",
  "skus": [
    { "id": "cd80900e-...", "styleId": "ddc454ed-...", "skuCode": "NK-CLUB-L-RED", "size": "L", "color": "Red",
      "standardPrice": "25.00", "currency": "USD", "isActive": true, "createdAt": "...", "updatedAt": "..." }
  ]
}
```

#### `POST /styles`: create a style (`catalog.create`)
| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | up to 40 characters, see the code rules above. Unique (any case) |
| `name` | string | yes | 1 to 120 characters |
| `category` | string or null | no | up to 60 characters; empty means none |

`201`: the style. Errors: `400`, `409` (`A style with this code already exists`), `401`, `403`.

#### `PATCH /styles/:id`: change a style (`catalog.create`)
Send only what changes: `name`, `category` (`null` or `""` clears it), `isActive`. The `code` cannot be changed (it is ignored). `200`: the style. Errors: `400`, `404`.

#### `GET /skus`: search variants
Query (all optional): `search` (matches **sku code, color or style name**, any case), `styleId`, `activeOnly=true`, `limit`, `offset`. Sorted by sku code. Each item has its `style`:
```json
[
  {
    "id": "419e0bfb-...", "styleId": "58718fb4-...", "skuCode": "JEAN-SLIM-30-BLUE", "size": "30", "color": "Blue",
    "standardPrice": "45.00", "currency": "USD", "isActive": true, "createdAt": "...", "updatedAt": "...",
    "style": { "id": "58718fb4-...", "code": "JEAN-SLIM", "name": "Slim Jeans" }
  }
]
```

#### `GET /skus/lookup?code=...`: the scanner
What the till calls when the scanner reads a code. The text is matched **exactly** against the barcodes first, then against the sku codes (any case). `200` returns the full detail, with the style and **all** barcodes of that sku:
```json
{
  "id": "7b901872-...", "styleId": "ddc454ed-...", "skuCode": "NK-CLUB-S-RED", "size": "S", "color": "Red",
  "standardPrice": "25.00", "currency": "USD", "isActive": true, "createdAt": "...", "updatedAt": "...",
  "style": { "id": "ddc454ed-...", "code": "NK-CLUB", "name": "Nike Club Tee" },
  "barcodes": [ { "id": "ce838827-...", "skuId": "7b901872-...", "code": "5901234123457", "createdAt": "..." } ]
}
```
Nothing matches: `404 No sku matches this code` (show "unknown product" and let the cashier retry). Empty or missing `code`: `400`. Check `isActive` before selling: a deactivated sku is still found.

#### `GET /skus/:id`: one variant
Same shape as the lookup. Unknown or malformed id: `404`.

#### `POST /skus`: create a variant (`catalog.create`)
| Field | Type | Required | Rules |
|---|---|---|---|
| `styleId` | string | yes | an existing, **active** style |
| `skuCode` | string | yes | up to 40 characters, unique (any case) |
| `size` | string | yes | 1 to 20 characters |
| `color` | string | yes | 1 to 40 characters |
| `standardPrice` | string or number | yes | see the money rules |
| `currency` | string | no | 3 letters, default `USD` |

```json
{ "styleId": "ddc454ed-...", "skuCode": "nk-club-xl-red", "size": "XL", "color": "Red", "standardPrice": "25" }
```
`201`: the sku. The first price is also written to the price history. Errors: `400`, `404` (unknown style), `409` (code already used, same size and color already in this style, or the style is inactive).

#### `PATCH /skus/:id`: change a variant (`catalog.create`)
Send only what changes: `size`, `color`, `isActive`. The **code, currency and price are not changed here**. `200`: the sku. Errors: `400`, `404`, `409` (that size and color already exist in this style).

#### `PUT /skus/:id/price`: change the price (`catalog.create`)
```json
{ "price": "30.50" }
```
`200`: the sku with its new `standardPrice`. Sending the price it already has changes nothing and records nothing. Every real change is written to the price history. Errors: `400`, `404`.

#### `GET /skus/:id/price-history`: who changed the price (`catalog.create`)
Newest first. Optional `limit`. The first price a sku ever had has `oldPrice: null`.
```json
[
  { "id": "edc8037c-...", "skuId": "7b901872-...", "oldPrice": "25.00", "newPrice": "27.50", "effectiveAt": "2026-10-26T20:05:39.264Z", "changedBy": "c84105bd-..." },
  { "id": "a55809a0-...", "skuId": "7b901872-...", "oldPrice": null, "newPrice": "25.00", "effectiveAt": "2026-10-26T20:04:24.113Z", "changedBy": "9c60410f-..." }
]
```

#### `POST /skus/:id/barcodes`: add a barcode (`catalog.create`)
```json
{ "code": "5901234123457" }
```
`201`: `{ "id", "skuId", "code", "createdAt" }`. Errors: `400` (empty, spaces, too long), `404` (unknown sku), `409` (`This barcode already belongs to a sku`: it can belong to only one sku).

#### `DELETE /barcodes/:id`: remove a barcode (`catalog.create`)
No body. `204`. Unknown or malformed id: `404`.

### Stock and sales

**How to think about it.** Stock is counted per **sku** at each **branch**. A sale is **completed only when it is fully paid** (cash, Whish Money, or both) and the goods are handed over. There is no "pending" sale: an unpaid sale is simply not completed yet. The platform records what the business received, it never moves money.

#### `GET /stock?branchId=...`: do we have it?
Any logged-in user, for a branch they reach. Query: `branchId` (required), `search` (sku code, color or style name), `styleId`, `activeOnly=true`, `limit`, `offset`. **Every** catalog variant is listed, with `0` where there is nothing.
```json
[
  {
    "sku": { "id": "0ab52b19-...", "skuCode": "NK-CLUB-M-BLUE", "size": "M", "color": "Blue", "standardPrice": "25.00", "currency": "USD", "isActive": true, "style": { "id": "726f1f23-...", "code": "NK-CLUB", "name": "Nike Club Tee" }, "...": "..." },
    "sellable": 10,
    "nonSellable": 0,
    "inTransit": 0
  }
]
```
`sellable` is the number the till uses. `nonSellable` is damaged or on hold. `inTransit` is on the road. For a branch the user cannot reach: `403`.

**Pages.** The list is never sent whole. Ask for the page you want: `limit` (1 to 200, **default 50**) and `offset` (0, 20, 40...), in a stable order (by sku code), so pages never overlap. The response header **`X-Total-Count`** says how many items the whole list has (for the same filters), so the screen knows what comes next:
```
GET /stock?branchId=...&limit=20&offset=0     ->  20 items, X-Total-Count: 137
GET /stock?branchId=...&limit=20&offset=20    ->  the next 20
hasMore = offset + items.length < total        pages = Math.ceil(total / limit)
```
In `api.ts`, `listStockPage({ branchId, limit: 20, offset })` returns `{ items, total }`. Two ways to build the screen: **"Load more"** (keep the items, add the next page: best for the till and for search) or **Previous / Next** with "page 2 of 7" (best for an admin table). When the user types in the search box, go back to `offset: 0`.

#### `POST /stock/opening`: load the counted quantities (admin and manager)
Header `Idempotency-Key` (see below). Allowed **once per sku per branch**, before any movement.
```json
{ "branchId": "<branch id>", "lines": [ { "skuId": "<sku id>", "quantity": 10 } ] }
```
`201 { "batchId": "...", "lines": 1 }`. Errors: `400`, `403` (no permission or not your branch), `404`, `409` (that sku already has movements here).

#### `POST /sales`: complete a sale
Needs the `sales.create` permission (everyone has it) and access to the branch. **Required header: `Idempotency-Key`**, a new random id for each sale (8 to 200 characters; use `crypto.randomUUID()`, `newIdempotencyKey()` in `api.ts`).

```json
{
  "branchId": "<branch id>",
  "lines": [ { "skuId": "<sku id>", "quantity": 1 } ],
  "payments": [
    { "method": "cash",  "amount": "20.00", "tendered": "50.00" },
    { "method": "whish", "amount": "25.00", "reference": "WH-123456" }
  ]
}
```
| Field | Rules |
|---|---|
| `lines` | 1 to 50. **Each sku once** (raise its `quantity` instead). `quantity` is a whole number from 1 to 10000. **Do not send a price**: the server reads it from the catalog |
| `lines[].discount` | optional. Needs the `discounts.apply` permission (managers), otherwise `403 Missing permission: discounts.apply`. `{ "type": "percent", "percent": "10", "reason": "holiday" }` (above 0, up to 100) or `{ "type": "override", "unitPrice": "40", "reason": "stain" }` (never above the catalog price). A **reason is required**. The receipt records who approved it |
| `payments` | the amounts must **add up to the total exactly**, to the cent. A sale with a total of 0 (100 percent discount) has no payments. At most 4 payments |
| `payments[].method` | `cash` or `whish` |
| cash | `tendered` (what the customer handed over) is optional and defaults to the amount; it cannot be less than the amount. The **change** is `tendered - amount` and is not revenue |
| Whish | `reference` is **required**: the transfer reference the business verified (a customer screenshot is not enough). 1 to 64 visible characters, no spaces. **A reference can pay only one sale ever** (any letter case), otherwise `409 This Whish reference was already used for another payment` |
| `channel` | `in_store` (default) or `social_media` (then `socialPlatform` is required: `facebook`, `instagram`, `whatsapp` or `other`) |
| `note` | optional, up to 500 characters |

`201`: the **receipt**, with everything to print:
```json
{
  "id": "c0c7329b-...", "reference": "S-00000001", "branchId": "373ad2f0-...",
  "soldBy": { "id": "0bb3c157-...", "name": "Sara Employee" },
  "status": "completed", "channel": "in_store", "socialPlatform": null, "currency": "USD",
  "subtotal": "25.00", "totalDiscount": "0.00", "total": "25.00", "totalPaid": "25.00",
  "soldAt": "2026-10-27T11:12:27.499Z", "businessDate": "2026-10-27", "note": null,
  "lines": [
    { "lineNo": 1, "skuId": "2a2e2560-...", "skuCode": "NK-CLUB-S-RED", "styleName": "Nike Club Tee", "size": "S", "color": "Red",
      "quantity": 1, "unitPrice": "25.00", "discount": null, "lineTotal": "25.00" }
  ],
  "payments": [
    { "method": "cash",  "amount": "15.00", "tendered": "20.00", "change": "5.00", "reference": null },
    { "method": "whish", "amount": "10.00", "tendered": null,    "change": null,   "reference": "WH-DEMO-1" }
  ]
}
```
Everything in the sale (the sale, its lines, its payments, the stock deduction) happens **together or not at all**. Prices and discounts on a receipt **never change** afterwards, even if the catalog price changes.

**The Idempotency-Key, in one minute.** A phone call can fail after the server already sold the item, and a click can be sent twice. So every sale carries a key:
- **New sale = new key.** Generate it when the cashier presses "complete sale".
- **Retry after an error or no answer = the SAME request with the SAME key.** The server answers `201` with the **same receipt** (header `Idempotent-Replay: true`) and **sells nothing again**.
- The same key with a **different** request: `409 This Idempotency-Key was already used for a different request`.
- If the sale failed (for example out of stock), the key is free again: retry with it, or use a new one.

**Not enough stock: `409`** with the items that are short, so the screen can name them:
```json
{
  "message": "Not enough stock for one or more items",
  "details": [ { "skuId": "4ed3041e-...", "skuCode": "NK-CLUB-M-RED", "requested": 99, "available": 10 } ]
}
```
In `api.ts` this is `error.details` (type `StockShortage[]`). Nothing was sold. The shortage is also logged for the managers. Two cashiers selling the last unit at the same moment: one gets `201`, the other gets this `409`.

#### `GET /sales/:id`: read a receipt
Same shape as above. A sale of a branch the user cannot reach is `404`.

#### `GET /sales?branchId=...&date=2026-10-27`: the sales of one shop day
`branchId` required. `date` is the **shop day** in Lebanon time (default: today; a sale at 00:30 belongs to the new day). Newest first. `limit` (default 50, maximum 200) and `offset`.
```json
{ "businessDate": "2026-10-27", "sales": [ { "...": "receipts as above" } ] }
```
Errors: `400` (bad branch id, a date that does not exist, bad paging), `403` (branch not reachable).

### The warehouse view: stock everywhere, minimums, what to send, reports

**Who sees what (the owner's rules):** the **admin** sees **every place**, the warehouse and all the branches. A **manager** sees **only the branches granted to them**. An **employee** sells and looks up stock at their own branch only.

| Endpoint | admin | manager | employee |
|---|---|---|---|
| `GET /stock/overview` | yes | **no** (403) | no |
| `GET /stock/movements` | any place | granted branches | no |
| `GET/PUT/DELETE /reorder-levels` | any branch | granted branches | no |
| `GET /replenishment/suggestions` | all branches | granted branches | no |
| `GET /reports/*` | all branches | granted branches | no |
| `GET /audit-events` | yes | no | no |

#### `GET /stock/overview`: every place at once (admin only)
Query: `search`, `styleId`, `activeOnly`, `limit`, `offset` (paging is by sku). One column per active place, **the warehouse first**; one row per sku; `0` where there is nothing.
```json
{
  "locations": [
    { "id": "1c61ff81-...", "code": "WAREHOUSE", "name": "Main Warehouse", "kind": "warehouse" },
    { "id": "3dc178fb-...", "code": "HAMRA", "name": "Hamra", "kind": "branch" }
  ],
  "items": [
    {
      "sku": { "id": "cb7a9d6e-...", "skuCode": "NK-CLUB-S-RED", "...": "..." },
      "totals": { "sellable": 63, "nonSellable": 0, "inTransit": 0 },
      "locations": [
        { "branchId": "1c61ff81-...", "sellable": 50, "nonSellable": 0, "inTransit": 0, "minQuantity": null, "targetQuantity": null, "belowMinimum": false },
        { "branchId": "3dc178fb-...", "sellable": 8, "nonSellable": 0, "inTransit": 0, "minQuantity": 12, "targetQuantity": 20, "belowMinimum": true }
      ]
    }
  ]
}
```
`locations[i]` inside an item lines up with `locations` at the top by `branchId`. `belowMinimum` is true when `sellable + inTransit` is under the branch's minimum, so stock already on its way counts.

#### `GET /stock/movements?branchId=...`: the history of one place
Needs `adjustments.create` (admin, manager) and a place you reach. Query: `branchId` (required), `skuId`, `type` (`sale`, `opening`, ...), `from` and `to` (shop days `YYYY-MM-DD`), `limit` (default 50, max 200), `offset`. Newest first.
```json
[
  { "id": "fd0dfe80-...", "occurredAt": "2026-10-29T00:13:02.615Z", "type": "sale", "bucket": "sellable", "quantityDelta": -2, "balanceAfter": 8,
    "sku": { "id": "cb7a9d6e-...", "code": "NK-CLUB-S-RED" }, "by": { "id": "ed3f0b58-...", "name": "Sara Employee" }, "saleId": "d6d7642b-...", "reason": null }
]
```

#### Minimums: `GET`, `PUT`, `PUT /by-style`, `DELETE /reorder-levels`
The **minimum a branch should keep** of a sku, and optionally a **target** to fill back up to. Admin, or a manager **at their own branch**. **The warehouse has no minimum** (`409`): it supplies the branches.
- `GET /reorder-levels?branchId=...&search=...&limit=&offset=` lists them:
```json
[ { "id": "da5c344b-...", "branchId": "3dc178fb-...", "sku": { "id": "2dae6572-...", "code": "JEAN-SLIM-32-BLUE", "styleName": "Slim Jeans", "size": "32", "color": "Blue" },
    "minQuantity": 8, "targetQuantity": 16, "updatedAt": "2026-10-29T00:12:33.649Z" } ]
```
- `PUT /reorder-levels` with `{ "branchId": "...", "skuId": "...", "minQuantity": 12, "targetQuantity": 20 }` creates it or **replaces** the existing one. `targetQuantity` is optional (empty means "fill up to the minimum") and cannot be below `minQuantity`. `200`: the minimum.
- `PUT /reorder-levels/by-style` with `{ "branchId": "...", "styleId": "...", "minQuantity": 4 }` sets the same minimum for **every active size and color of that style** (the "per model" way). `200 { "styleId": "...", "skus": 3 }`. `409` if the style has no active skus.
- `DELETE /reorder-levels/:id`: `204`.
Errors: `400` (numbers: whole, 0 or more), `403` (not your branch), `404`, `409` (warehouse, inactive branch or sku).

#### `GET /replenishment/suggestions`: what the warehouse should send
Query: `branchId` (optional; without it you get every branch you reach). Computed when you ask, from the balances. It lists only the branches **below their minimum**, **biggest need first**:
```json
{
  "warehouse": { "id": "1c61ff81-...", "code": "WAREHOUSE", "name": "Main Warehouse", "kind": "warehouse" },
  "suggestions": [
    { "branch": { "id": "3dc178fb-...", "code": "HAMRA", "name": "Hamra", "kind": "branch" },
      "sku": { "id": "cb7a9d6e-...", "code": "NK-CLUB-S-RED", "styleName": "Nike Club Tee", "size": "S", "color": "Red" },
      "sellable": 8, "inTransit": 0, "minQuantity": 12, "targetQuantity": 20,
      "suggested": 12, "warehouseSellable": 50, "fillable": 12 }
  ]
}
```
`suggested` = target (or minimum) minus what the branch has and what is already on the way. `fillable` = the smaller of `suggested` and what the warehouse has. `warehouse` is `null` until one exists.

#### `GET /reports/sales-summary` and `GET /reports/top-skus`
Need `reports.financial` (admin, manager). Query: `branchId` (optional: without it, every branch you reach), `from` and `to` (shop days, default today, at most 366 days). The shop day is the Lebanese day, so a sale at 00:30 counts for the new day. The warehouse never appears here: it does not sell to customers.
```json
{
  "from": "2026-10-29", "to": "2026-10-29",
  "totals": { "salesCount": 1, "items": 2, "revenue": "50.00", "discounts": "0.00", "cash": "30.00", "whish": "20.00", "inStore": "50.00", "socialMedia": "0.00" },
  "rows": [
    { "day": "2026-10-29", "branch": { "id": "3dc178fb-...", "code": "HAMRA", "name": "Hamra", "kind": "branch" },
      "salesCount": 1, "items": 2, "revenue": "50.00", "discounts": "0.00", "cash": "30.00", "whish": "20.00", "inStore": "50.00", "socialMedia": "0.00" }
  ]
}
```
`cash` and `whish` are the amounts paid by each method (the change given back is not counted). `top-skus` takes `limit` too (1 to 100, default 10) and returns `{ "from", "to", "rows": [ { "sku": {...}, "quantity": 2, "revenue": "50.00", "salesCount": 1 } ] }`, best sellers first.

#### `GET /audit-events`: who did what, and when (admin only)
Query: `entityType`, `entityId`, `actorId`, `branchId`, `from`, `to`, `limit`, `offset`. Newest first. Events are written by the server in the same transaction as the change and can never be edited.
```json
[ { "id": "cd1ded41-...", "occurredAt": "2026-10-29T00:12:33.661Z", "action": "reorder_level.set", "entityType": "reorder_level", "entityId": "da1eb79f-...", "branchId": "474c0bb0-...",
    "by": { "id": "58365707-...", "name": "Admin" }, "details": { "sku": "NK-CLUB-S-RED", "before": null, "after": { "min": 6, "target": null } } } ]
```
Today it records minimum changes and branch changes. Sales already carry their seller, and every stock movement carries who made it.

## Transfers: the warehouse sends, the branch confirms

A transfer moves pieces from one place to another: **warehouse to branch** (the warehouse "sells" to the branch: the branch is its customer), branch back to the warehouse, or branch to branch. There is no payment between them in the MVP.

```
draft  --dispatch-->  dispatched  --receive-->  partially_received  --receive-->  received   (everything arrived)
  |                        \                              |
  +--cancel--> cancelled    +-------- resolve (lost) -----+---------------------->  closed     (the rest was confirmed lost)
```

| Status | Meaning |
|---|---|
| `draft` | Prepared. **Nothing moves yet.** It can be cancelled |
| `dispatched` | Sent. The pieces left the sender and are **on the road** |
| `partially_received` | Some arrived, some are still on the road |
| `received` | Everything arrived |
| `closed` | The rest was confirmed **lost** by a manager. Nothing is on the road |
| `cancelled` | Cancelled while it was a draft |

**Where the pieces are, step by step** (example: 10 pieces, warehouse to Hamra):

| Step | Warehouse | Hamra on sale | Hamra on hold | Hamra on the road |
|---|---|---|---|---|
| Draft | 50 | 10 | 0 | 0 |
| Dispatch | **40** | 10 | 0 | **10** |
| Receive: 8 good, 1 damaged | 40 | **18** | **1** | **1** |
| Resolve: 1 lost | 40 | 18 | 1 | **0** |

"On the road" is shown at the **destination** (`inTransit`: coming to this place). The suggestions count it, so the warehouse is not asked to send twice.

**Who can do what.** Preparing, sending, confirming a loss and cancelling need `transfers.dispatch` (**admin and manager**); receiving needs `transfers.receive` (**also employees**).
The **sender** prepares, sends and cancels; the **destination** receives. The admin reaches every place. A manager reaches only their own branches, and a transfer that touches none of their places **does not exist** for them (`404`). Someone on the wrong side gets `403`.

**Every step that creates or moves something needs the header `Idempotency-Key`** (same rule as a sale): a new random value for each click, and the **same** value when retrying the **same** step. If the answer is lost and you retry, the server answers from the first time (header `Idempotent-Replay: true`) and nothing is done twice.

#### `POST /transfers`: prepare a draft
```json
{ "sourceBranchId": "<warehouse id>", "destinationBranchId": "<branch id>", "note": "weekly supply",
  "lines": [ { "skuId": "<sku id>", "quantity": 10 } ] }
```
`201`: the transfer (below). 1 to 50 lines, each sku once, quantity a whole number from 1 to 10000, two different **active** places, active skus. You can prepare a transfer only **from a place you reach**.

#### `POST /transfers/:id/dispatch`: send it
Body is optional. Send **less** than asked on some lines (the warehouse is short): `{ "lines": [ { "skuId": "...", "quantity": 6 } ] }`.
In one step the pieces leave the sender and go on the road. If the sender does not have enough: **`409`** with the items, and **nothing moves**:
```json
{ "message": "Not enough stock for one or more items",
  "details": [ { "skuId": "...", "skuCode": "JEAN-SLIM-32-BLUE", "requested": 500, "available": 40 } ] }
```
(Managers see that shortage in the alerts.) A transfer can be dispatched **once**: a second dispatch is `409`.

#### `POST /transfers/:id/receive`: say what arrived
```json
{ "lines": [ { "skuId": "<sku id>", "accepted": 8, "damaged": 1 } ] }
```
`accepted` goes on sale, `damaged` goes **on hold**. You can receive in several rounds. You cannot receive more than is still on the road (`409`, "Only N are still on the way for this sku"). Each line must say at least one piece.

#### `POST /transfers/:id/resolve`: confirm what never arrived is lost
```json
{ "reason": "One piece lost by the courier" }
```
`transfers.dispatch` required (a manager or the admin, **not** an employee). The reason is 3 to 200 characters. Without `lines`, everything still on the road is confirmed lost; or `{ "reason": "...", "lines": [ { "skuId": "...", "quantity": 1 } ] }` for some lines. The transfer becomes `closed` when nothing is left on the road.

#### `POST /transfers/:id/cancel`: a draft only
No body, no key needed. Asking again changes nothing. After dispatch it is `409`.

#### `GET /transfers/:id` and `GET /transfers`
`GET /transfers?branchId=...&status=...&limit=20&offset=0`: the admin sees every transfer, anyone else the ones that touch their places. Newest first. The header **`X-Total-Count`** gives the whole count (see "Pages"). In `api.ts`: `listTransfersPage()`.
```json
{
  "id": "668b4ab1-...", "reference": "T-00000001", "status": "closed",
  "from": { "id": "1c61ff81-...", "code": "WAREHOUSE", "name": "Main Warehouse", "kind": "warehouse" },
  "to":   { "id": "3dc178fb-...", "code": "HAMRA", "name": "Hamra", "kind": "branch" },
  "note": "weekly supply",
  "requestedBy": { "id": "58365707-...", "name": "Admin" }, "requestedAt": "2026-10-31T02:04:49.707Z",
  "dispatchedBy": { "id": "58365707-...", "name": "Admin" }, "dispatchedAt": "2026-10-31T02:04:49.924Z",
  "lines": [ { "sku": { "id": "2dae6572-...", "code": "JEAN-SLIM-32-BLUE", "styleName": "Slim Jeans", "size": "32", "color": "Blue" },
               "requested": 10, "dispatched": 10, "received": 9, "lost": 1, "onTheRoad": 0 } ],
  "totals": { "requested": 10, "dispatched": 10, "received": 9, "lost": 1, "onTheRoad": 0 }
}
```
**For the screens.** Warehouse: a "Prepare transfer" form (the suggestions list can fill it: "Hamra needs 12"), then a "Send" button, and a list filtered by `status=dispatched`. Branch: a list of what is **coming** (`status=dispatched` or `partially_received`), and a "Receive" screen with, per line, how many are good and how many are damaged. Show `onTheRoad` as "still on the way". A branch manager sees "Confirm lost" only when `onTheRoad > 0`.

## What the owner manages: categories, deleting, sales history, restock requests

#### Categories
A list the owner manages. A product can only use a category **that exists** (`400 This category does not exist: add it in Categories first`).
- `GET /categories` (anyone): `[ { id, name, isActive, productCount, createdAt } ]`. `?activeOnly=true`.
- `POST /categories` `{ "name": "Evening Wear" }` (manager, admin): `201`. `409` if the name exists (`Dresses` and `dresses` are the same).
- `PATCH /categories/:id` `{ "name"?, "isActive"? }`: renaming **renames it on every product** that uses it.
- `DELETE /categories/:id`: `204`, or `409` "N product(s) use this category" (move them, or deactivate it).
`api.ts`: `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`.

#### Deleting
Allowed **only when nothing in the history points at the thing**; otherwise `409` and the message says to archive or deactivate instead.
| Call | Who | Refused when |
|---|---|---|
| `DELETE /styles/:id` | manager, admin | any of its skus has sales, stock movements or transfers (a clean product is deleted **with** its skus, barcodes and price history) |
| `DELETE /skus/:id` | manager, admin | the sku has history |
| `DELETE /branches/:id` | admin | the branch has sales, stock, transfers or recorded changes (even a rename) |
| `DELETE /users/:id` | admin | **never refused for history**: it is a **soft delete**: the user disappears from the list, cannot log in (their old token stops working) and their email is free again, but **everything they did stays** (sales, stock movements, transfers keep their name). `409` for yourself and for the last active admin |
To archive instead: `PATCH` with `isActive: false` (styles, skus, branches, users). Deactivating a user or a branch is reversible.

#### Sales history of any period
`GET /sales/history?branchId=&from=&to=&limit=&offset=` returns `{ from, to, sales: [ { id, reference, branch, soldAt, businessDate, soldBy, status, channel, items, total, discounts, cash, whish } ] }`, newest first, and the whole count in `X-Total-Count`. Dates are `YYYY-MM-DD` (the Lebanese shop day, at most 366 days; with only `from` you get that one day). The admin sees every branch, anyone else only their own. For totals and charts use `GET /reports/sales-summary`. `api.ts`: `getSalesHistory`.

#### A branch asks the warehouse to restock it
1. `GET /warehouse` (anyone): `{ id, code, name }`. Nothing about its stock. (A branch user does not see the warehouse in `GET /branches`.)
2. `POST /transfers` with `sourceBranchId` = the warehouse id and `destinationBranchId` = the user's own branch: a **draft** (a request). Employees and managers can do it. Nothing moves.
3. The warehouse (admin, or the warehouse's manager) reviews it and **sends** it (`/dispatch`) or **cancels** it. The branch then **receives** it.
The one who asked can **cancel** their own request while it is a draft, but cannot send it. A transfer between two places that are not yours is still `403`.

#### Permissions of one user (admin only)
Give one user a **specific permission** on top of their role, or take one away: say an **employee who may create products**.
- `GET /permissions`: every permission with `label`, `description`, `grantable`, and what each role has by default (to build the checkboxes).
- `GET /users/:id/permissions`: `permissions: [ { key, label, description, allowed, source } ]` with `source` = `role` / `granted` / `denied` / `none`.
- `PUT /users/:id/permissions` `{ "permissions": { "catalog.create": true } }`: the state you want (`true` can, `false` cannot) for the ones you list; the server keeps only what differs from the role. Takes effect on the user's **next request**.
`409` for yourself and for an admin (an admin has everything). `400` for an unknown key, for `users.administer` (admin only, never granted) or a value that is not true or false. New user: `POST /users`, then `PUT .../permissions`. `api.ts`: `getPermissionCatalog`, `getUserPermissions`, `setUserPermissions`.

---

## 6. Error messages you will see

| Status | `message` |
|---|---|
| 400 | `Email and password are required` (login) |
| 400 | `Invalid JSON body` |
| 400 | `Email is invalid` / `Email is required` |
| 400 | `Password must be at least 8 characters` / `Password is required` (set password) |
| 400 | `Passwords are set with PUT /users/:id/password` (a password was sent to `POST /users` or `PATCH /users/:id`) |
| 400 | `Role must be one of: admin, manager, employee` |
| 400 | `Standard price must be a number zero or greater with at most 2 decimals` (also `Price ...`) |
| 400 | `limit must be a whole number between 1 and 200` / `offset must be a whole number, zero or greater` |
| 400 | `The Idempotency-Key header is required (8 to 200 characters): send a new random id for each sale` |
| 400 | `The payments add up to 20.00 but the sale total is 25.00: a sale must be paid in full` |
| 400 | `A discount needs a reason` / `A price override cannot be higher than the catalog price` |
| 400 | `Each sku can appear only once in a sale: raise its quantity instead` |
| 400 | `A Whish payment needs the transfer reference` / `The cash given cannot be less than the cash amount` |
| 400 | `Style code is required` / `Sku code may only contain letters, digits and . _ / -` / `Barcode may not contain spaces or special characters` |
| 400 | `Full name must be between 2 and 100 characters` |
| 400 | `Branch code may only contain letters, digits, "-" and "_"` |
| 401 | `Invalid email or password` (login only) |
| 401 | `Authentication required` (no token) |
| 401 | `Invalid or expired token` |
| 403 | `Insufficient role` (users and branches: admin only) |
| 403 | `Missing permission: catalog.create` (changing the catalog) |
| 403 | `Missing permission: discounts.apply` (a discount in a sale) |
| 403 | `You cannot sell at this branch` / `You cannot see the stock of this branch` |
| 404 | `User not found` / `Branch not found` / `Style not found` / `Sku not found` / `Barcode not found` / `Resource not found` |
| 404 | `No sku matches this code` (scanner lookup) |
| 409 | `A user with this email already exists` |
| 409 | `A branch with this code already exists` |
| 409 | `You cannot change your own role or deactivate your own account` |
| 409 | `You cannot delete your own account` |
| 409 | `This user has history (other records point at them) and cannot be deleted. Deactivate the user instead.` |
| 409 | `Cannot grant access to an inactive branch` |
| 409 | `A style with this code already exists` |
| 409 | `A sku with this code already exists` |
| 409 | `This style already has a sku with the same size and color` |
| 409 | `This style is inactive: activate it before adding skus` |
| 409 | `This barcode already belongs to a sku` |
| 409 | `There is already a warehouse` / `This branch already has sales or minimum levels: it cannot become the warehouse` |
| 409 | `The warehouse does not sell to customers: it supplies the branches` |
| 409 | `The warehouse has no minimum: it supplies the branches` |
| 409 | `Only a draft can be dispatched` / `Only a draft can be cancelled` / `Only a transfer on the road can be received` |
| 409 | `Only N are still on the way for this sku` |
| 403 | `Only the sending place can dispatch` / `Only the receiving place can receive` |
| 403 | `You can prepare a transfer that leaves one of your places, or ask the warehouse to restock one of yours` |
| 400 | `This category does not exist: add it in Categories first` |
| 409 | `N product(s) use this category...` / `This product has history ... archive it instead` / `This place has history ... deactivate it instead` |
| 403 | `Insufficient role` (admin-only endpoints: stock overview, audit log, changing a branch) |
| 403 | `You cannot change the minimums of this branch` / `You cannot see this branch` |
| 409 | `Not enough stock for one or more items` (with `details`) |
| 409 | `This Whish reference was already used for another payment` |
| 409 | `This Idempotency-Key was already used for a different request` |
| 409 | `Sku ... is not for sale` (inactive sku or style) |
| 409 | `Opening stock can only be set for a sku that has no movement yet at this branch` |
| 413 | `Request body too large` |
| 500 | `Internal Server Error` |

Show `message` as-is for 400 and 409. For 401 and 403 show your own friendly text.

---

## 7. Typed fetch client (copy to the frontend)

Tested against the running API.

```ts
// api.ts: a tiny typed client for the Bitar API. Copy it into the frontend project.
// Next.js: set NEXT_PUBLIC_API_URL in .env.local (e.g. http://localhost:3000)

export type UserRole = 'admin' | 'manager' | 'employee';

export interface User {
    id: string;                    // uuid
    email: string;                 // always lower case
    fullName: string;
    role: UserRole;
    isActive: boolean;
    hasPassword: boolean;          // false = created but no password set yet: this user cannot log in
    deactivatedAt: string | null;  // ISO date, or null while active
    createdAt: string;             // ISO date (UTC)
    updatedAt: string;
}

// 'warehouse' is the MAIN INVENTORY: it supplies the branches and never sells to customers. There is only one.
export type BranchKind = 'branch' | 'warehouse';

export interface Branch {
    id: string;                    // uuid
    code: string;                  // always UPPER CASE, e.g. "HAMRA"
    name: string;
    isActive: boolean;
    kind: BranchKind;
    createdAt: string;
}

export interface LoginResult {
    token: string;                 // send it as "Authorization: Bearer <token>" on every request
    user: User;
}

export interface Me {
    user: User;
    permissions: string[];         // e.g. "users.administer", "sales.create": show/hide UI with these
    branchIds: string[];           // branches this user may work in (admins reach every branch)
    canViewCosts: boolean;         // false for employees: never show cost prices to them
}

// ---- catalog -------------------------------------------------------------------------------------------
// Money is ALWAYS a string with 2 decimals ("25.00"), never a JSON number. When you SEND a price, a string or a number is fine.
export interface Style {                 // the MODEL of a garment ("Nike Club Tee")
    id: string;
    code: string;                        // always UPPER CASE, never changes
    name: string;
    category: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Sku {                   // one SELLABLE variant: a style in one size and one color
    id: string;
    styleId: string;
    skuCode: string;                     // always UPPER CASE, never changes
    size: string;
    color: string;
    standardPrice: string;               // "25.00"
    currency: string;                    // "USD"
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SkuWithStyle extends Sku {
    style: { id: string; code: string; name: string };
}

export interface Barcode {
    id: string;
    skuId: string;
    code: string;                        // exactly as scanned (case kept)
    createdAt: string;
}

export interface SkuDetail extends SkuWithStyle {
    barcodes: Barcode[];
}

export interface StyleDetail extends Style {
    skus: Sku[];
}

export interface PriceChange {
    id: string;
    skuId: string;
    oldPrice: string | null;             // null = the first price this sku ever had
    newPrice: string;
    effectiveAt: string;
    changedBy: string;                   // user id
}

export interface CreateStyleInput {
    code: string;
    name: string;
    category?: string | null;
}

export interface UpdateStyleInput {      // send ONLY what changes; the code cannot change
    name?: string;
    category?: string | null;            // null or "" clears it
    isActive?: boolean;
}

export interface CreateSkuInput {
    styleId: string;
    skuCode: string;
    size: string;
    color: string;
    standardPrice: string | number;
    currency?: string;                   // default "USD"
}

export interface UpdateSkuInput {        // size, color and the active flag only: the code and the price have their own rules
    size?: string;
    color?: string;
    isActive?: boolean;
}

export interface StyleListParams { search?: string; activeOnly?: boolean; limit?: number; offset?: number }
export interface SkuListParams extends StyleListParams { styleId?: string }

// ---- stock and sales -----------------------------------------------------------------------------------
export interface StockItem {
    sku: SkuWithStyle;
    sellable: number;        // can be sold now. THIS is the number the till checks
    nonSellable: number;     // in the shop but not for sale (damaged, on hold)
    inTransit: number;       // on the road between two places
}

export type PaymentMethod = 'cash' | 'whish';
export type SocialPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'other';

export interface PaymentInput {
    method: PaymentMethod;
    amount: string | number;            // the part of the sale paid with this method
    tendered?: string | number;         // cash only: what the customer handed over (default: exactly the amount)
    reference?: string;                 // Whish only: the transfer reference the business verified. Required.
}

// A discount needs the discounts.apply permission (managers). An employee asks, a manager does it.
export type DiscountInput =
    | { type: 'percent'; percent: string | number; reason: string }
    | { type: 'override'; unitPrice: string | number; reason: string };

export interface SaleLineInput {
    skuId: string;
    quantity: number;                   // a whole number, 1 or more. NO price: the server reads it from the catalog
    discount?: DiscountInput;
}

export interface CreateSaleInput {
    branchId: string;
    channel?: 'in_store' | 'social_media';       // default in_store
    socialPlatform?: SocialPlatform;             // required when channel is social_media
    note?: string;
    lines: SaleLineInput[];
    payments: PaymentInput[];                    // must add up to the total, to the cent (none for a free sale)
}

export interface SaleLine {
    lineNo: number;
    skuId: string;
    skuCode: string;
    styleName: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: string;                           // the catalog price at the moment of the sale, never changes afterwards
    discount: null | { type: 'percent'; percent: string; reason: string; approvedBy: string } | { type: 'override'; unitPrice: string; reason: string; approvedBy: string };
    lineTotal: string;
}

export interface SalePayment {
    method: PaymentMethod;
    amount: string;
    tendered: string | null;                     // cash only
    change: string | null;                       // cash only: tendered minus amount
    reference: string | null;                    // Whish only
}

// Everything a printed receipt needs.
export interface Sale {
    id: string;
    reference: string;                           // "S-00000012"
    branchId: string;
    soldBy: { id: string; name: string | null };
    status: string;                              // "completed"
    channel: string;
    socialPlatform: string | null;
    currency: string;
    subtotal: string;
    totalDiscount: string;
    total: string;
    totalPaid: string;                           // always equal to total
    soldAt: string;
    businessDate: string;                        // the shop day, YYYY-MM-DD (Lebanon time)
    note: string | null;
    lines: SaleLine[];
    payments: SalePayment[];
}

// What ApiError.details holds for a 409 "Not enough stock for one or more items"
export interface StockShortage {
    skuId: string;
    skuCode: string;
    requested: number;
    available: number;
}

export interface SaleListParams { branchId: string; date?: string; limit?: number; offset?: number }
export interface StockListParams { branchId: string; search?: string; styleId?: string; activeOnly?: boolean; limit?: number; offset?: number }

// ONE new key for each sale (each press of "complete sale"). If the network fails, send the SAME request with
// the SAME key again: the sale is never made twice. After a success, the next sale gets a NEW key.
export const newIdempotencyKey = (): string => crypto.randomUUID();

// ---- the warehouse view: every place at once, the minimums, what to send, reports, the audit log ------------------
export interface Location {
    id: string;
    code: string;
    name: string;
    kind: BranchKind;
}

export interface Quantities {
    sellable: number;
    nonSellable: number;
    inTransit: number;
}

// ADMIN ONLY. One column per place (the warehouse first), one row per sku.
export interface StockOverview {
    locations: Location[];
    items: {
        sku: SkuWithStyle;
        totals: Quantities;
        locations: (Quantities & { branchId: string; minQuantity: number | null; targetQuantity: number | null; belowMinimum: boolean })[];
    }[];
}

export interface StockOverviewParams { search?: string; styleId?: string; activeOnly?: boolean; limit?: number; offset?: number }

export interface StockMovement {
    id: string;
    occurredAt: string;
    type: string;                  // 'sale', 'opening', ...
    bucket: string;
    quantityDelta: number;         // negative when stock left
    balanceAfter: number;
    sku: { id: string; code: string };
    by: { id: string; name: string | null };
    saleId: string | null;
    reason: string | null;
}

export interface StockMovementParams { branchId: string; skuId?: string; type?: string; from?: string; to?: string; limit?: number; offset?: number }

export interface ReorderLevel {
    id: string;
    branchId: string;
    sku: { id: string; code: string; styleName: string; size: string; color: string };
    minQuantity: number;
    targetQuantity: number | null;
    updatedAt: string;
}

export interface SetReorderLevelInput { branchId: string; skuId: string; minQuantity: number; targetQuantity?: number }
// "per model": the same minimum for every ACTIVE size and color of a style at one branch
export interface SetReorderLevelForStyleInput { branchId: string; styleId: string; minQuantity: number; targetQuantity?: number }

export interface ReplenishmentSuggestion {
    branch: Location;
    sku: { id: string; code: string; styleName: string; size: string; color: string };
    sellable: number;
    inTransit: number;
    minQuantity: number;
    targetQuantity: number | null;
    suggested: number;             // to bring the branch back to its target (or minimum)
    warehouseSellable: number;     // what the warehouse has of this sku
    fillable: number;              // what the warehouse can send now (the smaller of the two)
}

export interface ReplenishmentSuggestions {
    warehouse: Location | null;
    suggestions: ReplenishmentSuggestion[];
}

export interface SalesSummaryRow {
    salesCount: number;
    items: number;
    revenue: string;
    discounts: string;
    cash: string;
    whish: string;
    inStore: string;
    socialMedia: string;
}

export interface SalesSummary {
    from: string;
    to: string;
    totals: SalesSummaryRow;
    rows: (SalesSummaryRow & { day: string; branch: Location | { id: string } })[];
}

export interface DateRangeParams { branchId?: string; from?: string; to?: string }   // dates: YYYY-MM-DD, the shop day (Lebanon time)

export interface TopSkusResult {
    from: string;
    to: string;
    rows: { sku: { id: string; code: string; styleName: string; size: string; color: string }; quantity: number; revenue: string; salesCount: number }[];
}

export interface AuditEvent {
    id: string;
    occurredAt: string;
    action: string;                // 'reorder_level.set', 'branch.update', ...
    entityType: string;
    entityId: string | null;
    branchId: string | null;
    by: { id: string; name: string | null };
    details: Record<string, unknown>;   // usually { before, after }
}

export interface AuditParams { entityType?: string; entityId?: string; actorId?: string; branchId?: string; from?: string; to?: string; limit?: number; offset?: number }

// ---- transfers: the warehouse sends to a branch, a branch sends back, or to another branch -------------------------
// draft -> dispatched -> partially_received -> received (all arrived) or closed (the rest was confirmed lost); a draft can be cancelled
export type TransferStatus = 'draft' | 'dispatched' | 'partially_received' | 'received' | 'closed' | 'cancelled';

export interface TransferLine {
    sku: { id: string; code: string; styleName: string; size: string; color: string };
    requested: number;
    dispatched: number;
    received: number;       // arrived, good or damaged
    lost: number;           // confirmed lost
    onTheRoad: number;      // dispatched - received - lost
}

export interface Transfer {
    id: string;
    reference: string;      // "T-00000001"
    status: TransferStatus;
    from: Location;
    to: Location;
    note: string | null;
    requestedBy: { id: string; name: string | null };
    requestedAt: string;
    dispatchedBy: { id: string; name: string | null } | null;
    dispatchedAt: string | null;
    lines: TransferLine[];
    totals: { requested: number; dispatched: number; received: number; lost: number; onTheRoad: number };
}

export interface CreateTransferInput {
    sourceBranchId: string;
    destinationBranchId: string;
    note?: string;
    lines: { skuId: string; quantity: number }[];
}

export interface ListTransfersParams { branchId?: string; status?: TransferStatus; limit?: number; offset?: number }

// ---- categories, the sales history, the warehouse lookup (1 Nov) --------------------------------------------------
export interface Category {
    id: string;
    name: string;
    isActive: boolean;
    productCount: number;      // how many products use it
    createdAt: string;
}

export interface SaleHistoryRow {
    id: string;
    reference: string;
    branch: { id: string; code: string; name: string };
    soldAt: string;
    businessDate: string;      // the shop day (Lebanese day)
    soldBy: { id: string; name: string | null };   // still there after the user is deleted
    status: string;
    channel: string;
    items: number;
    total: string;
    discounts: string;
    cash: string;
    whish: string;
}

export interface SalesHistoryParams { branchId?: string; from?: string; to?: string; limit?: number; offset?: number }   // dates: YYYY-MM-DD

// ---- permissions of one user ------------------------------------------------------------------------------------
export type PermissionSource = 'role' | 'granted' | 'denied' | 'none';   // role: comes with the role · granted: added for this person · denied: taken away · none: not allowed

export interface PermissionLine {
    key: string;               // 'catalog.create'
    label: string;             // words for the checkbox
    description: string;       // the hint under it
    allowed: boolean;
    source: PermissionSource;
}

export interface PermissionCatalog {
    permissions: { key: string; label: string; description: string; grantable: boolean }[];   // grantable false: 'users.administer', admin only
    roles: Record<string, string[]>;                                                           // what each role has by default
}

export interface UserPermissions {
    user: { id: string; fullName: string; role: string; isActive: boolean };
    permissions: PermissionLine[];
    overrides: { permission: string; effect: 'allow' | 'deny' }[];
}

export interface CreateUserInput {   // a user is created WITHOUT a password: set it afterwards with setUserPassword
    email: string;
    fullName: string;
    role: UserRole;
}

export interface UpdateUserInput {   // send ONLY the fields you want to change (passwords have their own call)
    email?: string;
    fullName?: string;
    role?: UserRole;
    isActive?: boolean;
}

export interface CreateBranchInput {
    code: string;
    name: string;
    kind?: BranchKind;             // default 'branch'
}

// at least one field. A branch that already has sales or minimums cannot become the warehouse.
export interface UpdateBranchInput {
    name?: string;
    isActive?: boolean;
    kind?: BranchKind;
}

// Every failure from the API becomes an ApiError: status = HTTP status, message = text you can show the user.
export class ApiError extends Error {
    constructor(public readonly status: number, message: string, public readonly details?: unknown) {
        super(message);
        this.name = 'ApiError';
    }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, token: string | null, method = 'GET', body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...extraHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return undefined as T;   // success with no body

    const data = (await response.json().catch(() => null)) as { message?: string; details?: unknown } | null;
    if (!response.ok) throw new ApiError(response.status, data?.message ?? 'Request failed', data?.details);
    return data as T;
}

// A list page and how many items the WHOLE list has (the server sends it in the X-Total-Count header).
// hasMore = offset + items.length < total. The page number = Math.floor(offset / limit) + 1, the pages = Math.ceil(total / limit).
export interface Page<T> {
    items: T[];
    total: number;
}

async function requestPage<T>(path: string, token: string | null): Promise<Page<T>> {
    const response = await fetch(`${BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const data = (await response.json().catch(() => null)) as T[] | { message?: string; details?: unknown } | null;
    if (!response.ok) throw new ApiError(response.status, (data as { message?: string } | null)?.message ?? 'Request failed', (data as { details?: unknown } | null)?.details);
    const items = data as T[];
    return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
}

// The same, for an answer that is an object (not a list) with the whole count in X-Total-Count: the sales history.
async function requestWithTotal<T>(path: string, token: string | null): Promise<{ data: T; total: number }> {
    const response = await fetch(`${BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const data = (await response.json().catch(() => null)) as T | { message?: string; details?: unknown } | null;
    if (!response.ok) throw new ApiError(response.status, (data as { message?: string } | null)?.message ?? 'Request failed', (data as { details?: unknown } | null)?.details);
    return { data: data as T, total: Number(response.headers.get('X-Total-Count') ?? 0) };
}

function query(params: object): string {
    const parts = Object.entries(params as Record<string, string | number | boolean | undefined>)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    return parts.length ? `?${parts.join('&')}` : '';
}

// The only call that needs no token. Wrong email or password -> ApiError with status 401.
export const login = (email: string, password: string) =>
    request<LoginResult>('/auth/login', null, 'POST', { email, password });

// Everything else needs the token from login(). A 401 means: expired or invalid -> go back to the login screen.
export const createApi = (token: string) => ({
    me: () => request<Me>('/auth/me', token),
    listUsers: () => request<User[]>('/users', token),
    createUser: (input: CreateUserInput) => request<User>('/users', token, 'POST', input),
    updateUser: (id: string, changes: UpdateUserInput) => request<User>(`/users/${id}`, token, 'PATCH', changes),
    // permanent delete: works only for a user nothing refers to; otherwise ApiError 409 -> deactivate them instead
    deleteUser: (id: string) => request<void>(`/users/${id}`, token, 'DELETE'),      // admin only: the user disappears and cannot log in, their history stays
    // sets the first password AND resets a forgotten one (admin only). The password is never returned.
    setUserPassword: (id: string, password: string) => request<void>(`/users/${id}/password`, token, 'PUT', { password }),
    grantBranchAccess: (id: string, branchId: string) => request<void>(`/users/${id}/branches/${branchId}`, token, 'PUT'),
    revokeBranchAccess: (id: string, branchId: string) => request<void>(`/users/${id}/branches/${branchId}`, token, 'DELETE'),
    listBranches: () => request<Branch[]>('/branches', token),

    // ---- stock and sales
    listStock: (params: StockListParams) => request<StockItem[]>(`/stock${query(params)}`, token),
    // the same list, with the total: use it for "load more" or "page 2 of 7" (limit 20, offset 0, 20, 40...)
    listStockPage: (params: StockListParams) => requestPage<StockItem>(`/stock${query(params)}`, token),
    // idempotencyKey: use newIdempotencyKey() once per sale, and reuse it when retrying the SAME sale
    createSale: (input: CreateSaleInput, idempotencyKey: string) => request<Sale>('/sales', token, 'POST', input, { 'Idempotency-Key': idempotencyKey }),
    getSale: (id: string) => request<Sale>(`/sales/${id}`, token),
    listSales: (params: SaleListParams) => request<{ businessDate: string; sales: Sale[] }>(`/sales${query(params)}`, token),
    // admin and manager: the counted quantities on the day the system starts, once per sku per branch
    setOpeningStock: (branchId: string, lines: { skuId: string; quantity: number }[], idempotencyKey: string) =>
        request<{ batchId: string; lines: number }>('/stock/opening', token, 'POST', { branchId, lines }, { 'Idempotency-Key': idempotencyKey }),

    // ---- catalog: any logged-in user may read; changing needs the catalog.create permission (admin and manager)
    listStyles: (params: StyleListParams = {}) => request<Style[]>(`/styles${query(params)}`, token),
    getStyle: (id: string) => request<StyleDetail>(`/styles/${id}`, token),
    createStyle: (input: CreateStyleInput) => request<Style>('/styles', token, 'POST', input),
    updateStyle: (id: string, changes: UpdateStyleInput) => request<Style>(`/styles/${id}`, token, 'PATCH', changes),

    listSkus: (params: SkuListParams = {}) => request<SkuWithStyle[]>(`/skus${query(params)}`, token),
    getSku: (id: string) => request<SkuDetail>(`/skus/${id}`, token),
    // what the scanner does at the till: the text it typed is a barcode or a sku code. 404 = nothing matches
    lookupSku: (code: string) => request<SkuDetail>(`/skus/lookup${query({ code })}`, token),
    createSku: (input: CreateSkuInput) => request<Sku>('/skus', token, 'POST', input),
    updateSku: (id: string, changes: UpdateSkuInput) => request<Sku>(`/skus/${id}`, token, 'PATCH', changes),
    changeSkuPrice: (id: string, price: string | number) => request<Sku>(`/skus/${id}/price`, token, 'PUT', { price }),
    getPriceHistory: (id: string, limit?: number) => request<PriceChange[]>(`/skus/${id}/price-history${query({ limit })}`, token),
    addBarcode: (skuId: string, code: string) => request<Barcode>(`/skus/${skuId}/barcodes`, token, 'POST', { code }),
    removeBarcode: (barcodeId: string) => request<void>(`/barcodes/${barcodeId}`, token, 'DELETE'),
    createBranch: (input: CreateBranchInput) => request<Branch>('/branches', token, 'POST', input),
    updateBranch: (id: string, input: UpdateBranchInput) => request<Branch>(`/branches/${id}`, token, 'PATCH', input),

    // ---- the warehouse view
    getStockOverview: (params: StockOverviewParams = {}) => request<StockOverview>(`/stock/overview${query(params)}`, token),                // admin only
    listStockMovements: (params: StockMovementParams) => request<StockMovement[]>(`/stock/movements${query(params)}`, token),                // admin and managers (their branches)
    listReorderLevels: (params: { branchId: string; search?: string; limit?: number; offset?: number }) => request<ReorderLevel[]>(`/reorder-levels${query(params)}`, token),
    setReorderLevel: (input: SetReorderLevelInput) => request<ReorderLevel>('/reorder-levels', token, 'PUT', input),
    setReorderLevelForStyle: (input: SetReorderLevelForStyleInput) => request<{ styleId: string; skus: number }>('/reorder-levels/by-style', token, 'PUT', input),
    deleteReorderLevel: (id: string) => request<void>(`/reorder-levels/${id}`, token, 'DELETE'),
    // ---- transfers. Every step that creates or moves anything needs its own idempotencyKey: newIdempotencyKey() once per
    // click, and the SAME key when retrying the SAME step. The server answers from the first time (header Idempotent-Replay).
    listTransfersPage: (params: ListTransfersParams = {}) => requestPage<Transfer>(`/transfers${query(params)}`, token),
    getTransfer: (id: string) => request<Transfer>(`/transfers/${id}`, token),
    createTransfer: (input: CreateTransferInput, idempotencyKey: string) => request<Transfer>('/transfers', token, 'POST', input, { 'Idempotency-Key': idempotencyKey }),
    // lines is optional: send LESS than asked on some lines (the warehouse is short). 409 with details when the sender lacks stock.
    dispatchTransfer: (id: string, idempotencyKey: string, lines?: { skuId: string; quantity: number }[]) =>
        request<Transfer>(`/transfers/${id}/dispatch`, token, 'POST', lines ? { lines } : {}, { 'Idempotency-Key': idempotencyKey }),
    // what arrived: accepted goes on sale, damaged goes on hold. Can be done in several rounds.
    receiveTransfer: (id: string, lines: { skuId: string; accepted: number; damaged?: number }[], idempotencyKey: string) =>
        request<Transfer>(`/transfers/${id}/receive`, token, 'POST', { lines }, { 'Idempotency-Key': idempotencyKey }),
    // a manager confirms what never arrived is lost (a reason of 3 to 200 characters is required). Without lines: everything still on the road.
    resolveTransfer: (id: string, reason: string, idempotencyKey: string, lines?: { skuId: string; quantity: number }[]) =>
        request<Transfer>(`/transfers/${id}/resolve`, token, 'POST', { reason, ...(lines ? { lines } : {}) }, { 'Idempotency-Key': idempotencyKey }),
    cancelTransfer: (id: string) => request<Transfer>(`/transfers/${id}/cancel`, token, 'POST'),    // a draft only

    // ---- permissions of one user (admin only). A new user: createUser(...), then setUserPermissions(id, { 'catalog.create': true }).
    getPermissionCatalog: () => request<PermissionCatalog>('/permissions', token),
    getUserPermissions: (id: string) => request<UserPermissions>(`/users/${id}/permissions`, token),
    // the state you WANT for the permissions you list (true can, false cannot); send only what changed. Takes effect on the user's next request.
    setUserPermissions: (id: string, permissions: Record<string, boolean>) => request<UserPermissions>(`/users/${id}/permissions`, token, 'PUT', { permissions }),

    // ---- categories (a list the owner manages: a product can only use a category that exists)
    listCategories: (params: { activeOnly?: boolean } = {}) => request<Category[]>(`/categories${query(params)}`, token),
    createCategory: (name: string) => request<Category>('/categories', token, 'POST', { name }),
    updateCategory: (id: string, input: { name?: string; isActive?: boolean }) => request<Category>(`/categories/${id}`, token, 'PATCH', input),     // a rename follows on every product
    deleteCategory: (id: string) => request<void>(`/categories/${id}`, token, 'DELETE'),                                                              // 409 while products use it

    // ---- deleting: allowed only when nothing in the history points at it, otherwise 409 and the message says "archive/deactivate instead"
    deleteStyle: (id: string) => request<void>(`/styles/${id}`, token, 'DELETE'),
    deleteSku: (id: string) => request<void>(`/skus/${id}`, token, 'DELETE'),
    deleteBranch: (id: string) => request<void>(`/branches/${id}`, token, 'DELETE'),                 // admin only

    // ---- sales history of any period, with the whole count
    getSalesHistory: async (params: SalesHistoryParams = {}) => {
        const { data, total } = await requestWithTotal<{ from: string; to: string; sales: SaleHistoryRow[] }>(`/sales/history${query(params)}`, token);
        return { ...data, total };
    },

    // ---- which place is the warehouse (anyone may ask), to ask it to restock the user's branch with createTransfer({ sourceBranchId: warehouse.id, destinationBranchId: myBranch, ... })
    getWarehouse: () => request<{ id: string; code: string; name: string }>('/warehouse', token),

    getReplenishmentSuggestions: (params: { branchId?: string } = {}) => request<ReplenishmentSuggestions>(`/replenishment/suggestions${query(params)}`, token),
    getSalesSummary: (params: DateRangeParams = {}) => request<SalesSummary>(`/reports/sales-summary${query(params)}`, token),
    getTopSkus: (params: DateRangeParams & { limit?: number } = {}) => request<TopSkusResult>(`/reports/top-skus${query(params)}`, token),
    listAuditEvents: (params: AuditParams = {}) => request<AuditEvent[]>(`/audit-events${query(params)}`, token),                          // admin only
});
```

Usage:

```ts
import { ApiError, createApi, login } from './api';

try {
  const { token, user } = await login(email, password);   // 401 = wrong email or password, or no password set yet
  saveToken(token);                                        // your own storage helper
  const api = createApi(token);
  const me = await api.me();                               // permissions, branchIds, canViewCosts
  const branches = await api.listBranches();
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 401) { /* clear the token and show the login screen */ }
    else showToast(error.message);                         // 400 and 409 messages are meant for users
  } else {
    throw error;                                           // network down, etc.
  }
}
```

---

## 8. Connecting the existing UI (`inventory-provider.tsx`)

The current UI keeps everything in `localStorage` and its provider functions are **synchronous** (`ActionResult`). API calls are asynchronous, so when you connect them: make the actions `async`, add loading and error state to the forms, and show `error.message`.

| In the UI today | With the API |
|---|---|
| "Your name" in Settings | the logged-in user from `/auth/me` (`fullName`) |
| Branch `type` (`store` / `warehouse`) and `address` | **not in the API yet** (planned) |
| Delete a branch / delete a product | the API never deletes: use `isActive` (branches are only created and listed for now) |
| A "product" | a **style** with its **skus** (size and color variants). The UI needs a variant picker; stock is counted per sku |
| Stock levels and sales | **available** (`GET /stock`, `POST /sales`). The till needs: scanner lookup, a cart, payments that add up, and a receipt |
| Warehouse view, minimums, suggestions, reports | **available**: see the section "The warehouse view". Admin screens: stock of every place, minimums, what to send, sales per branch |
| Transfers | **available**: see the section "Transfers". Warehouse: prepare, send. Branch: receive (good and damaged), confirm a loss |
| Transfers and returns | **not built yet**: keep them local until their endpoints are published here |

Connect in this order: **login and `/auth/me`**, then **branches**, then **catalog** (list, search, scan), then **users**. Do not fake the parts that don't exist yet.

---

## 9. Coming next (don't build these yet)

Reserving stock when a transfer is approved, the supply **invoice** (PDF), returns, social media orders, branch prices. The reports will grow with them (what the warehouse supplied to each branch). This guide is updated when each one ships.
