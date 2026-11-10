import { TransferSupplyInvoiceView } from '@/components/transfers/transfer-supply-invoice-view'

export const metadata = { title: 'Supply invoice' }

export default async function TransferSupplyInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TransferSupplyInvoiceView transferId={id} />
}
