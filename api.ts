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

/** `GET /dashboard/overview` — needs `reports.financial`. Omit `branchId` to aggregate accessible branches. */
export interface DashboardOverview {
    stock: {
        products: number;
        variantsInStock: number;
        totalUnits: number;
        lowStock: number;
        outOfStock: number;
    };
    locations: { warehouses: number; branches: number };
    today: { docs: number; revenue: string };
}

export interface DashboardOverviewParams { branchId?: string }

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

export interface BranchAccess {
    userId: string;
    mode: 'all' | 'selected';   // all: every branch (never the warehouse), also the ones opened later · selected: the branches granted one by one
    branchIds: string[];        // the ones granted one by one (the real list of the user is in /auth/me)
}

// ---- stock adjustments: correct the stock without a sale or a transfer ----------------------------------------------
export type AdjustmentReason = 'count_correction' | 'damage' | 'loss' | 'found' | 'data_entry_error' | 'other';
// count_correction, data_entry_error, other: + or - · found: + only · loss: - only · damage: - only (the pieces go ON HOLD)

export interface AdjustStockInput {
    branchId: string;
    skuId: string;
    bucket?: 'sellable' | 'non_sellable';   // default sellable. The pieces on the road belong to a transfer
    quantityDelta: number;                  // a whole number other than 0: + adds, - takes out
    reason: AdjustmentReason;
    note: string;                           // 5 to 200 characters, required
}

export interface StockAdjustment {
    id: string;
    reference: string;                      // "A-00000001"
    branch: { id: string; code: string; name: string };
    sku: { id: string; code: string; styleName: string; size: string; color: string };
    bucket: string;
    quantityDelta: number;
    reason: AdjustmentReason;
    note: string;
    by: { id: string; name: string | null };
    createdAt: string;
    balanceAfter: number | null;            // the balance of that bucket right after
}

export interface ListAdjustmentsParams { branchId?: string; skuId?: string; reason?: AdjustmentReason; from?: string; to?: string; limit?: number; offset?: number }

// ---- goods receipts: a delivery from a supplier into the warehouse ----------------------------------------------------
export interface GoodsReceiptLineInput { skuId: string; quantity: number; unitCost: string | number }   // quantity 1..10000, unitCost the price paid per piece (0 allowed)

export interface CreateGoodsReceiptInput {
    supplierName: string;              // 2..100 characters, free text
    supplierInvoiceNumber: string;     // the number on the supplier's invoice, 1..50
    invoiceDate?: string;              // YYYY-MM-DD, default today, not in the future
    currency?: string;                 // default USD
    note?: string;                     // up to 200
    lines: GoodsReceiptLineInput[];    // 1..200 products, each once
}

export interface GoodsReceiptSummary {
    id: string;
    reference: string;                 // "GR-00000001"
    warehouse: { id: string; code: string; name: string };
    supplierName: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    currency: string;
    note: string | null;
    totalCost: string;                 // computed by the server
    receivedBy: { id: string; name: string | null };
    createdAt: string;
    lineCount: number;
    totalQuantity: number;
}

export interface GoodsReceipt extends GoodsReceiptSummary {
    lines: { sku: { id: string; code: string; styleName: string; size: string; color: string }; quantity: number; unitCost: string; lineTotal: string }[];
}

export interface ListGoodsReceiptsParams { supplier?: string; invoiceNumber?: string; skuId?: string; from?: string; to?: string; limit?: number; offset?: number }

// ---- invoices: the supply invoice (b2b, warehouse to branch, from a transfer) and the invoice of a sale (b2c) ------------
export type InvoiceKind = 'b2b' | 'b2c';
export type InvoiceStatus = 'draft' | 'final' | 'void';   // draft: no number, prices can change · final: numbered and locked · void: cancelled, stays with the reason

export type CreateInvoiceInput =
    | { transferId: string; note?: string }                                                    // a supply invoice (the transfer must be sent and leave the warehouse)
    | { saleId: string; customerName?: string; customerPhone?: string; note?: string };        // the invoice of a sale: final at once, the customer is optional

export interface InvoiceSummary {
    id: string;
    kind: InvoiceKind;
    status: InvoiceStatus;
    reference: string | null;           // "B2B-00000001" / "B2C-00000001": given when it becomes final (a draft has none)
    issuer: { id: string; name: string };
    recipient: { branchId: string | null; name: string | null; phone: string | null };   // b2b: the branch · b2c: the customer (may be empty = walk-in)
    transfer: { id: string; reference: string } | null;
    sale: { id: string; reference: string } | null;
    currency: string;
    subtotal: string;
    discountTotal: string;
    total: string;
    note: string | null;
    issuedBy: { id: string; name: string | null };
    createdAt: string;
    finalizedAt: string | null;
    voided: { at: string; by: { id: string; name: string | null }; reason: string } | null;
    lineCount: number;
}

export interface InvoiceLine { lineNo: number; sku: { id: string; code: string }; description: string; quantity: number; unitPrice: string; discount: string; lineTotal: string }

