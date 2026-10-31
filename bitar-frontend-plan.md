# Frontend–Backend Integration

This document describes the HTTP API currently exposed by the Bitar Store backend.
It includes user and branch administration, the product catalog (styles, SKUs,
barcodes, and SKU price history), sales, and branch stock.

## Base URL and requests

The backend defaults to `http://localhost:3000`. The frontend should use the deployed
backend URL in production and keep it in frontend environment configuration rather
than hard-coding it in components.

Send JSON with `Content-Type: application/json` for requests with a body. API routes
are mounted at the root; for example, login is `POST /auth/login`.

Successful responses containing data use JSON. A `204 No Content` response has no
body. Dates are returned as ISO 8601 strings.

## Authentication

### Log in

`POST /auth/login` is public.

Request:

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

Response (`200`):

```json
{
  "token": "<access-token>",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "fullName": "Admin",
    "role": "admin",
    "isActive": true,
    "hasPassword": true,
    "deactivatedAt": null,
    "createdAt": "2026-01-01T12:00:00.000Z",
    "updatedAt": "2026-01-01T12:00:00.000Z"
  }
}
```

For protected requests, send the returned token as:

```http
Authorization: Bearer <access-token>
```

The configured token lifetime defaults to 8 hours. If a request returns `401`,
clear the saved session and ask the user to sign in again.

### Get the current user and access

`GET /auth/me` requires a bearer token.

Response (`200`):

```json
{
  "user": { "id": "uuid", "email": "admin@example.com", "fullName": "Admin", "role": "admin" },
  "permissions": ["catalog.create", "users.administer"],
  "branchIds": ["branch-uuid"],
  "canViewCosts": true
}
```

The response's `user` object has the same complete shape as the login response.
Call this endpoint after login and when restoring a saved session. Use the returned
permissions and branch IDs to control the UI, but treat the backend's `401`/`403`
responses as authoritative.

## Endpoints

Unless marked **Public**, requests require `Authorization: Bearer <token>`.
Admin-only routes require the `admin` role.

| Method | Path | Access | Request body | Success |
|---|---|---|---|---|
| `GET` | `/health` | Public | — | `200` `{ "status": "ok"  }` |
| `POST` | `/auth/login` | Public | `{ "email", "password" }` | `200` token and user |
| `GET` | `/auth/me` | Authenticated | — | `200` user and access context |
| `GET` | `/branches` | Authenticated | — | `200` array of visible branches |
| `POST` | `/branches` | Admin | `{ "code", "name" }` | `201` branch |
| `GET` | `/styles` | Authenticated | — | `200` array of styles |
| `POST` | `/styles` | `catalog.create` | `{ "code", "name", "category?" }` | `201` style |
| `GET` | `/styles/:id` | Authenticated | — | `200` style with its SKUs |
| `PATCH` | `/styles/:id` | `catalog.create` | Any of `name`, `category`, `isActive` | `200` style |
| `GET` | `/skus` | Authenticated | — | `200` array of SKUs with style summaries |
| `POST` | `/skus` | `catalog.create` | `{ "styleId", "skuCode", "size", "color", "standardPrice", "currency?" }` | `201` SKU |
| `GET` | `/skus/lookup?code=...` | Authenticated | — | `200` SKU detail (barcode or SKU code lookup) |
| `GET` | `/skus/:id` | Authenticated | — | `200` SKU detail |
| `PATCH` | `/skus/:id` | `catalog.create` | Any of `size`, `color`, `isActive` | `200` SKU |
| `PUT` | `/skus/:id/price` | `catalog.create` | `{ "price" }` | `200` SKU |
| `GET` | `/skus/:id/price-history` | `catalog.create` | — | `200` array of price changes |
| `POST` | `/skus/:id/barcodes` | `catalog.create` | `{ "code" }` | `201` barcode |
| `DELETE` | `/barcodes/:id` | `catalog.create` | — | `204` |
| `GET` | `/stock?branchId=...` | Authenticated, assigned branch | — | `200` array of stock items |
| `POST` | `/stock/opening` | `adjustments.create`, assigned branch | `{ "branchId", "lines": [{ "skuId", "quantity" }] }` plus `Idempotency-Key` header | `201` batch result |
| `POST` | `/sales` | `sales.create`, assigned branch | Sale details plus `Idempotency-Key` header | `201` completed sale |
| `GET` | `/sales?branchId=...` | Authenticated, assigned branch | — | `200` business date and sales |
| `GET` | `/sales/:id` | Authenticated, assigned branch | — | `200` sale |
| `GET` | `/users` | Admin | — | `200` array of users |
| `POST` | `/users` | Admin | `{ "email", "fullName", "role" }` | `201` user |
| `PATCH` | `/users/:id` | Admin | Any of `email`, `fullName`, `role`, `isActive` | `200` user |
| `PUT` | `/users/:id/password` | Admin | `{ "password" }` | `204` |
| `PUT` | `/users/:id/branches/:branchId` | Admin | — | `204` |
| `DELETE` | `/users/:id/branches/:branchId` | Admin | — | `204` |
| `DELETE` | `/users/:id` | Admin | — | `204` |

