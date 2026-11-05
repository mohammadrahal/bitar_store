import { ReceiptDetailView } from '@/components/stock-receipts/receipt-detail-view'

export const metadata = { title: 'Stock receipt' }

export default async function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params
  return <ReceiptDetailView receiptId={receiptId} />
}