export interface Invoice extends InvoiceSummary {
    lines: InvoiceLine[];
    payments: { method: string; amount: string; reference: string | null }[];   // the payments of the sale (b2c)
}

export interface ListInvoicesParams { kind?: InvoiceKind; status?: InvoiceStatus; branchId?: string; search?: string; from?: string; to?: string; limit?: number; offset?: number }

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

export interface HealthResult {
    status: string;
}

// The only calls that need no token. Wrong email or password -> ApiError with status 401.
export const login = (email: string, password: string) =>
    request<LoginResult>('/auth/login', null, 'POST', { email, password });

export const health = () => request<HealthResult>('/health', null);

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

    // ---- invoices. The supply invoice: createInvoice({ transferId }) -> updateInvoicePrices -> finalizeInvoice. The invoice of a sale: createInvoice({ saleId, customerName? }).
    createInvoice: (input: CreateInvoiceInput) => request<Invoice>('/invoices', token, 'POST', input),
    listInvoicesPage: (params: ListInvoicesParams = {}) => requestPage<InvoiceSummary>(`/invoices${query(params)}`, token),
    getInvoice: (id: string) => request<Invoice>(`/invoices/${id}`, token),
    updateInvoicePrices: (id: string, input: { lines?: { skuId: string; unitPrice: string | number }[]; note?: string }) => request<Invoice>(`/invoices/${id}`, token, 'PATCH', input),   // a draft only
    finalizeInvoice: (id: string) => request<Invoice>(`/invoices/${id}/finalize`, token, 'POST'),
    voidInvoice: (id: string, reason: string) => request<Invoice>(`/invoices/${id}/void`, token, 'POST', { reason }),
    deleteInvoice: (id: string) => request<void>(`/invoices/${id}`, token, 'DELETE'),                    // a draft only
    // the PDF needs the token, so a plain link does not work: fetch it, then show or save the blob (window.open(URL.createObjectURL(blob)))
    downloadInvoicePdf: async (id: string): Promise<Blob> => {
        const response = await fetch(`${BASE_URL}/invoices/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (!response.ok) throw new ApiError(response.status, ((await response.json().catch(() => null)) as { message?: string } | null)?.message ?? 'Could not load the invoice');
        return response.blob();
    },

    // ---- goods receipts (admin, or a manager who reaches the warehouse). Needs an idempotencyKey: once per click.
    // 409 "This supplier invoice was already received as GR-..." is a double entry.
    receiveGoods: (input: CreateGoodsReceiptInput, idempotencyKey: string) => request<GoodsReceipt>('/goods-receipts', token, 'POST', input, { 'Idempotency-Key': idempotencyKey }),
    listGoodsReceiptsPage: (params: ListGoodsReceiptsParams = {}) => requestPage<GoodsReceiptSummary>(`/goods-receipts${query(params)}`, token),
    getGoodsReceipt: (id: string) => request<GoodsReceipt>(`/goods-receipts/${id}`, token),

    // ---- stock adjustments (manager for their branches, admin anywhere). Needs an idempotencyKey: newIdempotencyKey() once per click.
    adjustStock: (input: AdjustStockInput, idempotencyKey: string) => request<StockAdjustment>('/stock/adjustments', token, 'POST', input, { 'Idempotency-Key': idempotencyKey }),
    listAdjustmentsPage: (params: ListAdjustmentsParams = {}) => requestPage<StockAdjustment>(`/stock/adjustments${query(params)}`, token),

    // ---- which branches a user reaches (admin only): a manager can be appointed to ALL branches
    getBranchAccess: (id: string) => request<BranchAccess>(`/users/${id}/branch-access`, token),
    setBranchAccess: (id: string, mode: 'all' | 'selected') => request<BranchAccess>(`/users/${id}/branch-access`, token, 'PUT', { mode }),

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
    // every active place (id, code, name, kind), the warehouse first: the "to" of the transfer form (GET /branches shows a branch user only their own)
    listPlaces: () => request<{ id: string; code: string; name: string; kind: 'branch' | 'warehouse' }[]>('/places', token),
    getWarehouse: () => request<{ id: string; code: string; name: string }>('/warehouse', token),

    getReplenishmentSuggestions: (params: { branchId?: string } = {}) => request<ReplenishmentSuggestions>(`/replenishment/suggestions${query(params)}`, token),
    getDashboardOverview: (params: DashboardOverviewParams = {}) => request<DashboardOverview>(`/dashboard/overview${query(params)}`, token),
    getSalesSummary: (params: DateRangeParams = {}) => request<SalesSummary>(`/reports/sales-summary${query(params)}`, token),
    getTopSkus: (params: DateRangeParams & { limit?: number } = {}) => request<TopSkusResult>(`/reports/top-skus${query(params)}`, token),
    listAuditEvents: (params: AuditParams = {}) => request<AuditEvent[]>(`/audit-events${query(params)}`, token),                          // admin only
});
