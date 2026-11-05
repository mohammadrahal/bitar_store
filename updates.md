# Task: Turn the Bitar dashboard into a real inventory operations UI

Keep the Bitar brand: warm off-white background, brass accent `#B08D57`, Playfair Display for page titles only, Inter for everything else, light and dark themes. Do not copy generic SaaS styles (no purple, no glassmorphism). Keep the architecture rules: component → hook → service, permissions in `lib/permissions.ts`, query keys in `lib/query-keys.ts`. Do not invent backend endpoints; if data is missing, hide the widget and list the endpoint in `ARCHITECTURE.md` section 9.

Work section by section. Run type check and lint after each.

---

## 1. Fix the numbers first

- **Out of stock:** count **variants with 0 available**, not variant × location pairs. With "All locations", count a variant once if it has 0 available everywhere. Add a second line: "X more out at some locations". With one location selected, count for that location only.
- **Low stock:** the same logic, using the manager threshold. Clicking the card opens `/inventory` filtered to low stock.
- **Best sellers:** must follow the selected period (7, 30 or 90 days), not today only. Group by variant and show **model name, color and size** on every row, so two rows are never identical. Units axis uses whole numbers only.
- **Revenue by day:** use a **bar chart**, one bar per day, including days with $0. No smooth curves anywhere in the app.
- **Trend on KPI cards:** compare with the previous period of the same length ("+8.4% vs previous 30 days"). Green up, red down, gray when there's no previous data. Never show a trend for counts like locations or products.

## 2. Typography for numbers

- All numbers (KPIs, tables, money, chart labels, the Revenue mix figures) use **Inter with `tabular-nums`**. Playfair only for page titles and the logo.
- Money: `$10,510.40`, always two decimals, right-aligned in tables.
- KPI value size around 28–30px, semibold. Labels 13px, muted.

## 3. Header

Left to right:
- **Global search** (Ctrl/Cmd+K): search products, variants, SKUs, barcodes and sale references. A barcode scanner typing into it must open the variant directly. Use the shadcn `Command` component. Uses `GET /skus/lookup` and the catalog the app already has.
- **Location switcher** (keep it).
- **Notifications bell** with a count of items needing attention (same source as section 4).
- Theme toggle.
- **User menu** (avatar, name, role, sign out). Move sign out and the user block out of the sidebar into this menu.

## 4. Dashboard layout (top to bottom)

1. **Title row:** "Welcome back, {first name}" + one-line subtitle. On the right: **quick actions** filtered by permission: `New sale`, `Receive delivery`, `New transfer`. The primary button is `New sale` (dark, brass on hover).
2. **Needs attention** (new, the most important block). A compact list, each row with a count, a short label and a button that opens the filtered page:
   - Transfers waiting for approval
   - Shipments in transit (and any overdue)
   - Supplier receipts waiting for confirmation
   - Discount and refund requests waiting for approval
   - Low stock variants
   - Social media orders past their pickup time
   Hide rows with 0. If everything is 0, show "All clear" with a check icon. Hide rows whose data is not on the API yet (and list them in `ARCHITECTURE.md`). Employees see only their active location and only rows they have permission for.
3. **KPI row (4 cards):** Revenue, Sales count, Low stock, Out of stock, each with the trend from section 1. Cards are links.
4. **Charts row:** Revenue by day (bars, 2/3 width) + Revenue mix (1/3 width, keep the current split bars: payment method and channel).
5. **Bottom row:** **Recent sales** table (time, reference, location, items, payment, total; last 8; link to the sale) + **Best sellers** (top 5 as a ranked list with a small inline bar, not a full chart).
6. Remove the "Catalog and today" cards (Locations, Products, Stock units). Move "Today's sales" into the KPI row as a small line under Revenue ("$80.00 today").
7. The period toggle (7/30/90 days) applies to everything on the page that depends on time, and says so.

**Density:** card padding 20px, gaps 16px, page padding 24px. A 1440×900 screen should show the title, needs-attention list, KPIs and the top of the charts without scrolling.

## 5. Sidebar

- Group links into sections with small uppercase labels:
  - **Sell:** New sale, Sales history, Social orders
  - **Stock:** Inventory, Transfers, Receiving, Stock control, Replenishment
  - **Catalog:** Products, Suppliers
  - **Admin:** Users, Locations, Opening stock, Settings
- Rename: "History" → "Sales history". Remove "B2C" (it is the same as Sales history). "Invoices" moves under Stock only if it still exists; otherwise hide it.
- Show a small count badge on Transfers and Receiving when something waits for approval.
- Every link must fit at 1366×768 without the sidebar scrolling. The nav may scroll only on smaller screens. No user block in the sidebar (it moved to the header).
- Hide links the user has no permission for, and hide empty sections.

## 6. Inventory-specific UX across the app

- **Stock status chips** everywhere a variant appears: In stock (neutral), Low (amber), Out (red), On hold (gray), In transit (blue outline). Text plus color, never color alone.
- **Tables:** sticky header, row height 44px, numbers right-aligned, sortable columns, filters in a bar above the table, empty state with an action ("No transfers yet. Create one").
- **Variant display:** always `Model name · Color · Size` with the SKU in small muted text below.
- **Every number links** to the list behind it.
- **Loading:** skeletons shaped like the final content. Keep the Framer Motion fade-in already in place.
- **Errors:** inline message with a retry button, not a blank card.

## 7. Responsive

- ≥1280px: layout above.
- 768–1279px: KPIs 2×2, charts stacked, tables scroll horizontally inside their card.
- <768px: sidebar becomes a drawer, quick actions collapse into one "+" button, KPIs stack, the needs-attention list stays at the top.

---

## Acceptance checks

- [ ] Out of stock never exceeds the number of variants. Low and Out cards link to filtered inventory.
- [ ] Best sellers follow the selected period and show color and size. No duplicate-looking rows.
- [ ] Revenue by day is a bar chart. No smooth curves.
- [ ] All numbers use Inter tabular figures. Playfair only on titles.
- [ ] Header has search (Cmd/Ctrl+K, works with a barcode scanner), notifications and a user menu.
- [ ] Needs attention appears at the top and links to filtered pages. Rows with 0 are hidden.
- [ ] Sidebar is grouped, fits at 1366×768, and has no user block.
- [ ] Quick actions respect permissions.
- [ ] Works in light and dark, at 1440, 1024 and 390px widths.
- [ ] Type check and lint pass.

Reply with what changed per section and the list of widgets hidden because the API is missing.