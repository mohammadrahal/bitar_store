/** Shared CSS for popup / iframe print documents (receipts, labels, etc.). */

export const PRINT_COLOR_ADJUST = `
  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`

export const RECEIPT_PRINT_CSS = `
  ${PRINT_COLOR_ADJUST}
  @page {
    margin: 6mm;
  }
  html,
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    line-height: 1.45;
  }
  .receipt-sheet {
    display: flex;
    justify-content: center;
    padding: 8mm 6mm 12mm;
    min-height: auto;
  }
  .receipt {
    width: 72mm;
    max-width: 72mm;
  }
  .brand {
    margin: 0 0 10px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
    color: #444;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.02em;
  }
  .meta {
    margin: 0 0 14px;
    text-align: center;
    color: #333;
    line-height: 1.5;
    font-size: 11px;
  }
  .status {
    display: inline-block;
    margin-bottom: 6px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .status-pending {
    background: #fef3c7;
    color: #92400e;
  }
  .status-completed {
    background: #dcfce7;
    color: #166534;
  }
  table.receipt-lines {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 12px;
    table-layout: fixed;
  }
  table.receipt-lines th,
  table.receipt-lines td {
    padding: 5px 0;
    vertical-align: top;
    font-size: 10px;
  }
  table.receipt-lines th {
    border-bottom: 1px solid #bbb;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.04em;
  }
  table.receipt-lines td.num,
  table.receipt-lines th.num {
    text-align: right;
    white-space: nowrap;
    padding-left: 4px;
  }
  table.receipt-lines th:nth-child(1),
  table.receipt-lines td:nth-child(1) {
    width: 44%;
    word-wrap: break-word;
  }
  table.receipt-lines th:nth-child(2),
  table.receipt-lines td:nth-child(2) {
    width: 14%;
  }
  table.receipt-lines th:nth-child(3),
  table.receipt-lines td:nth-child(3) {
    width: 20%;
  }
  table.receipt-lines th:nth-child(4),
  table.receipt-lines td:nth-child(4) {
    width: 22%;
  }
  table.receipt-lines td small {
    display: block;
    margin-top: 2px;
    color: #555;
    font-size: 9px;
    line-height: 1.3;
    word-break: break-word;
  }
  .total-block {
    border-top: 2px solid #111;
    padding-top: 8px;
    margin: 0 0 12px;
    text-align: right;
  }
  .total {
    margin: 0;
    font-weight: 700;
    font-size: 14px;
  }
  .total-lbp {
    margin: 4px 0 0;
    font-size: 11px;
    font-weight: 500;
    color: #333;
  }
  .section-title {
    margin: 14px 0 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pay-row {
    margin: 3px 0;
    font-size: 11px;
  }
  .pay-change {
    font-weight: 700;
    margin-top: 6px;
  }
  .note {
    margin-top: 12px;
    font-size: 10px;
    font-style: italic;
    color: #444;
    text-align: center;
    word-break: break-word;
  }
  .footer-muted {
    margin-top: 14px;
    font-size: 9px;
    color: #666;
    text-align: center;
    line-height: 1.4;
  }
`

export const BARCODE_PRINT_CSS = `
  ${PRINT_COLOR_ADJUST}
  @page { margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body { font-family: system-ui, sans-serif; }
  .barcode-sheet {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    padding: 8mm;
  }
  .barcode-label {
    break-inside: avoid;
    border: 1px solid #ccc;
    padding: 12px;
    text-align: center;
  }
  .barcode-label-product { margin: 0 0 4px; font-size: 13px; font-weight: 600; }
  .barcode-label-variant { margin: 0 0 10px; font-size: 11px; color: #444; }
  .barcode-label-bars { display: flex; justify-content: center; margin: 0 0 6px; }
  .barcode-label-code { margin: 0; font-size: 14px; letter-spacing: 0.12em; font-variant-numeric: tabular-nums; }
  @media print {
    .barcode-label { border-color: #999; }
  }
`
