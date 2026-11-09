# For Mohamad: settings and cash sessions (9 Nov, batch 2)

## Settings: replace the localStorage exchange rate
- `GET /settings` (any signed-in user) -> `{ exchangeRateUsdLbp: number | null, returnPeriodDays: 14, defaultReservationDays: 3, requireOpenCashSession: false }`
- `PUT /settings` (admin or manager), partial body, e.g. `{ "exchangeRateUsdLbp": 89500 }`; `null` clears the rate. Whole numbers only; unknown keys are a 400.
- Use `returnPeriodDays` for the return window instead of a constant in the app.

## The drawer (cash sessions)
Permissions on `GET /auth/me`: `cash.open`, `cash.accept`, `cash.close`, `cash.move` (a manager has all four; an employee only when granted).
- **Till start:** `GET /cash-sessions/current?branchId=` -> the open session or `null`. If `null`: show "Open the drawer" (needs `cash.open`) -> `POST /cash-sessions { branchId, openingCash, note? }`.
- **Each sale** is attached to the open session by the server; you send nothing new. When `requireOpenCashSession` is true and there is no open session, `POST /sales` answers **409** ("This branch has no open cash session"): show the drawer screen.
- **Cash in/out:** `POST /cash-sessions/:id/movements { direction: "in"|"out", amount, reason }` + `Idempotency-Key`. 409 if you take out more than expected.
- **Handover:** the person who TAKES the drawer counts it and calls `POST /cash-sessions/:id/handover { countedCash, note? }` + `Idempotency-Key`. If it differs from `totals.expectedCash` the note is required (400 otherwise). Logging out is not a handover.
- **Close:** `POST /cash-sessions/:id/close { countedCash, cashRemoved?, differenceNote? }`. `differenceNote` is required when the count differs from the expected cash; it never blocks the closing. `cashLeft` = counted - removed.
- **Session view** (`GET /cash-sessions/:id`): `totals` (`salesCount`, `salesTotal`, `cashPayments`, `whishPayments`, `cashIn`, `cashOut`, `expectedCash`), `byUser`, `movements`, `handovers`, `corrections`, `closing`, `effective` (the closing with corrections applied), `review`.
- **Expected cash** = opening + cash payments + cash in - cash out. **Whish never changes the drawer.**
- **Manager only:** `POST /cash-sessions/:id/corrections { field: "openingCash"|"countedCash"|"cashRemoved", value, reason }` on a closed session, and `POST /cash-sessions/:id/review { note? }` for a flagged one. Show `closing` (the original) and `effective` side by side.
- **List:** `GET /cash-sessions?branchId=&status=&review=flagged&from=&to=` (count in `X-Total-Count`), for the manager's "to review" list.
