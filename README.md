# Bitar — Multi-Branch Inventory Dashboard (Frontend)

Next.js dashboard for the Bitar fashion store: branches, users, products, stock,
invoices and sales across several shops.

- **Users, branches and sign-in** talk to the real Bitar backend.
- **Products, stock, invoices and sales analytics** still run on mock data
  in the browser, because the backend has no endpoints for them yet.

The backend contract is described in [`AGENTS.md`](./AGENTS.md). This file
describes how the frontend uses it.

---

## 1. Getting started

### Requirements

- Node.js 20+
- The Bitar backend running locally or deployed

### Environment

Create or edit `.env` in the project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

| Variable | Purpose | Default if unset |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the Bitar backend, no trailing slash | `http://localhost:3000` |

Use the deployed backend URL in production. Never hard-code it in components.

### Backend CORS

The backend only accepts browser requests from origins listed in its
`CORS_ORIGIN` variable (default `http://localhost:3001`). The Next dev server
runs on `http://localhost:3000`, so set this **on the backend**:

```env
CORS_ORIGIN=http://localhost:3000
```

Multiple origins are comma-separated, exact, with scheme and port and no
trailing slash.

### Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build + type check
npm run start   # serve the production build
```

### First sign-in

There is no public registration. An administrator account must already exist
on the backend. Sign in with it at `/login`, then create other accounts from
**Users**.

---

## 2. Stack

| Concern | Library |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, shadcn/ui tokens in `app/globals.css` |
| Server-like data | TanStack Query |
| Client/UI state | Zustand |
| Forms and validation | react-hook-form + zod |
| Toasts | sonner |
| Icons | lucide-react |
| Charts | recharts |

---

## 3. Architecture

Data always flows in one direction. Components never call `fetch` or touch the
mock store directly.

```
Component ──► hook (TanStack Query) ──► service ──► API client ──► Bitar backend
                                                └─► mock store (localStorage)
```

| Layer | Folder | Responsibility |
|---|---|---|
| Pages | `app/` | Routes. Server components that render a client view. |
| Components | `components/` | UI only. Read data through hooks, check access through `<Can>` / `usePermission()`. |
| Hooks | `hooks/` | `useQuery` / `useMutation` wrappers. Mutations invalidate their query keys and show toasts. |
| Services | `services/` | Business logic. The only layer that decides between the real API and the mock store. |
| API client | `lib/api/` | Typed HTTP calls to the backend. Adds the bearer token, turns failures into `ApiError`. |
| Mock store | `mocks/store.ts` | In-memory data persisted to localStorage for features with no backend yet. |
| Schemas | `schemas/` | zod schemas: the single source of form validation. |
| Stores | `store/` | Zustand: session (`user-store.ts`) and UI preferences (`ui-store.ts`). |
| Query keys | `lib/query-keys.ts` | Every TanStack Query key in one place. |
| Permissions | `lib/permissions.ts` | `can(role, action)` and every role rule. |

### Folder map

```
app/
  login/                    sign-in page
  (dashboard)/              signed-in area (sidebar + top bar)
    dashboard/              cross-branch overview (admin)
    branches/ [id]/         branch list and single branch page
    products/               catalog
    invoices/ [id]/         documents (sales, purchases, returns, adjustments)
    sales/b2b, sales/b2c/   sales channels
    users/                  staff accounts (admin)
components/                 auth, branches, dashboard, invoices, products,
                            sales, shared, stock, users, ui
