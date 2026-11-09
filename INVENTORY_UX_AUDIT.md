# Inventory workflow audit — clicks, screens and what changed

Companion to `ARCHITECTURE.md`. That file records where each figure comes from;
this one records **how many interactions it takes to act on one**, before and
after the November 2026 pass, and the three places where the count could not be
cut further without losing the audit trail or inventing data the API has not
got.

Counts are the shortest honest path for a manager with dispatch rights, from the
inventory list, on a desktop. "Page load" means a route change: a lost scroll
position and a round trip, which is the part staff feel when they do this fifty
times a shift.

---

## 1. Correct a balance against a physical count

| | Before | After |
|---|---|---|
| Clicks | 8 | 3 |
| Typed values | 2 | 2 |
| Page loads | 2 | 0 |
| Screens | list → variant page → drawer | list + drawer |

**Before:** select the row, open *View movement history* (load), find the
location row, *Correct*, type the counted figure, open the reason select, pick a
reason, write the note, post, then navigate back to the list (load) and find
your place again.

**After:** the correct icon on the row opens the same drawer over the list. The
location comes from the header branch filter, or is a field inside the drawer
when the filter is on every location — balances are held per location, so that
question cannot be skipped, only answered in place. The reason is a chip row
(one click, not two) and `−5 −1 +1 +5` buttons move the counted figure without a
keyboard, which is what a phone in a stockroom needs.

**Kept deliberately:** there is no inline editable quantity in the table. The
endpoint takes a delta with a reason code and a sentence of at least five
characters (`POST /stock/adjustments`, `ARCHITECTURE.md` §10), and that sentence
is the point — every balance change reaches the audit log with a person and a
cause. A silent cell edit cannot satisfy that, so the drawer is the floor; what
was removed is the navigation around it, not the accountability inside it.

## 2. Send stock for one variant

| | Before | After |
|---|---|---|
| Clicks | 8 | 2 (4 the first time, before a destination is remembered) |
| Typed values | 2 (search term + quantity) | 1 (quantity) |
| Page loads | 2 | 0 |
| Screens | list → transfers tab → form → transfer page | list + drawer |

**Before:** Transfers tab, *Prepare transfer* (load), pick From (2), pick To
(2), **retype the SKU that was on screen a moment ago**, add the line, set the
quantity, *Send now*, and land on the transfer page (load).

**After:** the send icon on the row opens a drawer with the variant already
chosen, From defaulted to the branch in the header — or, with no filter set, to
the location that actually holds the most of it — and To defaulted to the last
place this device sent to. The drawer shows available at the source, the
quantity, and what the source is left with, and refuses more than is available.
It makes the same two writes the full form makes (`POST /transfers`, then
`POST /transfers/:id/dispatch`, a separate idempotency key each), so the record
and the audit trail are identical. On success the list stays where it was; if
the dispatch fails the draft is kept and you land on it, because that work must
never evaporate.

## 3. Send several variants as one shipment

| | Before (5 variants) | After (5 variants) |
|---|---|---|
| Clicks | ~15 | 7 |
| Searches typed | 5 | 0 |
| Page loads | 2 | 0 |

Tick the rows (or the header checkbox for the whole page), then *Send as one
shipment*: the drawer opens with every ticked variant as a line, each capped at
what the source holds. The selection survives paging, so a shipment can be built
from rows on page 1 and page 3.

## 4. Fill a replenishment suggestion

| | Before | After |
|---|---|---|
| Clicks | 7 | 2 |
| Typed values | 2 | 0 |
| Page loads | 2 | 0 |

This was the worst path in the app. *Prepare* on a suggestion row linked to a
**blank** `/transfers/new`: the branch that is short, the variant and the
suggested quantity were all on the row being read, and all three had to be found
and typed again. The button now opens the drawer with the warehouse as source,
the short branch as destination, and the quantity set to
`min(suggested, fillable)` — capped at what the warehouse can actually ship, so
nobody sends a number the shelf cannot honour.

## 5. Correct or send from a branch or warehouse page

| | Before | After |
|---|---|---|
| Clicks | ~6 | 1 |
| Page loads | 2 | 0 |

The stock list on a location page was read-only, so acting on a row meant going
to `/inventory`, searching the SKU, selecting it, opening the variant page and
correcting there. Each row now carries send and correct, with **that location**
already set — it is the subject of the page.

## 6. Finding a row

`/` from anywhere on the variants list puts the cursor in the search box; it
stays out of the way while you are typing in a field or while a drawer is open.
Ctrl/Cmd+K still opens the palette over the whole app, and a barcode scan in it
still goes straight to the variant.

---

## Where the count could not be cut, and why

**Category, supplier and warehouse filters on the list.** The warehouse filter
already exists as the header branch scope. A category filter would be empty for
the people most likely to use it: the admin path reads the list from
`GET /stock/overview`, which returns styles with no category at all
(`category: null` in `services/inventory-overview-source.ts`), so rows carry no
category to filter or search on. That is a backend gap, not a UI decision —
`BACKEND_REQUESTS.md` is where it belongs. Supplier is free text on a goods
receipt and is not attached to stock, so there is nothing to filter by.

**Purchase orders and supplier records.** Neither exists in this app. A supplier
delivery is booked in as a goods receipt with the supplier's name typed on it;
there is no PO to receive against and no supplier table to manage, so there was
no such workflow to shorten. If POs arrive, receiving against one is the next
drawer to build.

**Stock everywhere (`/stock-network`).** Left read-only. A cell there is a
variant-and-location pair, and sending still needs a destination the grid does
not know, so the drawer would ask as much as it filled. The same variant is one
click from the inventory list.

**Product creation.** Already one page with a running summary; not touched in
this pass.

---

## What a reviewer should check

- `components/inventory/quick-transfer-drawer.tsx` — the two writes, the
  availability cap, and the request-mode branch (staff who may receive but not
  dispatch can only ask the warehouse to restock their own branch, the rule the
  server enforces).
- `components/inventory/correct-stock-drawer.tsx` — offers only locations where
  the viewer holds `stock.adjust`, so no action on screen can end in a 403.
- `components/inventory/inventory-table.tsx` — the actions and checkbox columns
  are rendered only when the viewer may use them; the checkbox column is hidden
  on phones, where one row at a time is the real workflow.
