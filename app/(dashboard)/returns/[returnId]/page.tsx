import { ReturnDetailView } from '@/components/returns/return-detail-view'

export const metadata = { title: 'Return' }

export default async function ReturnPage({ params }: { params: Promise<{ returnId: string }> }) {
  const { returnId } = await params
  return <ReturnDetailView returnId={returnId} />
}