hooks/                      use-auth, use-users, use-branches, use-products, ...
services/                   auth, session, users, branches, products, stock, ...
lib/api/                    backend client (see section 5)
mocks/store.ts              mock data for unbuilt backend features
schemas/                    zod schemas
store/                      Zustand stores
types/index.ts              shared domain types
providers/                  QueryProvider (+ 401 handling), AppProviders
```

---

## 4. Authentication and session

### Sign-in flow

1. The user submits email and password on `/login` (`components/auth/login-form.tsx`).
2. `services/auth.service.ts` lowercases the email and calls `POST /auth/login`,
   which returns `{ token, user }`.
3. It then calls `GET /auth/me` with the token (`services/session.service.ts`)
   and builds the session `User`:

   ```ts
   interface User {
     id: string
     name: string          // fullName
     email: string
     role: 'admin' | 'manager' | 'employee'
     branchId: string | null // admins: null; others: first of branchIds
     branchIds: string[]     // every branch this user may see
     permissions: string[]   // permission keys from the backend
     canViewCosts: boolean
   }
   ```

4. The token and `User` are saved in the Zustand `user-store`, persisted to
   **sessionStorage** (`bitar-fashion:session:v4`). The session ends when the
   tab closes.
5. `LoginScreen` redirects to the page that was originally requested, or to
   the role's home page.

Deactivated accounts (`isActive: false`) are refused at sign-in.

### Restoring a session

On every page load `components/shared/hydration-gate.tsx` rehydrates the store.
When a token is present it calls `GET /auth/me` again, so role and branch
changes made by an admin are picked up immediately.

- `401` → the session is cleared and the user goes to `/login`.
- Network error → the cached session is kept so a short outage doesn't sign
  everyone out.

### Authenticated requests

Every protected request sends:

```http
Authorization: Bearer <token>
```

`Content-Type: application/json` is only added when a body is sent. Tokens
never go in URLs or logs.

### Expired or invalid tokens (401)

`providers/query-provider.tsx` registers a global handler via
`onUnauthorized()` in `lib/api/client.ts`. When any protected call returns
`401`, it:

1. clears every cached query,
2. signs the user out,
3. shows "Your session has expired. Please sign in again.",
4. lets `AuthGate` redirect to `/login?next=<current page>`.

Token lifetime is set by the backend (8 hours by default).

### Sign-out

There is no logout endpoint. Signing out clears the branch filter, the query
cache and the stored token (`hooks/use-auth.ts`).

### Route protection

| Component | Job |
|---|---|
| `AuthGate` | Sends signed-out visitors to `/login?next=…` |
| `BranchGuard` | Uses `redirectPathFor()` to keep each role on pages it may open |

Treat these as UX only. The backend's `401` / `403` responses are authoritative.

---

## 5. API client (`lib/api/`)

| File | Contents |
|---|---|
| `client.ts` | `send()` low-level fetch, `createRequest(token)`, `onUnauthorized()`, `getApiBaseUrl()` |
| `auth.api.ts` | `loginWithApi()`, `fetchMe()`, `fetchHealth()` (public / token-based) |
| `users.api.ts` | User endpoints |
| `branches.api.ts` | Branch endpoints |
| `sales.api.ts` | Sales analytics (backend route not built yet) |
| `create-api.ts` | `createApi(token)` — combines all of the above for one token |
| `get-api-client.ts` | `getApiClient()` — client for the signed-in session; throws `ApiError(401)` if none |
| `map-branch.ts` | Converts `ApiBranch` to the UI `Branch` type |
| `api-error.ts` | `ApiError { status, message }` |
| `types.ts` | Request/response types matching `AGENTS.md` |
| `index.ts` | Public exports — import from `@/lib/api` |

### Endpoints used

| Method | Path | Used by | Notes |
|---|---|---|---|
| `GET` | `/health` | `fetchHealth()` | Public |
| `POST` | `/auth/login` | `auth.service.login` | Public |
| `GET` | `/auth/me` | `session.service.bootstrapSession` | After login and on reload |
| `GET` | `/branches` | `branches.service` | Admins get all; others get assigned active branches |
| `POST` | `/branches` | `branches.service.createBranch` | Admin |
| `GET` | `/users` | `users.service.listUsers` | Admin |
| `POST` | `/users` | `users.service.createUserWithBranch` | Admin; **no password** |
| `PATCH` | `/users/:id` | `users.service.updateUserWithBranch`, `setUserActive` | Admin; **no password** |
| `PUT` | `/users/:id/password` | create and edit user | Admin |
| `PUT` | `/users/:id/branches/:branchId` | branch assignment | Admin |
| `DELETE` | `/users/:id/branches/:branchId` | branch reassignment | Admin |
| `DELETE` | `/users/:id` | `users.service.deleteUser` | Admin |

### Errors

Every failure becomes an `ApiError` whose `message` is the backend's
`{ "message": "..." }` text, safe to show to the user. A network failure is
`ApiError(0, 'Could not reach the server…')`.

| Status | Frontend behaviour |
|---|---|
| `0` | Network error message; queries retry once |
| `400` | Message shown next to the form / in a toast |
| `401` | Global sign-out (protected calls) or login error (sign-in) |
| `403` | Error state with the backend message |
| `404` | Not found message |
| `409` | Conflict shown inline, e.g. duplicate branch code or email |
| `5xx` | Generic error with "Try again" |

Queries never retry on 4xx responses, since the answer won't change.

### Adding a new endpoint

1. Add request/response types to `lib/api/types.ts`.
2. Add the call to the matching `*.api.ts` (or a new one merged in `create-api.ts`).
3. Call it from a function in `services/`.
4. Expose it through a hook in `hooks/` with a key from `lib/query-keys.ts`.
5. Components use the hook — nothing else changes.

---

## 6. Roles and permissions

All rules live in `lib/permissions.ts`. Components never compare roles
directly; they use:

```tsx
<Can action="products:read-cost">…</Can>

