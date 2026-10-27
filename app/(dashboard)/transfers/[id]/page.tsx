import { TransferDetailView } from '@/components/transfers/transfer-detail-view'

export const metadata = { title: 'Transfer' }

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TransferDetailView transferId={id} />
}
