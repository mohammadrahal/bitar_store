# Bitar Fashion API: guide for the frontend developer

Version 0.1: **users** and **branches**. Everything below was run against the real server; the JSON examples are real responses.

| Area | Status |
|---|---|
| Users, roles | available |
| Branches | available |
| Login (token) | **not built yet**: dev identity header for now (section 2) |
| Catalog (styles, SKUs, barcodes), stock, sales, transfers | **not built yet**: don't call them |

---

## 1. Quick start

- **Base URL (dev):** `http://localhost:3000`. Keep it in one env var: `NEXT_PUBLIC_API_URL`.
- Send and receive **JSON**. Send `Content-Type: application/json` on every request that has a body.
- Every request (except `GET /health`) needs the header **`X-User-Id: <uuid>`**: the id of the user who is using the app.
- Ask the backend developer for the id of the first admin. After that, `GET /users` (as admin) lists every user and their ids.

```bash
curl http://localhost:3000/users -H "X-User-Id: c11e1fcb-c268-4146-9cbd-f55c8e9f69f2"
```

---

## 2. Identity: dev mode now, login later

| | Now (dev mode) | Later (real login) |
|---|---|---|
| How the server knows who you are | header `X-User-Id: <uuid>` | `POST /auth/login` returns a token, then header `Authorization: Bearer <token>` |
| Security | **none**: anyone can claim to be anyone. For development only | real |

What this means for you:
- Build **one** function that adds the identity header to every request (see `api.ts` in section 8). When login arrives, only that function changes.
- Store "the current user" in one place (React context or a cookie). Today it holds the user id; later the token.
- Never ship the dev header to production. The server refuses to start in production with dev mode on.

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
| 401 | Not identified, or the user was deactivated | Go to the login/identity screen |
| 403 | Identified but not allowed | Show "not allowed"; hide that screen in the menu |
| 404 | Unknown id or route | Show "not found" |
| 409 | Conflict (duplicate email/code, forbidden self-change) | Show `message` |
| 500 | Server bug | Show a generic error; tell the backend developer |

- **No pagination yet**: list endpoints return everything.
- **The password is never returned**, by any endpoint.
- **CORS:** browser calls are accepted only from the origins in the backend's `CORS_ORIGIN`. Tell the backend developer your dev origin (e.g. `http://localhost:3001`). Calls made from Next.js server code (route handlers, server actions) are not affected by CORS.

---

## 4. Roles

Roles: `"admin"`, `"manager"`, `"employee"`.

| Action | admin | manager | employee |
|---|---|---|---|
| `GET /branches` | yes | yes | yes |
| `POST /branches` | yes | no (403) | no (403) |
| `PUT` / `DELETE /users/:id/branches/:branchId` | yes | no (403) | no (403) |
| `/users` (list, create, update) | yes | no (403) | no (403) |

Hide screens the user can't use, but never rely on that: the server answers 403 anyway.

**Branch visibility:** an **admin** sees every branch (including inactive ones). **Everyone else** (manager included) sees only the **active branches an admin granted them**. A new employee gets `[]` until an admin grants a branch, so build an empty state such as "Ask your admin for access to a branch".

---

## 5. Endpoints

### `GET /health`
No header needed. `200 { "status": "ok" }`

---

### Users (admin only)

#### `POST /users`: create a user

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | yes | valid email, up to 254 chars. The server stores it in lower case, so `Sara@Bitar.test` and `sara@bitar.test` are the same user |
| `password` | string | yes | at least 8 characters, at most 72 bytes |
| `fullName` | string | yes | 2 to 100 characters (trimmed) |
| `role` | string | yes | `admin`, `manager` or `employee` |

```json
{ "email": "Sara.Khoury@Bitar.test", "password": "Password#123", "fullName": "Sara Khoury", "role": "employee" }
```

`201`:
```json
{
  "id": "29a31ebd-b825-4026-9a4c-f51c93375220",
  "email": "sara.khoury@bitar.test",
  "fullName": "Sara Khoury",
  "role": "employee",
  "isActive": true,
  "deactivatedAt": null,
  "createdAt": "2026-10-25T07:50:17.815Z",
  "updatedAt": "2026-10-25T07:50:17.815Z"
}
```
Errors: `400` (bad field), `409` (email already used), `401`, `403`.

#### `GET /users`
`200`: an array of the objects above (oldest first).

#### `PATCH /users/:id`: change a user
Send **only** the fields you want to change. All are optional.

| Field | Type | Notes |
|---|---|---|
| `email` | string | must not belong to another user (409) |
| `password` | string | same rules as create; this *sets a new* password |
| `fullName` | string | |
| `role` | string | |
| `isActive` | boolean | `false` deactivates, `true` reactivates |

```json
{ "fullName": "Sara K. Khoury", "role": "manager" }
```
`200`: the updated user. Errors: `400`, `404` (unknown or malformed id), `409`.

Rules to remember:
- **There is no delete.** To remove someone from the app, send `{ "isActive": false }`. Their next request returns `401` immediately.
- An admin **cannot** deactivate or change the role of **their own** account (`409`: `You cannot change your own role or deactivate your own account`). Another admin can.
- Admins can create other admins (`role: "admin"`). The very first admin is created by the backend developer.