const { can, canAccessBranch, branchScoped } = usePermission()
```

| Role | Scope | Highlights |
|---|---|---|
| `admin` | All branches, including inactive | Everything: users, branches, voiding documents |
| `manager` | Own branch(es) | Edit products, stock, invoices, purchases, B2B and B2C sales |
| `employee` | Own branch(es) | Read products, add/edit catalog entries, raise and issue B2C sales |

Two rules come from the backend, not the role table:

- **Cost visibility** (`products:read-cost`, `invoices:read-cost`) follows
  `canViewCosts` from `/auth/me` (`canUser()`).
- **Branch access** follows `branchIds` from `/auth/me` (`canAccessBranch()`).

### Landing pages

| User | Home |
|---|---|
| Admin | `/dashboard` |
| Manager / employee with a branch | `/branches/<their branch>` |
| Manager / employee with no branch yet | `/products` (a banner explains the missing branch) |

---

## 7. Features

### Users (`/users`, admin only)

- **Create:** full name, email, password, role, branch (required for managers
  and employees). Runs `POST /users` → `PUT /users/:id/password` → `PUT
  /users/:id/branches/:branchId`. If a later step fails, the list is
  refreshed so the partly created account is visible and can be fixed.
- **Edit:** name, email, optional new password, role, branch, active. Changing
  the branch revokes the old grant and adds the new one.
- **Own account:** admins can't change their own role, branch or active
  status, or delete themselves.
- **Deactivate:** the Active toggle (with confirmation). The account stays and
  can be reactivated.
- **Delete:** permanent, with confirmation.

> The API has no endpoint that lists a user's branches. The branch chosen in
> the admin form is remembered in that browser's localStorage
> (`lib/user-branch-map.ts`) to prefill the edit form and to know which grant
> to revoke. A signed-in user's own access always comes from `/auth/me`.

### Branches (`/branches`)

- **List** from `GET /branches`.
- **Create** with code and name (admin).
- **Edit, delete, activate/deactivate** are wired in the UI but switched off
  with `BRANCH_WRITES` in `services/branches.service.ts`, because the backend
  has no `PATCH` / `DELETE /branches/:id` yet. Flip the flags when it does.

### Products, stock, invoices, sales — mock data

These services read and write `mocks/store.ts`, persisted to localStorage, with
a simulated 300 ms delay so loading states behave realistically. Branches from
the API are mirrored into the mock store so stock and documents can reference
real branch ids. When backend endpoints arrive, only the matching file in
`services/` should change.

---

## 8. Validation rules

The zod schemas in `schemas/` match the backend's rules, so most errors are
caught before a request is sent.

| Field | Rule | Schema |
|---|---|---|
| Email | Trimmed, lowercased, valid email | `user.schema.ts`, `auth.schema.ts` |
| Full name | 2–100 characters | `user.schema.ts` |
| Password | At least 8 characters, at most 72 UTF-8 bytes | `user.schema.ts` |
| Role | `admin`, `manager` or `employee` | `user.schema.ts` |
| Branch code | Trimmed, 1–20 letters/digits/`-`/`_`, uppercased | `branch.schema.ts` |
| Branch name | 1–120 characters | `branch.schema.ts` |

---

## 9. Security notes

- The bearer token lives in sessionStorage. Any cross-site scripting bug could
  read it, so never render untrusted HTML.
- Passwords are never stored in the browser and never sent in `POST` /
  `PATCH /users`.
- `X-User-Id` is a backend development header and is **not** used by this app.
- On startup the app deletes data left by older builds: previous session keys
  and the old `bitar:dev-credentials:v1` store that held passwords.

---

## 10. Change log — backend integration (Oct 2026)

Moved the app from the development identity header to the token-based API in
`AGENTS.md`.

**Added**
- `lib/api/auth.api.ts`: `POST /auth/login`, `GET /auth/me`, `GET /health`.
- Bearer-token client with a global `401` handler (`lib/api/client.ts`,
  `providers/query-provider.tsx`).
- `PUT /users/:id/password` and `DELETE /users/:id` in `lib/api/users.api.ts`.
- Delete-user action with confirmation (`components/users/users-view.tsx`).
- `canUser()` in `lib/permissions.ts` for backend-driven cost visibility.
- `email`, `branchIds`, `permissions`, `canViewCosts` on the session `User`.

**Changed**
- Session store holds `token` + `user` instead of a user id (`store/user-store.ts`).
- Session bootstrap uses `GET /auth/me` instead of listing users and guessing
  the branch (`services/session.service.ts`).
- Saved sessions are re-validated on every page load (`hydration-gate.tsx`).
- User create/edit sends passwords only to `PUT /users/:id/password`.
- Admins can't change their own role, branch or active status.
- Branch access checks use `branchIds`.
- Branchless managers/employees land on `/products` instead of `/branches/null`.
- Queries don't retry 4xx errors; network failures show a clear message.
- Schemas: lowercase email, uppercase branch code, 72-byte password limit.
- The header role switcher is now a "signed in as" badge (tokens can't
  impersonate other users).

**Removed**
- `X-User-Id` header.
- `/register` page, form, schema, service and hook (`POST /auth/register`
  doesn't exist).
- `lib/dev-credentials.ts` and `components/users/dev-saved-password.tsx`,
  which stored passwords in localStorage.
- Unused sessionStorage helpers in `lib/session-storage.ts`.

---

## 11. Known gaps

| Gap | Where to change when the backend adds it |
|---|---|
| Edit / delete / toggle branches | Flip `BRANCH_WRITES` in `services/branches.service.ts` |
| Products and variants | `services/products.service.ts` |
| Stock levels | `services/stock.service.ts` |
| Invoices | `services/invoices.service.ts` |
| Sales analytics | `services/analytics.service.ts` → `lib/api/sales.api.ts` |
| Listing a user's branches | Replace `lib/user-branch-map.ts` in `services/users.service.ts` |
