import { CashSessionDetailView } from '@/components/cash/cash-session-detail-view'

export const metadata = { title: 'Shift' }

export default async function CashSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  return <CashSessionDetailView sessionId={sessionId} />
}