---

### Branches

#### `GET /branches`
Any identified user. **Admin:** every branch. **Others:** only the active branches granted to them (see section 4). `200`:
```json
[
  { "id": "477d4fe3-05cf-479a-859c-d0d035343295", "code": "HAMRA", "name": "Hamra", "isActive": true, "createdAt": "2026-10-25T07:50:18.231Z" }
]
```

#### `POST /branches`: admin only

| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | 1 to 20 characters: letters, digits, `-` and `_`. The server **uppercases** it (`hamra` becomes `HAMRA`) and it must be unique |
| `name` | string | yes | 1 to 120 characters |

```json
{ "code": "hamra", "name": "Hamra" }
```
`201`: the branch (as above). Errors: `400`, `409` (code already used), `401`, `403`.

#### `PUT /users/:id/branches/:branchId`: give a user access to a branch (admin only)
No body. `204`. Safe to repeat. Errors: `404` (`User not found` or `Branch not found`), `409` (`Cannot grant access to an inactive branch`), `401`, `403`.

#### `DELETE /users/:id/branches/:branchId`: take that access away (admin only)
No body. `204`. Safe to repeat. Errors: `404` (`User not found`), `401`, `403`.

---

## 6. Error messages you will see

| Status | `message` |
|---|---|
| 400 | `Invalid JSON body` |
| 400 | `Email is invalid` / `Email is required` |
| 400 | `Password must be at least 8 characters` |
| 400 | `Role must be one of: admin, manager, employee` |
| 400 | `Full name must be between 2 and 100 characters` |
| 400 | `Branch code may only contain letters, digits, "-" and "_"` |
| 401 | `Send a valid X-User-Id header` |
| 401 | `Unknown or inactive user` |
| 403 | `Insufficient role` |
| 404 | `User not found` / `Branch not found` / `Route not found` |
| 409 | `A user with this email already exists` |
| 409 | `A branch with this code already exists` |
| 409 | `You cannot change your own role or deactivate your own account` |
| 409 | `Cannot grant access to an inactive branch` |
| 500 | `Internal Server Error` |

Show `message` as-is for 400 and 409. For 401 and 403 show your own friendly text.

---

## 7. Behaviours worth knowing

- Emails are case-insensitive. Compare them in lower case on the client too.
- A deactivated user keeps existing (their id stays valid in old records); they just can't use the app.
- `updatedAt` changes on every successful update.

---

## 8. Typed fetch client (copy to the frontend)

Tested against the running API. Use it from components or server code.

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
    deactivatedAt: string | null;  // ISO date, or null while active
    createdAt: string;             // ISO date (UTC)
    updatedAt: string;
}

export interface Branch {
    id: string;                    // uuid
    code: string;                  // always UPPER CASE, e.g. "HAMRA"
    name: string;
    isActive: boolean;
    createdAt: string;
}

export interface CreateUserInput {
    email: string;
    password: string;              // plain text; the server hashes it and never returns it
    fullName: string;
    role: UserRole;
}

export interface UpdateUserInput {   // send ONLY the fields you want to change
    email?: string;
    password?: string;
    fullName?: string;
    role?: UserRole;
    isActive?: boolean;
}

export interface CreateBranchInput {
    code: string;
    name: string;
}

// Every failure from the API becomes an ApiError: status = HTTP status, message = text you can show the user.
export class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, userId: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,   // DEV MODE identity. It becomes "Authorization: Bearer <token>" when login exists.
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return undefined as T;   // success with no body

    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data?.message ?? 'Request failed');
    return data as T;
}

export const createApi = (userId: string) => ({
    listUsers: () => request<User[]>('/users', userId),
    createUser: (input: CreateUserInput) => request<User>('/users', userId, 'POST', input),
    updateUser: (id: string, changes: UpdateUserInput) => request<User>(`/users/${id}`, userId, 'PATCH', changes),
    grantBranchAccess: (id: string, branchId: string) => request<void>(`/users/${id}/branches/${branchId}`, userId, 'PUT'),
    revokeBranchAccess: (id: string, branchId: string) => request<void>(`/users/${id}/branches/${branchId}`, userId, 'DELETE'),
    listBranches: () => request<Branch[]>('/branches', userId),
    createBranch: (input: CreateBranchInput) => request<Branch>('/branches', userId, 'POST', input),
});
```

Usage:

```ts
import { ApiError, createApi } from './api';

const api = createApi(currentUserId);

try {
  const user = await api.createUser({ email: 'sara@bitar.test', password: 'Password#123', fullName: 'Sara Khoury', role: 'employee' });
  await api.updateUser(user.id, { role: 'manager' });
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 401) { /* go to the identity/login screen */ }
    else showToast(error.message);      // 400 and 409 messages are meant for users
  } else {
    throw error;                         // network down, etc.
  }
}
```

---

## 9. Coming next (don't build these yet)

Login (`POST /auth/login`), catalog with barcode search, stock per branch, sales (requests will need an `Idempotency-Key` header so a retried request can't sell twice), and transfers between branches. This guide is updated when each one ships.
