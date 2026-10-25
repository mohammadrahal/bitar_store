# Project: Multi-Branch Inventory Dashboard (Frontend Only)

You are a senior frontend engineer. Build the frontend of a multi-branch inventory app for a fashion store. There is NO backend and NO auth yet. Everything runs on mock data behind a service layer, so a real API can replace it later by editing only the service files.

Before writing code, show me the folder structure and a short plan. Then build in the phases below and stop after each phase for my review.

## Stack
- Next.js (App Router) + TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- TanStack Query for all server-like data (branches, products, stock)
- Zustand for client/UI state only (current mock user, selected branch, filters, UI toggles)
- react-hook-form + zod for forms and validation
- lucide-react for icons

## Architecture rules
1. Components never import mock data directly. They call hooks, hooks call services, services read/write the mock store.
   Flow: Component → hook (TanStack Query) → service → mock store
2. Services are async and return Promises with a small simulated delay (300ms) so loading states are real.
3. The mock store is an in-memory module persisted to localStorage, so create/edit/delete survive a refresh.
4. All mutations use useMutation and invalidate the related query keys on success.
5. Query keys live in one file (lib/query-keys.ts).
6. Zod schemas are the single source for form validation, and types are inferred from them where it makes sense.
7. Permissions live in one file (lib/permissions.ts) with a `can(role, action)` function. No `role === "admin"` checks scattered in components. Provide a `<Can action="...">` component and a `usePermission()` hook.
8. Server Components by default. Use "use client" only where needed (forms, tables with interaction, anything using hooks/Zustand).
9. No `any`. Handle loading, empty, and error states for every list.

## Folder structure
```
src/
  app/
    (dashboard)/
      layout.tsx          → sidebar + header with role switcher
      dashboard/page.tsx  → overview
      branches/page.tsx   → branches CRUD
      branches/[id]/page.tsx → single branch view
      products/page.tsx   → products CRUD
  components/
    ui/                   → shadcn components
    branches/             → BranchTable, BranchForm, DeleteBranchDialog
    products/             → ProductTable, ProductForm, VariantFields
    shared/               → Can, RoleSwitcher, EmptyState, PageHeader, ConfirmDialog
  hooks/                  → useBranches, useProducts, usePermission
  services/               → branches.service.ts, products.service.ts
  mocks/                  → seed data + mock store
  store/                  → user-store.ts, ui-store.ts (Zustand)
  lib/                    → permissions.ts, query-keys.ts, utils.ts
  schemas/                → branch.schema.ts, product.schema.ts
  types/                  → shared types
  providers/              → QueryProvider
```

## Data model
```ts
type Role = "admin" | "manager" | "employee";
type User = { id: string; name: string; role: Role; branchId: string | null };
type Branch = { id: string; name: string; location: string; phone?: string; isActive: boolean; createdAt: string };
type Product = { id: string; name: string; category: string; costPrice: number; sellPrice: number; createdAt: string };
type Variant = { id: string; productId: string; sku: string; size: string; color: string };
type StockLevel = { variantId: string; branchId: string; quantity: number; lowStockAt: number };
```
Seed 3 branches, around 10 products with size/color variants, and stock levels per branch.

## Roles and permissions
- admin: everything, all branches, can see cost price
- manager: own branch only, can view and edit products, can see cost price, cannot create/delete branches
- employee: own branch only, read-only on products, cannot see cost price, cannot access branches management

Add a RoleSwitcher dropdown in the header (dev only) using Zustand to switch between 3 mock users. Switching roles must instantly update what the UI shows. Employees and managers visiting /dashboard or another branch's page get redirected to their own branch page.

## Phase 1: Foundation
- Project setup, providers, folder structure, types, mock store, seed data
- Zustand user store + RoleSwitcher
- permissions.ts + Can + usePermission
- Dashboard layout with sidebar (links hidden based on permissions)

## Phase 2: Branches CRUD
- Table: name, location, phone, status, actions
- Create and edit in a dialog (same BranchForm for both)
- Delete with a confirm dialog. Block deleting a branch that still has stock and show a clear message instead
- Toggle active/inactive
- Toast feedback on success/error

## Phase 3: Products CRUD
- Table with search and category filter (filters in Zustand or URL search params)
- Create/edit form with dynamic variant rows (size, color, auto-generated SKU), using useFieldArray
- Delete with confirm dialog
- Cost price column hidden for employees via `<Can>`

## Phase 4: Dashboard overview
- Stat cards: total branches, total products, total stock units, low-stock count
- Low-stock table across branches
- Branch page shows the same stats filtered to that branch

## Quality bar
- Accessible forms (labels, error messages, keyboard navigation)
- Responsive down to tablet width
- Consistent spacing using Tailwind scale, no magic numbers
- Small, focused components. No file over ~200 lines
- When the real API arrives, only files in services/ (and the user store source) should need to change. Confirm this is true at the end of each phase.


## Brand: Bitar
Minimal boutique fashion look. Never pure #000 or #FFF.

Fonts (load with next/font/google):
- Playfair Display (600): logo and page titles only
- Inter (400, 500, 600): everything else
- Use tabular-nums on all numbers in tables and stat cards

Colors as shadcn CSS variables in globals.css:
:root {
  --background: 43 28% 95%;        /* #F7F5F0 */
  --card: 40 100% 99%;             /* #FFFDF9 */
  --muted: 39 26% 91%;             /* #EFEAE1 */
  --border: 39 20% 87%;            /* #E6E1D8 */
  --foreground: 30 5% 8%;          /* #161514 */
  --muted-foreground: 34 8% 48%;   /* #857D72 */
  --primary: 30 5% 8%;
  --primary-foreground: 43 28% 95%;
  --accent: 36 35% 52%;            /* #B08D57 */
  --ring: 36 35% 52%;
  --success: 115 14% 42%;          /* #5F7A5C */
  --warning: 36 71% 42%;           /* #B7791F */
  --destructive: 7 56% 41%;        /* #A23B2E */
}
.dark {
  --background: 30 6% 7%;          /* #121110 */
  --card: 40 6% 10%;               /* #1B1A18 */
  --border: 36 6% 16%;             /* #2C2A27 */
  --foreground: 37 33% 93%;        /* #F3EFE8 */
  --muted-foreground: 37 7% 60%;   /* #A39C91 */
  --primary: 37 33% 93%;
  --primary-foreground: 30 6% 7%;
  --accent: 36 47% 61%;            /* #C9A46C */
  --ring: 36 47% 61%;
}

Rules:
- Accent (brass) only for highlights: active nav, selected states, badges, focus ring, logo. Never for body text or small links.
- Buttons and links use primary (ink).
- Stock status badges use success / warning / destructive with a soft tinted background.
- Generous whitespace, thin 1px borders, small radius (6px), no heavy shadows or gradients.