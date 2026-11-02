import { WholesaleInvoiceDetailView } from '@/components/sales/wholesale-invoice-detail-view'

export const metadata = { title: 'Wholesale invoice' }

export default async function WholesaleInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WholesaleInvoiceDetailView invoiceId={id} />
}
