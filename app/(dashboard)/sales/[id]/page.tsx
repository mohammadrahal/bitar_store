import { SaleDetailView } from '@/components/sales/sale-detail-view'

export const metadata = { title: 'Sale' }

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SaleDetailView saleId={id} />
}