There is no public registration endpoint. An administrator creates accounts through
`POST /users`; the backend creates the account without a password. The administrator
then sets its initial password using `PUT /users/:id/password`. Passwords must be at
least 8 characters and at most 72 UTF-8 bytes. Passwords must not be included in
`POST /users` or `PATCH /users/:id`.

### Catalog: styles, SKUs, and barcodes

A style describes a product model; a SKU is a sellable size/color variant of a
style. Catalog list endpoints accept `search`, `activeOnly`, `limit`, and `offset`
query parameters. `GET /skus` also accepts `styleId`. Search is optional text up to
100 characters; `activeOnly` must be `true` or `false`. Lists default to `limit=50`
and `offset=0`; `limit` must be between 1 and 20 and `offset` must be zero or
greater. SKU lookup requires a non-empty `code` query parameter and matches an
exact barcode first, then an exact SKU code.

Create a style:

```http
POST /styles
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "code": "TEE-100",
  "name": "Classic Tee",
  "category": "Tops"
}
```

`code` is trimmed and uppercased, must contain 1–40 letters, digits, `.`, `_`, `/`,
or `-`; it cannot be changed after creation. `name` is required and limited to
120 characters. `category` is optional, nullable, and limited to 60 characters.
An empty or null category clears it during an update. `PATCH /styles/:id` accepts
any of `name`, `category`, and `isActive`.

Create a SKU for an existing active style:

```http
POST /skus
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "styleId": "style-uuid",
  "skuCode": "TEE-100-BLK-M",
  "size": "M",
  "color": "Black",
  "standardPrice": "25.00",
  "currency": "USD"
}
```

`currency` is optional and defaults to `USD`; otherwise it must be three letters.
`standardPrice` must be zero or greater with at most two decimal places. SKU codes
are trimmed and uppercased, and are limited to 40 letters, digits, `.`, `_`, `/`,
or `-`. Size is required and limited to 20 characters; color is required and
limited to 40 characters. A style cannot have duplicate size/color variants, and
SKU codes must be unique. The SKU code, currency, and price cannot be changed with
`PATCH /skus/:id`; that PATCH accepts `size`, `color`, and `isActive` only.
Change price with `PUT /skus/:id/price` and `{ "price": "27.50" }`; real changes
are recorded in price history. `GET /skus/:id/price-history` returns newest entries
first and accepts an optional `limit` (default 50, maximum 200).

Add a barcode with `POST /skus/:id/barcodes` and `{ "code": "0123456789012" }`.
Barcode codes are trimmed, unique across the catalog, and limited to 64 visible
characters without spaces. The response includes the barcode `id`, `skuId`, `code`,
and `createdAt`. Remove it with `DELETE /barcodes/:id`.

