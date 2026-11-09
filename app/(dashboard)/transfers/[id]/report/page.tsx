import { TransferReceivingReportView } from '@/components/transfers/transfer-receiving-report-view'

export const metadata = { title: 'Receiving report' }

export default async function TransferReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TransferReceivingReportView transferId={id} />
}
