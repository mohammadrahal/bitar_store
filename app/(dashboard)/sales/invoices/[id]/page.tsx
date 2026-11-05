import { InvoiceDetailPage } from '@/components/sales/invoice-detail-page'

export const metadata = { title: 'Invoice' }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InvoiceDetailPage invoiceId={id} />
}