Catalog response fields include ISO 8601 timestamps. Prices are JSON strings with
two decimal places. A style response contains `id`, `code`, `name`, `category`,
`isActive`, `createdAt`, and `updatedAt`. A SKU response contains `id`, `styleId`,
`skuCode`, `size`, `color`, `standardPrice`, `currency`, `isActive`, `createdAt`,
and `updatedAt`. SKU list results also include a `style` summary (`id`, `code`,
`name`); SKU detail and lookup results additionally include `barcodes`. A style
detail result includes its `skus`. Price-history entries contain `id`, `skuId`,
`oldPrice`, `newPrice`, `effectiveAt`, and `changedBy`; `oldPrice` is null for the
initial price record.

### Stock

Stock is tracked separately for each branch. Every authenticated user can read
stock for a branch they can access. `GET /stock` requires `branchId` and accepts
optional `search`, `styleId`, `activeOnly`, `limit`, and `offset` query parameters.
Paging and search use the same defaults and limits as the catalog lists. The
response is an array; each item contains the SKU and style summary under `sku`,
plus `sellable`, `nonSellable`, and `inTransit` quantities. Variants with no
movement are included with zero quantities.

Set initial counted quantities with `POST /stock/opening`:

```http
POST /stock/opening
Content-Type: application/json
Authorization: Bearer <access-token>
Idempotency-Key: <unique-random-key>
```

```json
{
  "branchId": "branch-uuid",
  "lines": [
    { "skuId": "sku-uuid", "quantity": 12 }
  ]
}
```

The key is required and must be 8–200 characters. Send a new key for each
operation; retrying the same request with the same key safely replays the
original result, while reusing the key for a different request returns `409`.
Each request must include 1–500 unique SKU lines with whole-number quantities
from 1 to 1,000,000. Opening quantities can only be set for a SKU that has no
stock movement yet at that branch. The caller must have the `adjustments.create`
permission and branch access; the branch must also be active. A successful response is
`{ "batchId": "uuid", "lines": 1 }`; a replay also sets
`Idempotent-Replay: true`.

### Sales

Create a sale with `POST /sales`. The caller needs the `sales.create` permission
and access to the requested branch. Use a unique `Idempotency-Key` header for
each sale; the key must be 8–200 characters. Retrying the same request with the
same key returns the original sale without charging stock a second time. Reusing
the key with a different request returns `409`; a replay is marked with the
`Idempotent-Replay: true` response header.

Example:

```http
POST /sales
Content-Type: application/json
Authorization: Bearer <access-token>
Idempotency-Key: <unique-random-key>
```

```json
{
  "branchId": "branch-uuid",
  "channel": "in_store",
  "lines": [
    { "skuId": "sku-uuid", "quantity": 1 }
  ],
  "payments": [
    { "method": "cash", "amount": "20.00", "tendered": "50.00" },
    { "method": "whish", "amount": "25.00", "reference": "WH-12345" }
  ]
}
```

`channel` defaults to `in_store`; allowed values are `in_store` and
`social_media`. Social media sales require `socialPlatform`, one of `facebook`,
`instagram`, `whatsapp`, or `other`. `note` is optional and limited to 500
characters. A sale requires 1–50 unique SKU lines. Each line contains a `skuId`
and an integer `quantity` from 1 to 10,000. The server reads current SKU prices;
client-supplied prices are ignored. All SKUs must be active and use the same
currency, and available stock must cover the requested quantities.

`payments` is a list of at most four payments and defaults to empty. A completed
sale must be paid in full. Payment amounts are zero-or-greater money values with
up to two decimals, but each payment must be above zero. Methods are `cash` and
`whish`. Cash can include optional `tendered` (at least the amount) and returns
the change; Whish requires a visible, non-space `reference` up to 64 characters.

