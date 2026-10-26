# Frontend–Backend Integration

This document describes the HTTP API currently exposed by the Bitar Store backend.
There are no product endpoints in the current API.

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
| `GET` | `/health` | Public | — | `200` `{ "status": "ok" }` |
| `POST` | `/auth/login` | Public | `{ "email", "password" }` | `200` token and user |
| `GET` | `/auth/me` | Authenticated | — | `200` user and access context |
| `GET` | `/branches` | Authenticated | — | `200` array of visible branches |
| `POST` | `/branches` | Admin | `{ "code", "name" }` | `201` branch |
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

### User roles

Allowed role values are `admin`, `manager`, and `employee`. Do not allow a user to
select or update their own role unless the product explicitly intends to expose that
admin capability.

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
