import { VariantDetailView } from '@/components/inventory/variant-detail-view'

export const metadata = { title: 'Variant' }

export default async function VariantPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params
  return <VariantDetailView variantId={variantId} />
}