An optional line `discount` requires `discounts.apply` permission. A percentage
discount has `{ "type": "percent", "percent": "10", "reason": "..." }`, where
the percentage is greater than 0 and at most 100. A unit-price override has
`{ "type": "override", "unitPrice": "40.00", "reason": "..." }` and cannot exceed
the catalog price. Both forms require a non-empty reason of at most 200
characters. The API records the approving user with the discount.

`GET /sales` requires `branchId` and accepts an optional `date` in `YYYY-MM-DD`
format (defaults to the current business date in the configured business time
zone), plus `limit` and `offset` (defaults 50 and 0; maximum limit 200). It
returns `{ "businessDate": "YYYY-MM-DD", "sales": [...] }`. `GET /sales/:id`
returns a sale only if the caller can access its branch; otherwise it returns
`404`.

Sale responses include identifiers and reference, branch, seller, status,
channel/platform, currency, `subtotal`, `totalDiscount`, `total`, `totalPaid`,
timestamps, business date, note, lines, and payments. Money values are strings
with two decimal places. Each line includes SKU details, quantity, unit price,
discount (or null), and line total. Each payment includes method, amount,
tendered, change, and reference (cash-only fields are null for Whish).

### User roles

Allowed role values are `admin`, `manager`, and `employee`. Do not allow a user to
select or update their own role unless the product explicitly intends to expose that
admin capability.

Catalog mutations are permission-based rather than admin-only. Users with
`catalog.create` can create or update styles and SKUs, change prices, and add or
remove barcodes. A user without that permission can still read catalog endpoints
when authenticated.

Sales creation and discounts are controlled by `sales.create` and
`discounts.apply`, respectively. Stock opening is controlled by
`adjustments.create`. Sales and stock reads, as well as sales and stock mutations,
are restricted to branches the caller can access (admins can access all branches).

### Branch visibility

Admins receive all branches, including inactive ones. Other users receive only active
branches assigned to them. A new non-admin user may have no visible branches until an
admin assigns one.

### Validation constraints

- Email is trimmed, lowercased, and must be a valid email address.
- Full name must contain 2–100 characters.
- Branch code is trimmed, converted to uppercase, and must contain 1–20 letters,
  digits, hyphens, or underscores.
- Branch name must contain 1–120 characters.

## Calling the API from a frontend

Example using `fetch`:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message ?? 'Login failed');
  }
  return result as { token: string; user: Record<string, unknown> };
}

async function getBranches(token: string) {
  const response = await fetch(`${API_BASE_URL}/branches`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message ?? 'Could not load branches');
  }
  return response.json();
}
```

Keep access tokens out of URLs and logs. For browser applications, prefer a
well-reviewed session strategy; if storing a bearer token in browser storage, account
for the impact of cross-site scripting and never store passwords.

## Errors

Errors use a JSON body such as `{ "message": "..." }`.

| Status | Meaning | Frontend handling |
|---|---|---|
| `400` | Invalid input or malformed JSON | Show the message near the relevant form |
| `401` | Missing, invalid, or expired authentication; invalid login | Clear session for protected calls, or show a login error |
| `403` | Authenticated but not permitted | Show an access-denied state |
| `404` | Unknown route or record | Show not found |
| `409` | Conflict, for example duplicate email or branch code | Ask the user to resolve the conflict |
| `413` | Request body too large | Reduce the submitted payload |
| `500` | Unexpected server error | Show a generic error and allow retry |

## Browser CORS configuration

The server allows browser origins listed in `CORS_ORIGIN` (comma-separated exact
origins, including scheme and port, with no trailing slash). If unset, it allows
`http://localhost:3001`. Configure the frontend's actual origin in the backend
environment for local and deployed environments.

The backend permits the `Content-Type` and `Authorization` headers needed by this
document. `X-User-Id` is a development-only authentication header and must not be
used by a production frontend.
