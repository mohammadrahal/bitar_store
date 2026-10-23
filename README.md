# Bitar Fashion — Inventory

An inventory management system for **Bitar Fashion**. It lets the team manage every branch (stores and warehouses), the products each branch carries, and every stock change that happens between them, from one dashboard.

## What it does

- **Branches**: add, edit, and remove stores and warehouses. Each branch card shows its stock value, units on hand, number of products, and stock alerts. Pick a branch in the top bar to scope the whole dashboard to that location.
- **Products**: maintain the catalog (SKU, name, category, price, reorder point) and see stock on hand, reserved, and available for each product, overall or per branch. Search, filter by status or category, sort, and export to CSV.
- **Stock movements**: every stock change is recorded with who made it, when, and a reference number:
  - **Receive**: stock arriving from a supplier (purchase order)
  - **Sell / remove**: stock leaving a branch
  - **Count**: correct on-hand stock after a physical count
  - **Transfer**: move stock between branches. Stock leaves the source right away, shows as *in transit*, and is added to the destination when someone marks it received (or returned if cancelled).
- **Overview**: inventory value, active products, low-stock and out-of-stock alerts, transfers in transit, a stock in/out chart for the last 7, 30, or 90 days, and the latest movements.
- **Alerts**: products below their reorder point at any branch are flagged in the sidebar, the notifications bell, and the overview.
- **Settings**: set your name (recorded on movements) and currency, export or import a full JSON backup, reset to demo data, or clear all data.

## Getting started

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first load the app fills itself with demo data (3 branches, 10 products, 30 days of movements). Use **Settings → Clear all data** to start from scratch.

| Command         | Purpose                           |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the development server      |
| `npm run build` | Type-check and build for production |
| `npm run start` | Serve the production build        |

## Where data is stored

There is no backend yet. All data is saved in the browser's `localStorage`, so it stays on the computer and browser where it was entered and is not shared between users. Use **Settings → Export backup** regularly to keep a copy.

To connect a real API or database, replace the action functions in `components/inventory/inventory-provider.tsx` with API calls. The pages and forms only talk to that provider, so they don't need to change.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) with React 19 and TypeScript
- Tailwind CSS v4 plus plain CSS design tokens in `app/globals.css`
- [lucide-react](https://lucide.dev) icons and [sonner](https://sonner.emilkowal.ski) toasts

## Project structure

```
app/
  (dashboard)/          Routes: / (overview), /products, /movements, /branches, /settings
  layout.tsx            Root layout, font, metadata
  globals.css           Design tokens and all component styles
components/
  dashboard/            App shell, drawers, dialogs, tables, chart, shared UI pieces
  forms/                Product, branch, stock movement, and transfer forms
  inventory/            Inventory store (state, validation, persistence)
  views/                One component per page
hooks/                  Modal behavior (focus, Escape) and URL-synced filters
lib/
  inventory/            Types, reducer, selectors, demo data, ID helpers
  csv.ts, format.ts     CSV export and number/date formatting
public/                 Logo and icons
```
